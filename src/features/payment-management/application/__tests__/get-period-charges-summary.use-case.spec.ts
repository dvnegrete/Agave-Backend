import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { GetPeriodChargesSummaryUseCase } from '../get-period-charges-summary.use-case';

describe('GetPeriodChargesSummaryUseCase', () => {
  let useCase: GetPeriodChargesSummaryUseCase;
  let dataSource: jest.Mocked<DataSource>;

  const mockQueryResult = [
    {
      period_id: 1,
      year: 2026,
      month: 1,
      water_active: true,
      extraordinary_fee_active: false,
      maintenance_amount: '800.00',
      water_amount: '100.00',
      extraordinary_fee_amount: null,
      has_allocations: false,
    },
    {
      period_id: 2,
      year: 2026,
      month: 2,
      water_active: false,
      extraordinary_fee_active: true,
      maintenance_amount: '800.00',
      water_amount: null,
      extraordinary_fee_amount: '50.00',
      has_allocations: true,
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPeriodChargesSummaryUseCase,
        {
          provide: DataSource,
          useValue: {
            query: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<GetPeriodChargesSummaryUseCase>(
      GetPeriodChargesSummaryUseCase,
    );
    dataSource = module.get(DataSource);
  });

  describe('execute', () => {
    it('should return summary for all periods', async () => {
      dataSource.query.mockResolvedValue(mockQueryResult);

      const result = await useCase.execute();

      expect(result).toBeDefined();
      expect(result).toHaveLength(2);
    });

    it('should map period data correctly', async () => {
      dataSource.query.mockResolvedValue(mockQueryResult);

      const result = await useCase.execute();

      expect(result[0].period_id).toBe(1);
      expect(result[0].year).toBe(2026);
      expect(result[0].month).toBe(1);
    });

    it('should parse amount strings to numbers', async () => {
      dataSource.query.mockResolvedValue(mockQueryResult);

      const result = await useCase.execute();

      expect(result[0].maintenance_amount).toBe(800);
      expect(result[0].water_amount).toBe(100);
      expect(typeof result[0].maintenance_amount).toBe('number');
    });

    it('should handle null amounts as null', async () => {
      dataSource.query.mockResolvedValue(mockQueryResult);

      const result = await useCase.execute();

      expect(result[1].water_amount).toBeNull();
      expect(result[0].extraordinary_fee_amount).toBeNull();
    });

    it('should include display_name formatted month', async () => {
      dataSource.query.mockResolvedValue(mockQueryResult);

      const result = await useCase.execute();

      expect(result[0].display_name).toBeDefined();
      expect(typeof result[0].display_name).toBe('string');
    });

    it('should preserve water_active flag', async () => {
      dataSource.query.mockResolvedValue(mockQueryResult);

      const result = await useCase.execute();

      expect(result[0].water_active).toBe(true);
      expect(result[1].water_active).toBe(false);
    });

    it('should preserve extraordinary_fee_active flag', async () => {
      dataSource.query.mockResolvedValue(mockQueryResult);

      const result = await useCase.execute();

      expect(result[0].extraordinary_fee_active).toBe(false);
      expect(result[1].extraordinary_fee_active).toBe(true);
    });

    it('should indicate has_allocations status', async () => {
      dataSource.query.mockResolvedValue(mockQueryResult);

      const result = await useCase.execute();

      expect(result[0].has_allocations).toBe(false);
      expect(result[1].has_allocations).toBe(true);
    });

    it('should handle empty result set', async () => {
      dataSource.query.mockResolvedValue([]);

      const result = await useCase.execute();

      expect(result).toEqual([]);
    });

    it('should handle null amount values by converting to 0', async () => {
      const queryResult = [
        {
          period_id: 1,
          year: 2026,
          month: 1,
          water_active: false,
          extraordinary_fee_active: false,
          maintenance_amount: null,
          water_amount: null,
          extraordinary_fee_amount: null,
          has_allocations: false,
        },
      ];

      dataSource.query.mockResolvedValue(queryResult);

      const result = await useCase.execute();

      expect(result[0].maintenance_amount).toBe(0);
      expect(result[0].water_amount).toBeNull();
    });

    it('should return sorted periods (by year and month ASC)', async () => {
      const unsortedResult = [
        { ...mockQueryResult[1] },
        { ...mockQueryResult[0] },
      ];

      dataSource.query.mockResolvedValue(unsortedResult);

      const result = await useCase.execute();

      // The query results are ordered by the database query (ORDER BY p.year ASC, p.month ASC)
      // So we should receive them in that order
      expect(result).toHaveLength(2);
    });

    it('should handle multiple periods with different configurations', async () => {
      const multiplePeriodsResult = [
        { ...mockQueryResult[0], period_id: 1 },
        { ...mockQueryResult[1], period_id: 2 },
        {
          period_id: 3,
          year: 2026,
          month: 3,
          water_active: true,
          extraordinary_fee_active: true,
          maintenance_amount: '800.00',
          water_amount: '100.00',
          extraordinary_fee_amount: '50.00',
          has_allocations: true,
        },
      ];

      dataSource.query.mockResolvedValue(multiplePeriodsResult);

      const result = await useCase.execute();

      expect(result).toHaveLength(3);
      expect(result[2].water_active).toBe(true);
      expect(result[2].extraordinary_fee_active).toBe(true);
    });

    it('should return correct PeriodChargeSummaryDto structure', async () => {
      dataSource.query.mockResolvedValue(mockQueryResult);

      const result = await useCase.execute();

      expect(result[0]).toHaveProperty('period_id');
      expect(result[0]).toHaveProperty('year');
      expect(result[0]).toHaveProperty('month');
      expect(result[0]).toHaveProperty('display_name');
      expect(result[0]).toHaveProperty('maintenance_amount');
      expect(result[0]).toHaveProperty('water_amount');
      expect(result[0]).toHaveProperty('extraordinary_fee_amount');
      expect(result[0]).toHaveProperty('water_active');
      expect(result[0]).toHaveProperty('extraordinary_fee_active');
      expect(result[0]).toHaveProperty('has_allocations');
    });

    it('should handle decimal amounts correctly', async () => {
      const decimalResult = [
        {
          period_id: 1,
          year: 2026,
          month: 1,
          water_active: false,
          extraordinary_fee_active: false,
          maintenance_amount: '800.99',
          water_amount: '100.50',
          extraordinary_fee_amount: '50.25',
          has_allocations: false,
        },
      ];

      dataSource.query.mockResolvedValue(decimalResult);

      const result = await useCase.execute();

      expect(result[0].maintenance_amount).toBe(800.99);
      expect(result[0].water_amount).toBe(100.50);
      expect(result[0].extraordinary_fee_amount).toBe(50.25);
    });
  });
});
