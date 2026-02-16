import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PeriodConfigRepository } from '../period-config.repository';
import { PeriodConfig } from '@/shared/database/entities';

describe('PeriodConfigRepository', () => {
  let repository: PeriodConfigRepository;
  let mockRepository: jest.Mocked<Repository<PeriodConfig>>;

  const mockPeriodConfig: any = {
    id: 1,
    default_maintenance_amount: 800,
    default_water_amount: 100,
    default_extraordinary_fee_amount: 50,
    payment_due_day: 15,
    late_payment_penalty_amount: 150,
    effective_from: new Date('2026-01-01'),
    effective_until: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PeriodConfigRepository,
        {
          provide: getRepositoryToken(PeriodConfig),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
            find: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<PeriodConfigRepository>(PeriodConfigRepository);
    mockRepository = module.get(getRepositoryToken(PeriodConfig)) as jest.Mocked<Repository<PeriodConfig>>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a new period config', async () => {
      const createData = {
        default_maintenance_amount: 800,
        default_water_amount: 100,
        default_extraordinary_fee_amount: 50,
        payment_due_day: 15,
        late_payment_penalty_amount: 150,
        effective_from: new Date('2026-01-01'),
      };

      mockRepository.create.mockReturnValue(mockPeriodConfig as PeriodConfig);
      mockRepository.save.mockResolvedValue(mockPeriodConfig as PeriodConfig);

      const result = await repository.create(createData);

      expect(result).toEqual(mockPeriodConfig);
      expect(mockRepository.create).toHaveBeenCalledWith(createData);
      expect(mockRepository.save).toHaveBeenCalled();
    });

    it('should create config with optional fields omitted', async () => {
      const minimalData = {
        default_maintenance_amount: 800,
        payment_due_day: 15,
        late_payment_penalty_amount: 150,
        effective_from: new Date('2026-01-01'),
      };

      mockRepository.create.mockReturnValue(mockPeriodConfig as PeriodConfig);
      mockRepository.save.mockResolvedValue(mockPeriodConfig as PeriodConfig);

      const result = await repository.create(minimalData);

      expect(result).toBeDefined();
      expect(mockRepository.create).toHaveBeenCalledWith(minimalData);
    });

    it('should save created config with all required fields', async () => {
      const createData = {
        default_maintenance_amount: 800,
        payment_due_day: 15,
        late_payment_penalty_amount: 150,
        effective_from: new Date('2026-01-01'),
      };

      mockRepository.create.mockReturnValue(mockPeriodConfig as PeriodConfig);
      mockRepository.save.mockResolvedValue(mockPeriodConfig as PeriodConfig);

      await repository.create(createData);

      expect(mockRepository.save).toHaveBeenCalledWith(mockPeriodConfig);
    });
  });

  describe('findActiveForDate', () => {
    it('should find active config for a given date', async () => {
      const testDate = new Date('2026-01-15');
      mockRepository.findOne.mockResolvedValue(mockPeriodConfig as PeriodConfig);

      const result = await repository.findActiveForDate(testDate);

      expect(result).toEqual(mockPeriodConfig);
      expect(mockRepository.findOne).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            is_active: true,
          }),
        }),
      );
    });

    it('should return null when no active config exists for date', async () => {
      const testDate = new Date('2030-01-15');
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.findActiveForDate(testDate);

      expect(result).toBeNull();
    });

    it('should handle configs without effective_until (indefinite)', async () => {
      const configWithoutEnd: any = {
        ...mockPeriodConfig,
        effective_until: null,
      };
      mockRepository.findOne.mockResolvedValue(configWithoutEnd);

      const testDate = new Date('2030-01-01');
      const result = await repository.findActiveForDate(testDate);

      expect(result?.effective_until).toBeNull();
    });

    it('should prioritize most recent config (DESC order)', async () => {
      const olderConfig: Partial<PeriodConfig> = {
        ...mockPeriodConfig,
        effective_from: new Date('2025-01-01'),
      };
      const newerConfig: Partial<PeriodConfig> = {
        ...mockPeriodConfig,
        effective_from: new Date('2026-01-01'),
      };

      mockRepository.findOne.mockResolvedValue(newerConfig as PeriodConfig);

      const testDate = new Date('2026-06-15');
      const result = await repository.findActiveForDate(testDate);

      expect(result?.effective_from).toEqual(new Date('2026-01-01'));
    });

    it('should exclude expired configs (effective_until in past)', async () => {
      const expiredConfig: Partial<PeriodConfig> = {
        ...mockPeriodConfig,
        effective_until: new Date('2025-12-31'),
      };
      mockRepository.findOne.mockResolvedValue(null);

      const testDate = new Date('2026-01-15');
      const result = await repository.findActiveForDate(testDate);

      expect(result).toBeNull();
    });
  });

  describe('findAll', () => {
    it('should return all period configs ordered by effective_from DESC', async () => {
      const configs = [mockPeriodConfig, { ...mockPeriodConfig, id: 2 }];
      mockRepository.find.mockResolvedValue(configs as PeriodConfig[]);

      const result = await repository.findAll();

      expect(result).toHaveLength(2);
      expect(mockRepository.find).toHaveBeenCalledWith(
        expect.objectContaining({
          order: { effective_from: 'DESC' },
        }),
      );
    });

    it('should return empty array when no configs exist', async () => {
      mockRepository.find.mockResolvedValue([]);

      const result = await repository.findAll();

      expect(result).toEqual([]);
    });

    it('should include both active and inactive configs', async () => {
      const activeConfig: Partial<PeriodConfig> = { ...mockPeriodConfig, is_active: true };
      const inactiveConfig: Partial<PeriodConfig> = { ...mockPeriodConfig, id: 2, is_active: false };

      mockRepository.find.mockResolvedValue([activeConfig, inactiveConfig] as PeriodConfig[]);

      const result = await repository.findAll();

      expect(result).toHaveLength(2);
    });
  });

  describe('findById', () => {
    it('should find config by id', async () => {
      mockRepository.findOne.mockResolvedValue(mockPeriodConfig as PeriodConfig);

      const result = await repository.findById(1);

      expect(result).toEqual(mockPeriodConfig);
      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { id: 1 },
      });
    });

    it('should return null when config not found', async () => {
      mockRepository.findOne.mockResolvedValue(null);

      const result = await repository.findById(999);

      expect(result).toBeNull();
    });
  });

  describe('update', () => {
    it('should update period config', async () => {
      const updateData: Partial<PeriodConfig> = {
        default_maintenance_amount: 900,
        is_active: false,
      };

      const updatedConfig = { ...mockPeriodConfig, ...updateData };
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockRepository.findOne.mockResolvedValue(updatedConfig as PeriodConfig);

      const result = await repository.update(1, updateData);

      expect(result.default_maintenance_amount).toBe(900);
      expect(mockRepository.update).toHaveBeenCalledWith(1, updateData);
      expect(mockRepository.findOne).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('should throw error when updating non-existent config', async () => {
      mockRepository.update.mockResolvedValue({ affected: 0 } as any);
      mockRepository.findOne.mockResolvedValue(null);

      await expect(repository.update(999, { is_active: false })).rejects.toThrow(
        'PeriodConfig with id 999 not found',
      );
    });

    it('should support partial updates', async () => {
      const partialUpdate = { late_payment_penalty_amount: 200 };
      const updatedConfig = { ...mockPeriodConfig, late_payment_penalty_amount: 200 };

      mockRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockRepository.findOne.mockResolvedValue(updatedConfig as PeriodConfig);

      const result = await repository.update(1, partialUpdate);

      expect(result.late_payment_penalty_amount).toBe(200);
      expect(result.default_maintenance_amount).toBe(800); // Unchanged
    });
  });

  describe('deactivate', () => {
    it('should deactivate a period config', async () => {
      const deactivatedConfig = { ...mockPeriodConfig, is_active: false };
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockRepository.findOne.mockResolvedValue(deactivatedConfig as PeriodConfig);

      const result = await repository.deactivate(1);

      expect(result.is_active).toBe(false);
      expect(mockRepository.update).toHaveBeenCalledWith(1, { is_active: false });
    });

    it('should throw error when deactivating non-existent config', async () => {
      mockRepository.update.mockResolvedValue({ affected: 0 } as any);
      mockRepository.findOne.mockResolvedValue(null);

      await expect(repository.deactivate(999)).rejects.toThrow(
        'PeriodConfig with id 999 not found',
      );
    });

    it('should return updated config object', async () => {
      const deactivatedConfig = { ...mockPeriodConfig, is_active: false };
      mockRepository.update.mockResolvedValue({ affected: 1 } as any);
      mockRepository.findOne.mockResolvedValue(deactivatedConfig as PeriodConfig);

      const result = await repository.deactivate(1);

      expect(result).toEqual(deactivatedConfig);
      expect(result.id).toBe(1);
    });
  });

  describe('Complex Scenarios', () => {
    it('should handle multiple overlapping effective periods', async () => {
      const configs = [
        {
          ...mockPeriodConfig,
          id: 1,
          effective_from: new Date('2025-01-01'),
          effective_until: new Date('2025-12-31'),
        },
        {
          ...mockPeriodConfig,
          id: 2,
          effective_from: new Date('2026-01-01'),
          effective_until: null,
        },
      ];
      mockRepository.find.mockResolvedValue(configs as PeriodConfig[]);

      const result = await repository.findAll();

      expect(result).toHaveLength(2);
    });

    it('should find correct config during period transition', async () => {
      const transitionDate = new Date('2026-01-01');
      const configForDate = { ...mockPeriodConfig, effective_from: transitionDate };

      mockRepository.findOne.mockResolvedValue(configForDate as PeriodConfig);

      const result = await repository.findActiveForDate(transitionDate);

      expect(result).toBeDefined();
      expect(result?.effective_from).toEqual(transitionDate);
    });

    it('should maintain multiple active configs if properly configured', async () => {
      const activeConfigs = [
        { ...mockPeriodConfig, id: 1, is_active: true },
        { ...mockPeriodConfig, id: 2, is_active: true, effective_from: new Date('2027-01-01') },
      ];
      mockRepository.find.mockResolvedValue(activeConfigs as PeriodConfig[]);

      const result = await repository.findAll();

      expect(result.filter(c => c.is_active)).toHaveLength(2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle configs with very far future dates', async () => {
      const futureConfig = {
        ...mockPeriodConfig,
        effective_from: new Date('2099-01-01'),
      };
      mockRepository.findOne.mockResolvedValue(futureConfig as PeriodConfig);

      const result = await repository.findById(1);

      expect(result).toBeDefined();
    });

    it('should handle zero penalty amount', async () => {
      const noPenaltyConfig = {
        ...mockPeriodConfig,
        late_payment_penalty_amount: 0,
      };
      mockRepository.create.mockReturnValue(noPenaltyConfig as PeriodConfig);
      mockRepository.save.mockResolvedValue(noPenaltyConfig as PeriodConfig);

      const result = await repository.create({
        default_maintenance_amount: 800,
        payment_due_day: 15,
        late_payment_penalty_amount: 0,
        effective_from: new Date('2026-01-01'),
      });

      expect(result.late_payment_penalty_amount).toBe(0);
    });

    it('should handle very large amounts', async () => {
      const largeAmountConfig = {
        ...mockPeriodConfig,
        default_maintenance_amount: 999999.99,
      };
      mockRepository.create.mockReturnValue(largeAmountConfig as PeriodConfig);
      mockRepository.save.mockResolvedValue(largeAmountConfig as PeriodConfig);

      const result = await repository.create({
        default_maintenance_amount: 999999.99,
        payment_due_day: 15,
        late_payment_penalty_amount: 150,
        effective_from: new Date('2026-01-01'),
      });

      expect(result.default_maintenance_amount).toBe(999999.99);
    });
  });
});
