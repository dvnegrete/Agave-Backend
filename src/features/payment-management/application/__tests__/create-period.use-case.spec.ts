import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { CreatePeriodUseCase } from '../create-period.use-case';
import { IPeriodRepository, IPeriodConfigRepository } from '../../interfaces';
import { SeedHousePeriodChargesService } from '../../infrastructure/services/seed-house-period-charges.service';
import { CreatePeriodDto } from '../../dto';
import { Period } from '@/shared/database/entities';

describe('CreatePeriodUseCase', () => {
  let useCase: CreatePeriodUseCase;
  let periodRepository: jest.Mocked<IPeriodRepository>;
  let periodConfigRepository: jest.Mocked<IPeriodConfigRepository>;
  let seedChargesService: jest.Mocked<SeedHousePeriodChargesService>;

  const createMockPeriodEntity = (
    id: number = 1,
    year: number = 2026,
    month: number = 1,
    periodConfigId?: number,
  ) => ({
    id,
    year,
    month,
    // El useCase espera snake_case
    start_date: new Date(year, month - 1, 1),
    end_date: new Date(year, month, 0),
    period_config_id: periodConfigId,
    // Pero también agregamos camelCase para compatibilidad con tests
    startDate: new Date(year, month - 1, 1),
    endDate: new Date(year, month, 0),
    periodConfigId,
    water_active: false,
    extraordinary_fee_active: false,
    created_at: new Date(),
    updated_at: new Date(),
    getDisplayName: () => `Mes ${month} ${year}`,
  } as any);

  const mockPeriodEntity = createMockPeriodEntity(1, 2026, 1, 1);

  const mockPeriodConfig = {
    id: 1,
    is_active: true,
    effective_from: new Date(),
    effective_until: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatePeriodUseCase,
        {
          provide: 'IPeriodRepository',
          useValue: {
            findByYearAndMonth: jest.fn(),
            create: jest.fn(),
            findAll: jest.fn(),
            exists: jest.fn(),
          },
        },
        {
          provide: 'IPeriodConfigRepository',
          useValue: {
            findActiveForDate: jest.fn(),
            findAll: jest.fn(),
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

    useCase = module.get<CreatePeriodUseCase>(CreatePeriodUseCase);
    periodRepository = module.get('IPeriodRepository');
    periodConfigRepository = module.get('IPeriodConfigRepository');
    seedChargesService = module.get(SeedHousePeriodChargesService);
  });

  describe('execute', () => {
    it('should create period successfully with valid data', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 1 };

      periodRepository.exists.mockResolvedValue(false);
      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      periodRepository.create.mockResolvedValue(mockPeriodEntity);
      seedChargesService.seedChargesForPeriod.mockResolvedValue(undefined);

      const result = await useCase.execute(dto);

      expect(result).toBeDefined();
      expect(result.year).toBe(2026);
      expect(result.month).toBe(1);
      expect(periodRepository.create).toHaveBeenCalled();
      expect(seedChargesService.seedChargesForPeriod).toHaveBeenCalledWith(
        mockPeriodEntity.id,
      );
    });

    it('should throw ConflictException if period already exists', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 1 };

      periodRepository.exists.mockResolvedValue(true);

      await expect(useCase.execute(dto)).rejects.toThrow(ConflictException);
      expect(periodRepository.create).not.toHaveBeenCalled();
      expect(seedChargesService.seedChargesForPeriod).not.toHaveBeenCalled();
    });

    it('should create period with active config if exists', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 3 };

      periodRepository.exists.mockResolvedValue(false);
      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      periodRepository.create.mockResolvedValue({
        ...mockPeriodEntity,
        month: 3,
        periodConfigId: 1,
      });
      seedChargesService.seedChargesForPeriod.mockResolvedValue(undefined);

      const result = await useCase.execute(dto);

      expect(result.periodConfigId).toBe(1);
    });

    it('should create period without config if none is active', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 6 };

      periodRepository.exists.mockResolvedValue(false);
      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(null);
      periodRepository.create.mockResolvedValue(createMockPeriodEntity(1, 2026, 6, undefined));
      seedChargesService.seedChargesForPeriod.mockResolvedValue(undefined);

      const result = await useCase.execute(dto);

      expect(result.periodConfigId).toBeUndefined();
      expect(periodRepository.create).toHaveBeenCalled();
    });

    it('should calculate dates correctly for January', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 1 };

      periodRepository.exists.mockResolvedValue(false);
      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      periodRepository.create.mockResolvedValue(createMockPeriodEntity(1, 2026, 1));
      seedChargesService.seedChargesForPeriod.mockResolvedValue(undefined);

      const result = await useCase.execute(dto);

      expect(result.startDate.getMonth()).toBe(0); // January is 0
      expect(result.startDate.getDate()).toBe(1);
    });

    it('should calculate dates correctly for December', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 12 };

      periodRepository.exists.mockResolvedValue(false);
      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      periodRepository.create.mockResolvedValue(createMockPeriodEntity(1, 2026, 12));
      seedChargesService.seedChargesForPeriod.mockResolvedValue(undefined);

      const result = await useCase.execute(dto);

      expect(result.month).toBe(12);
      expect(result.startDate.getMonth()).toBe(11); // December is 11
    });

    it('should trigger seed charges for all houses', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 2 };
      const periodId = 42;

      periodRepository.exists.mockResolvedValue(false);
      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      periodRepository.create.mockResolvedValue(createMockPeriodEntity(periodId, 2026, 2));
      seedChargesService.seedChargesForPeriod.mockResolvedValue(undefined);

      await useCase.execute(dto);

      expect(seedChargesService.seedChargesForPeriod).toHaveBeenCalledWith(
        periodId,
      );
    });

    it('should handle seed charges service error gracefully', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 4 };

      periodRepository.exists.mockResolvedValue(false);
      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      periodRepository.create.mockResolvedValue(createMockPeriodEntity(1, 2026, 4));
      seedChargesService.seedChargesForPeriod.mockRejectedValue(
        new Error('Seed failed'),
      );

      await expect(useCase.execute(dto)).rejects.toThrow('Seed failed');
    });

    it('should validate period does not exist before creating', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 5 };

      periodRepository.exists.mockResolvedValue(false);
      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      periodRepository.create.mockResolvedValue(createMockPeriodEntity(1, 2026, 5));
      seedChargesService.seedChargesForPeriod.mockResolvedValue(undefined);

      const result = await useCase.execute(dto);

      expect(result.month).toBe(5);
    });

    it('should handle boundary months correctly', async () => {
      const months = [1, 6, 12];

      for (const month of months) {
        periodRepository.exists.mockResolvedValue(false);
        periodRepository.findByYearAndMonth.mockResolvedValue(null);
        periodConfigRepository.findActiveForDate.mockResolvedValue(
          mockPeriodConfig as any,
        );
        periodRepository.create.mockResolvedValue(createMockPeriodEntity(1, 2026, month));
        seedChargesService.seedChargesForPeriod.mockResolvedValue(undefined);

        const result = await useCase.execute({ year: 2026, month });
        expect(result.month).toBe(month);
      }
    });

    it('should use year parameter in date calculation', async () => {
      const dto: CreatePeriodDto = { year: 2025, month: 12 };

      periodRepository.exists.mockResolvedValue(false);
      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      periodRepository.create.mockResolvedValue(createMockPeriodEntity(1, 2025, 12));
      seedChargesService.seedChargesForPeriod.mockResolvedValue(undefined);

      const result = await useCase.execute(dto);

      expect(result.year).toBe(2025);
    });

    it('should assign config ID from active config', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 7 };
      const configWithId = { ...mockPeriodConfig, id: 5 };

      periodRepository.exists.mockResolvedValue(false);
      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        configWithId as any,
      );
      periodRepository.create.mockResolvedValue(createMockPeriodEntity(1, 2026, 7, 5));
      seedChargesService.seedChargesForPeriod.mockResolvedValue(undefined);

      const result = await useCase.execute(dto);

      expect(result.periodConfigId).toBe(5);
    });

    it('should return PeriodDomain with all fields', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 8 };

      periodRepository.exists.mockResolvedValue(false);
      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      periodRepository.create.mockResolvedValue(createMockPeriodEntity(1, 2026, 8, 1));
      seedChargesService.seedChargesForPeriod.mockResolvedValue(undefined);

      const result = await useCase.execute(dto);

      expect(result.id).toBeDefined();
      expect(result.year).toBeDefined();
      expect(result.month).toBeDefined();
      expect(result.startDate).toBeDefined();
      expect(result.endDate).toBeDefined();
      expect(result.periodConfigId).toBeDefined();
    });
  });
});
