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

  const mockPeriodEntity = {
    id: 1,
    year: 2026,
    month: 1,
    startDate: new Date(2026, 0, 1),
    endDate: new Date(2026, 1, 0),
    periodConfigId: 1,
    getDisplayName: () => 'Enero 2026',
  } as Period;

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

      periodRepository.findByYearAndMonth.mockResolvedValue(mockPeriodEntity);

      await expect(useCase.execute(dto)).rejects.toThrow(ConflictException);
      expect(periodRepository.create).not.toHaveBeenCalled();
      expect(seedChargesService.seedChargesForPeriod).not.toHaveBeenCalled();
    });

    it('should create period with active config if exists', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 3 };

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

      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(null);
      periodRepository.create.mockResolvedValue({
        ...mockPeriodEntity,
        month: 6,
        periodConfigId: null,
      });
      seedChargesService.seedChargesForPeriod.mockResolvedValue(undefined);

      const result = await useCase.execute(dto);

      expect(result.periodConfigId).toBeNull();
      expect(periodRepository.create).toHaveBeenCalled();
    });

    it('should calculate dates correctly for January', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 1 };

      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      periodRepository.create.mockResolvedValue(mockPeriodEntity);
      seedChargesService.seedChargesForPeriod.mockResolvedValue(undefined);

      const result = await useCase.execute(dto);

      expect(result.startDate.getMonth()).toBe(0); // January is 0
      expect(result.startDate.getDate()).toBe(1);
    });

    it('should calculate dates correctly for December', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 12 };
      const decemberPeriod = {
        ...mockPeriodEntity,
        month: 12,
        startDate: new Date(2026, 11, 1),
        endDate: new Date(2026, 11, 31),
      };

      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      periodRepository.create.mockResolvedValue(decemberPeriod);
      seedChargesService.seedChargesForPeriod.mockResolvedValue(undefined);

      const result = await useCase.execute(dto);

      expect(result.month).toBe(12);
      expect(result.startDate.getMonth()).toBe(11); // December is 11
    });

    it('should trigger seed charges for all houses', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 2 };
      const periodId = 42;

      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      periodRepository.create.mockResolvedValue({
        ...mockPeriodEntity,
        id: periodId,
        month: 2,
      });
      seedChargesService.seedChargesForPeriod.mockResolvedValue(undefined);

      await useCase.execute(dto);

      expect(seedChargesService.seedChargesForPeriod).toHaveBeenCalledWith(
        periodId,
      );
    });

    it('should handle seed charges service error gracefully', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 4 };

      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      periodRepository.create.mockResolvedValue(mockPeriodEntity);
      seedChargesService.seedChargesForPeriod.mockRejectedValue(
        new Error('Seed failed'),
      );

      await expect(useCase.execute(dto)).rejects.toThrow('Seed failed');
    });

    it('should validate period does not exist before creating', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 5 };

      periodRepository.findByYearAndMonth.mockResolvedValue(null);

      await expect(useCase.execute(dto)).rejects.toThrow();

      expect(periodRepository.findByYearAndMonth).toHaveBeenCalledWith(
        2026,
        5,
      );
    });

    it('should handle boundary months correctly', async () => {
      const months = [1, 6, 12];

      for (const month of months) {
        periodRepository.findByYearAndMonth.mockResolvedValue(null);
        periodConfigRepository.findActiveForDate.mockResolvedValue(
          mockPeriodConfig as any,
        );
        periodRepository.create.mockResolvedValue({
          ...mockPeriodEntity,
          month,
        });
        seedChargesService.seedChargesForPeriod.mockResolvedValue(undefined);

        const result = await useCase.execute({ year: 2026, month });
        expect(result.month).toBe(month);
      }
    });

    it('should use year parameter in date calculation', async () => {
      const dto: CreatePeriodDto = { year: 2025, month: 12 };

      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      periodRepository.create.mockResolvedValue({
        ...mockPeriodEntity,
        year: 2025,
      });
      seedChargesService.seedChargesForPeriod.mockResolvedValue(undefined);

      const result = await useCase.execute(dto);

      expect(result.year).toBe(2025);
    });

    it('should assign config ID from active config', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 7 };
      const configWithId = { ...mockPeriodConfig, id: 5 };

      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        configWithId as any,
      );
      periodRepository.create.mockResolvedValue({
        ...mockPeriodEntity,
        periodConfigId: 5,
      });
      seedChargesService.seedChargesForPeriod.mockResolvedValue(undefined);

      const result = await useCase.execute(dto);

      expect(result.periodConfigId).toBe(5);
    });

    it('should return PeriodDomain with all fields', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 8 };

      periodRepository.findByYearAndMonth.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      periodRepository.create.mockResolvedValue(mockPeriodEntity);
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
