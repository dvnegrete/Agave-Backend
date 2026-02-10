import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HousePeriodOverride } from '@/shared/database/entities';
import { ConceptType } from '@/shared/database/entities/enums';
import { HousePeriodOverrideRepository } from '../house-period-override.repository';

describe('HousePeriodOverrideRepository', () => {
  let repository: HousePeriodOverrideRepository;
  let typeormRepository: Repository<HousePeriodOverride>;

  const mockOverride = {
    id: 1,
    house_id: 42,
    period_id: 1,
    concept_type: ConceptType.MAINTENANCE,
    custom_amount: 50000,
    reason: 'Convenio de pago',
    created_at: new Date(),
    updated_at: new Date(),
    house: null,
    period: null,
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HousePeriodOverrideRepository,
        {
          provide: getRepositoryToken(HousePeriodOverride),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<HousePeriodOverrideRepository>(
      HousePeriodOverrideRepository,
    );
    typeormRepository = module.get<Repository<HousePeriodOverride>>(
      getRepositoryToken(HousePeriodOverride),
    );
  });

  describe('findByHouseAndPeriod', () => {
    it('should find overrides for a house in a specific period', async () => {
      const overrides = [mockOverride];
      jest.spyOn(typeormRepository, 'find').mockResolvedValue(overrides);

      const result = await repository.findByHouseAndPeriod(42, 1);

      expect(result).toEqual(overrides);
      expect(typeormRepository.find).toHaveBeenCalledWith({
        where: { house_id: 42, period_id: 1 },
        relations: ['house', 'period'],
        order: { concept_type: 'ASC' },
      });
    });

    it('should return empty array when no overrides found', async () => {
      jest.spyOn(typeormRepository, 'find').mockResolvedValue([]);

      const result = await repository.findByHouseAndPeriod(999, 999);

      expect(result).toEqual([]);
    });
  });

  describe('findByHousePeriodAndConcept', () => {
    it('should find override for a specific house, period and concept', async () => {
      jest.spyOn(typeormRepository, 'findOne').mockResolvedValue(mockOverride);

      const result = await repository.findByHousePeriodAndConcept(
        42,
        1,
        ConceptType.MAINTENANCE,
      );

      expect(result).toEqual(mockOverride);
      expect(typeormRepository.findOne).toHaveBeenCalledWith({
        where: {
          house_id: 42,
          period_id: 1,
          concept_type: ConceptType.MAINTENANCE,
        },
        relations: ['house', 'period'],
      });
    });

    it('should return null when override not found', async () => {
      jest.spyOn(typeormRepository, 'findOne').mockResolvedValue(null);

      const result = await repository.findByHousePeriodAndConcept(
        999,
        999,
        ConceptType.WATER,
      );

      expect(result).toBeNull();
    });
  });

  describe('findByHouseId', () => {
    it('should find all overrides for a house', async () => {
      const overrides = [mockOverride];
      jest.spyOn(typeormRepository, 'find').mockResolvedValue(overrides);

      const result = await repository.findByHouseId(42);

      expect(result).toEqual(overrides);
      expect(typeormRepository.find).toHaveBeenCalledWith({
        where: { house_id: 42 },
        relations: ['house', 'period'],
        order: { period_id: 'DESC', concept_type: 'ASC' },
      });
    });
  });

  describe('findByPeriodId', () => {
    it('should find all overrides for a period', async () => {
      const overrides = [mockOverride];
      jest.spyOn(typeormRepository, 'find').mockResolvedValue(overrides);

      const result = await repository.findByPeriodId(1);

      expect(result).toEqual(overrides);
      expect(typeormRepository.find).toHaveBeenCalledWith({
        where: { period_id: 1 },
        relations: ['house', 'period'],
        order: { house_id: 'ASC', concept_type: 'ASC' },
      });
    });
  });

  describe('create', () => {
    it('should create a new override', async () => {
      const partialOverride: Partial<HousePeriodOverride> = {
        house_id: 42,
        period_id: 1,
        concept_type: ConceptType.MAINTENANCE,
        custom_amount: 50000,
        reason: 'Convenio de pago',
      };

      jest.spyOn(typeormRepository, 'create').mockReturnValue(mockOverride);
      jest.spyOn(typeormRepository, 'save').mockResolvedValue(mockOverride);

      const result = await repository.create(partialOverride);

      expect(result).toEqual(mockOverride);
      expect(typeormRepository.create).toHaveBeenCalledWith(partialOverride);
    });
  });

  describe('update', () => {
    it('should update an override', async () => {
      const updatedOverride = { ...mockOverride, custom_amount: 60000 };

      jest.spyOn(typeormRepository, 'update').mockResolvedValue({} as any);
      jest
        .spyOn(typeormRepository, 'findOne')
        .mockResolvedValue(updatedOverride);

      const result = await repository.update(1, { custom_amount: 60000 });

      expect(result.custom_amount).toBe(60000);
      expect(typeormRepository.update).toHaveBeenCalledWith(1, {
        custom_amount: 60000,
      });
    });

    it('should throw error if override not found', async () => {
      jest.spyOn(typeormRepository, 'update').mockResolvedValue({} as any);
      jest.spyOn(typeormRepository, 'findOne').mockResolvedValue(null);

      await expect(
        repository.update(999, { custom_amount: 60000 }),
      ).rejects.toThrow();
    });
  });

  describe('getApplicableAmount', () => {
    it('should return override amount if exists', async () => {
      jest.spyOn(typeormRepository, 'findOne').mockResolvedValue(mockOverride);

      const result = await repository.getApplicableAmount(
        42,
        1,
        ConceptType.MAINTENANCE,
        100000,
      );

      expect(result).toBe(50000);
    });

    it('should return global amount if override does not exist', async () => {
      jest.spyOn(typeormRepository, 'findOne').mockResolvedValue(null);

      const result = await repository.getApplicableAmount(
        42,
        1,
        ConceptType.WATER,
        100000,
      );

      expect(result).toBe(100000);
    });
  });

  describe('delete', () => {
    it('should delete an override', async () => {
      jest
        .spyOn(typeormRepository, 'delete')
        .mockResolvedValue({ affected: 1 } as any);

      const result = await repository.delete(1);

      expect(result).toBe(true);
    });

    it('should return false when override not found', async () => {
      jest
        .spyOn(typeormRepository, 'delete')
        .mockResolvedValue({ affected: 0 } as any);

      const result = await repository.delete(999);

      expect(result).toBe(false);
    });
  });
});
