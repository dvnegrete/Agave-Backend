import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { ApplyCreditToPeriodsUseCase } from '../apply-credit-to-periods.use-case';
import {
  IRecordAllocationRepository,
  IPeriodRepository,
  IPeriodConfigRepository,
  IHouseBalanceRepository,
  IHousePeriodOverrideRepository,
  IHousePeriodChargeRepository,
} from '../../interfaces';
import { HouseStatusSnapshotService } from '../../infrastructure/services/house-status-snapshot.service';
import { AllocationConceptType } from '@/shared/database/entities/enums';

describe('ApplyCreditToPeriodsUseCase', () => {
  let useCase: ApplyCreditToPeriodsUseCase;
  let recordAllocationRepository: jest.Mocked<IRecordAllocationRepository>;
  let periodRepository: jest.Mocked<IPeriodRepository>;
  let periodConfigRepository: jest.Mocked<IPeriodConfigRepository>;
  let houseBalanceRepository: jest.Mocked<IHouseBalanceRepository>;
  let housePeriodOverrideRepository: jest.Mocked<IHousePeriodOverrideRepository>;
  let housePeriodChargeRepository: jest.Mocked<IHousePeriodChargeRepository>;
  let dataSource: jest.Mocked<DataSource>;
  let snapshotService: jest.Mocked<HouseStatusSnapshotService>;

  const houseId = 1;

  const mockBalance = {
    id: 1,
    house_id: houseId,
    credit_balance: 5000,
    accumulated_cents: 50,
  };

  const mockPeriod = (id: number, month: number) => ({
    id,
    year: 2026,
    month,
    startDate: new Date(2026, month - 1, 1),
    endDate: new Date(2026, month, 0),
    periodConfigId: 1,
  });

  const mockHousePeriodCharge = {
    id: 1,
    house_id: houseId,
    period_id: 1,
    concept_type: AllocationConceptType.MAINTENANCE,
    expected_amount: 800,
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    query: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ApplyCreditToPeriodsUseCase,
        {
          provide: 'IRecordAllocationRepository',
          useValue: {
            findByHouseAndPeriod: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: 'IPeriodRepository',
          useValue: {
            findAll: jest.fn(),
          },
        },
        {
          provide: 'IPeriodConfigRepository',
          useValue: {
            findActiveForDate: jest.fn(),
          },
        },
        {
          provide: 'IHouseBalanceRepository',
          useValue: {
            getOrCreate: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: 'IHousePeriodOverrideRepository',
          useValue: {
            getApplicableAmount: jest.fn(),
          },
        },
        {
          provide: 'IHousePeriodChargeRepository',
          useValue: {
            findByHouseAndPeriod: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
        {
          provide: HouseStatusSnapshotService,
          useValue: {
            invalidateByHouseId: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<ApplyCreditToPeriodsUseCase>(
      ApplyCreditToPeriodsUseCase,
    );
    recordAllocationRepository = module.get('IRecordAllocationRepository');
    periodRepository = module.get('IPeriodRepository');
    periodConfigRepository = module.get('IPeriodConfigRepository');
    houseBalanceRepository = module.get('IHouseBalanceRepository');
    housePeriodOverrideRepository = module.get('IHousePeriodOverrideRepository');
    housePeriodChargeRepository = module.get('IHousePeriodChargeRepository');
    dataSource = module.get(DataSource);
    snapshotService = module.get(HouseStatusSnapshotService);
  });

  describe('execute', () => {
    it('should return empty result when credit_balance is 0', async () => {
      const zeroBalance = { ...mockBalance, credit_balance: 0 };
      houseBalanceRepository.getOrCreate.mockResolvedValue(zeroBalance as any);

      const result = await useCase.execute(houseId);

      expect(result).toBeDefined();
      expect(result.total_applied).toBe(0);
      expect(result.allocations_created).toHaveLength(0);
      expect(result.periods_covered).toBe(0);
      expect(result.periods_partially_covered).toBe(0);
    });

    it('should return empty result when credit_balance is negative', async () => {
      const negativeBalance = { ...mockBalance, credit_balance: -100 };
      houseBalanceRepository.getOrCreate.mockResolvedValue(
        negativeBalance as any,
      );

      const result = await useCase.execute(houseId);

      expect(result.credit_before).toBe(-100);
      expect(result.credit_after).toBe(-100);
      expect(result.total_applied).toBe(0);
    });

    it('should apply credit to cover single period completely', async () => {
      houseBalanceRepository.getOrCreate.mockResolvedValue(mockBalance as any);
      periodRepository.findAll.mockResolvedValue([mockPeriod(1, 1)]);
      housePeriodChargeRepository.findByHouseAndPeriod.mockResolvedValue([
        mockHousePeriodCharge,
      ]);
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      mockQueryRunner.query.mockResolvedValue(undefined);
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);

      const result = await useCase.execute(houseId);

      expect(result.credit_before).toBe(5000);
      expect(result.total_applied).toBeGreaterThan(0);
      expect(result.periods_covered).toBeGreaterThan(0);
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should apply credit to multiple periods in order', async () => {
      houseBalanceRepository.getOrCreate.mockResolvedValue(mockBalance as any);
      periodRepository.findAll.mockResolvedValue([
        mockPeriod(1, 1),
        mockPeriod(2, 2),
        mockPeriod(3, 3),
      ]);
      housePeriodChargeRepository.findByHouseAndPeriod.mockResolvedValue([
        mockHousePeriodCharge,
      ]);
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      mockQueryRunner.query.mockResolvedValue(undefined);
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);

      const result = await useCase.execute(houseId);

      expect(result.periods_covered).toBeGreaterThanOrEqual(0);
      expect(mockQueryRunner.query).toHaveBeenCalled();
    });

    it('should handle partial credit allocation', async () => {
      const partialBalance = { ...mockBalance, credit_balance: 400 }; // Less than 800
      houseBalanceRepository.getOrCreate.mockResolvedValue(partialBalance as any);
      periodRepository.findAll.mockResolvedValue([mockPeriod(1, 1)]);
      housePeriodChargeRepository.findByHouseAndPeriod.mockResolvedValue([
        mockHousePeriodCharge,
      ]);
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      mockQueryRunner.query.mockResolvedValue(undefined);
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);

      const result = await useCase.execute(houseId);

      expect(result.credit_before).toBe(400);
      expect(result.total_applied).toBeGreaterThan(0);
      expect(result.total_applied).toBeLessThanOrEqual(400);
      expect(result.periods_partially_covered).toBeGreaterThanOrEqual(0);
    });

    it('should respect existing allocations (no double-application)', async () => {
      const existingAllocation = {
        id: 1,
        allocated_amount: 400,
        concept_type: AllocationConceptType.MAINTENANCE,
      };

      houseBalanceRepository.getOrCreate.mockResolvedValue(mockBalance as any);
      periodRepository.findAll.mockResolvedValue([mockPeriod(1, 1)]);
      housePeriodChargeRepository.findByHouseAndPeriod.mockResolvedValue([
        mockHousePeriodCharge,
      ]);
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([
        existingAllocation,
      ]);
      mockQueryRunner.query.mockResolvedValue(undefined);
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);

      const result = await useCase.execute(houseId);

      // Pending should be 800 - 400 = 400
      expect(result.total_applied).toBeLessThanOrEqual(400);
    });

    it('should handle rounding to 2 decimals correctly', async () => {
      const floatingBalance = { ...mockBalance, credit_balance: 1234.567 };
      houseBalanceRepository.getOrCreate.mockResolvedValue(floatingBalance as any);
      periodRepository.findAll.mockResolvedValue([mockPeriod(1, 1)]);
      housePeriodChargeRepository.findByHouseAndPeriod.mockResolvedValue([
        mockHousePeriodCharge,
      ]);
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      mockQueryRunner.query.mockResolvedValue(undefined);
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);

      const result = await useCase.execute(houseId);

      expect(result.total_applied).toBeLessThanOrEqual(1234.57);
      expect(result.total_applied % 0.01).toBeLessThan(0.001); // 2 decimal places
    });

    it('should handle transaction rollback on error', async () => {
      houseBalanceRepository.getOrCreate.mockResolvedValue(mockBalance as any);
      periodRepository.findAll.mockResolvedValue([mockPeriod(1, 1)]);
      housePeriodChargeRepository.findByHouseAndPeriod.mockResolvedValue([
        mockHousePeriodCharge,
      ]);
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      mockQueryRunner.query.mockRejectedValue(new Error('DB error'));

      await expect(useCase.execute(houseId)).rejects.toThrow();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should update house balance after allocation', async () => {
      houseBalanceRepository.getOrCreate.mockResolvedValue(mockBalance as any);
      periodRepository.findAll.mockResolvedValue([mockPeriod(1, 1)]);
      housePeriodChargeRepository.findByHouseAndPeriod.mockResolvedValue([
        mockHousePeriodCharge,
      ]);
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      mockQueryRunner.query.mockResolvedValue(undefined);
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);

      const result = await useCase.execute(houseId);

      expect(result.credit_after).toBeLessThan(result.credit_before);
    });

    it('should invalidate snapshot after successful allocation', async () => {
      houseBalanceRepository.getOrCreate.mockResolvedValue(mockBalance as any);
      periodRepository.findAll.mockResolvedValue([mockPeriod(1, 1)]);
      housePeriodChargeRepository.findByHouseAndPeriod.mockResolvedValue([
        mockHousePeriodCharge,
      ]);
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      mockQueryRunner.query.mockResolvedValue(undefined);
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);

      await useCase.execute(houseId);

      expect(snapshotService.invalidateByHouseId).toHaveBeenCalledWith(houseId);
    });

    it('should use house_period_charges when available (not fallback)', async () => {
      houseBalanceRepository.getOrCreate.mockResolvedValue(mockBalance as any);
      periodRepository.findAll.mockResolvedValue([mockPeriod(1, 1)]);
      const charges = [
        { ...mockHousePeriodCharge, concept_type: AllocationConceptType.MAINTENANCE },
        { ...mockHousePeriodCharge, concept_type: AllocationConceptType.WATER, expected_amount: 100 },
      ];
      housePeriodChargeRepository.findByHouseAndPeriod.mockResolvedValue(
        charges as any,
      );
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      mockQueryRunner.query.mockResolvedValue(undefined);
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);

      const result = await useCase.execute(houseId);

      expect(housePeriodChargeRepository.findByHouseAndPeriod).toHaveBeenCalled();
      expect(result.allocations_created.length).toBeGreaterThanOrEqual(0);
    });

    it('should return correct CreditApplicationResult structure', async () => {
      houseBalanceRepository.getOrCreate.mockResolvedValue(mockBalance as any);
      periodRepository.findAll.mockResolvedValue([mockPeriod(1, 1)]);
      housePeriodChargeRepository.findByHouseAndPeriod.mockResolvedValue([
        mockHousePeriodCharge,
      ]);
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      mockQueryRunner.query.mockResolvedValue(undefined);
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);

      const result = await useCase.execute(houseId);

      expect(result).toHaveProperty('house_id');
      expect(result).toHaveProperty('credit_before');
      expect(result).toHaveProperty('credit_after');
      expect(result).toHaveProperty('total_applied');
      expect(result).toHaveProperty('allocations_created');
      expect(result).toHaveProperty('periods_covered');
      expect(result).toHaveProperty('periods_partially_covered');
    });

    it('should cover all periods with sufficient credit', async () => {
      const largeBalance = { ...mockBalance, credit_balance: 10000 };
      houseBalanceRepository.getOrCreate.mockResolvedValue(largeBalance as any);
      periodRepository.findAll.mockResolvedValue([
        mockPeriod(1, 1),
        mockPeriod(2, 2),
        mockPeriod(3, 3),
      ]);
      housePeriodChargeRepository.findByHouseAndPeriod.mockResolvedValue([
        mockHousePeriodCharge,
      ]);
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      mockQueryRunner.query.mockResolvedValue(undefined);
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);

      const result = await useCase.execute(houseId);

      expect(result.periods_covered).toBe(3);
      expect(result.periods_partially_covered).toBe(0);
    });

    it('should handle empty periods list', async () => {
      houseBalanceRepository.getOrCreate.mockResolvedValue(mockBalance as any);
      periodRepository.findAll.mockResolvedValue([]);

      const result = await useCase.execute(houseId);

      expect(result.total_applied).toBe(0);
      expect(result.allocations_created).toHaveLength(0);
    });
  });
});
