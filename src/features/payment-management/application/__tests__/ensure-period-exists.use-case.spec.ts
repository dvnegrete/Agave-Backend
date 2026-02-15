import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { EnsurePeriodExistsUseCase } from '../ensure-period-exists.use-case';
import { PeriodDomain } from '../../domain';
import { IPeriodRepository } from '../../interfaces';
import { IPeriodConfigRepository } from '../../interfaces';
import { SeedHousePeriodChargesService } from '@/features/payment-management/infrastructure/services';

describe('EnsurePeriodExistsUseCase', () => {
  let useCase: EnsurePeriodExistsUseCase;
  let periodRepository: jest.Mocked<IPeriodRepository>;
  let periodConfigRepository: jest.Mocked<IPeriodConfigRepository>;
  let dataSource: jest.Mocked<DataSource>;
  let seedChargesService: jest.Mocked<SeedHousePeriodChargesService>;

  const mockExistingPeriod = {
    id: 1,
    year: 2025,
    month: 1,
    start_date: new Date('2025-01-01'),
    end_date: new Date('2025-01-31'),
    period_config_id: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockActiveConfig = {
    id: 1,
    default_maintenance_amount: 800,
    is_active: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnsurePeriodExistsUseCase,
        {
          provide: 'IPeriodRepository',
          useValue: {
            findByYearAndMonth: jest.fn(),
          },
        },
        {
          provide: 'IPeriodConfigRepository',
          useValue: {
            findActiveForDate: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            query: jest.fn(),
          },
        },
        {
          provide: SeedHousePeriodChargesService,
          useValue: {
            seedChargesForPeriod: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<EnsurePeriodExistsUseCase>(EnsurePeriodExistsUseCase);
    periodRepository = module.get('IPeriodRepository') as jest.Mocked<IPeriodRepository>;
    periodConfigRepository = module.get('IPeriodConfigRepository') as jest.Mocked<IPeriodConfigRepository>;
    dataSource = module.get(DataSource) as jest.Mocked<DataSource>;
    seedChargesService = module.get(
      SeedHousePeriodChargesService,
    ) as jest.Mocked<SeedHousePeriodChargesService>;

    // Clear cache before each test
    useCase.clearCache();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return existing period if found', async () => {
      periodRepository.findByYearAndMonth.mockResolvedValue(
        mockExistingPeriod as any,
      );

      const result = await useCase.execute(2025, 1);

      expect(periodRepository.findByYearAndMonth).toHaveBeenCalledWith(2025, 1);
      expect(result).toBeInstanceOf(PeriodDomain);
      expect(result.year).toBe(2025);
      expect(result.month).toBe(1);
      expect(dataSource.query).not.toHaveBeenCalled();
      expect(seedChargesService.seedChargesForPeriod).not.toHaveBeenCalled();
    });

    it('should create new period if not found', async () => {
      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockActiveConfig as any,
      );
      dataSource.query.mockResolvedValue([mockExistingPeriod]);

      const result = await useCase.execute(2025, 1);

      expect(periodRepository.findByYearAndMonth).toHaveBeenCalledWith(2025, 1);
      expect(periodConfigRepository.findActiveForDate).toHaveBeenCalled();
      expect(dataSource.query).toHaveBeenCalled();
      expect(seedChargesService.seedChargesForPeriod).toHaveBeenCalledWith(1);
      expect(result).toBeInstanceOf(PeriodDomain);
    });

    it('should use cache for repeated requests', async () => {
      periodRepository.findByYearAndMonth.mockResolvedValue(
        mockExistingPeriod as any,
      );

      // First call
      const result1 = await useCase.execute(2025, 1);
      // Second call (should use cache)
      const result2 = await useCase.execute(2025, 1);

      expect(periodRepository.findByYearAndMonth).toHaveBeenCalledTimes(1);
      expect(result1).toEqual(result2);
    });

    it('should create period without config if no active config found', async () => {
      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(null);
      dataSource.query.mockResolvedValue([
        { ...mockExistingPeriod, period_config_id: null },
      ]);

      const result = await useCase.execute(2025, 1);

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.any(String),
        [2025, 1, null],
      );
      expect(result.periodConfigId).toBeNull();
    });

    it('should handle database query errors', async () => {
      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockActiveConfig as any,
      );
      dataSource.query.mockRejectedValue(new Error('Database error'));

      await expect(useCase.execute(2025, 1)).rejects.toThrow('Database error');
    });

    it('should throw error if period creation fails', async () => {
      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockActiveConfig as any,
      );
      dataSource.query.mockResolvedValue([]);

      await expect(useCase.execute(2025, 1)).rejects.toThrow(
        'Failed to create period 2025-1',
      );
    });

    it('should seed charges after creating period', async () => {
      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockActiveConfig as any,
      );
      dataSource.query.mockResolvedValue([mockExistingPeriod]);

      await useCase.execute(2025, 1);

      expect(seedChargesService.seedChargesForPeriod).toHaveBeenCalledWith(
        mockExistingPeriod.id,
      );
    });

    it('should cache newly created period', async () => {
      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockActiveConfig as any,
      );
      dataSource.query.mockResolvedValue([mockExistingPeriod]);

      // First call creates period
      await useCase.execute(2025, 1);
      // Second call should use cache
      await useCase.execute(2025, 1);

      expect(dataSource.query).toHaveBeenCalledTimes(1);
      expect(seedChargesService.seedChargesForPeriod).toHaveBeenCalledTimes(1);
    });

    it('should handle different year/month combinations separately', async () => {
      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockActiveConfig as any,
      );
      dataSource.query
        .mockResolvedValueOnce([{ ...mockExistingPeriod, id: 1 }])
        .mockResolvedValueOnce([{ ...mockExistingPeriod, id: 2, month: 2 }]);

      await useCase.execute(2025, 1);
      await useCase.execute(2025, 2);

      expect(dataSource.query).toHaveBeenCalledTimes(2);
    });

    it('should clear cache when clearCache is called', async () => {
      periodRepository.findByYearAndMonth.mockResolvedValue(
        mockExistingPeriod as any,
      );

      // First call
      await useCase.execute(2025, 1);
      // Clear cache
      useCase.clearCache();
      // Second call should hit repository again
      await useCase.execute(2025, 1);

      expect(periodRepository.findByYearAndMonth).toHaveBeenCalledTimes(2);
    });
  });
});
