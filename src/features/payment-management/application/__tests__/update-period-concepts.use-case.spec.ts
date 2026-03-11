import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { UpdatePeriodConceptsUseCase } from '../update-period-concepts.use-case';
import { IPeriodRepository } from '../../interfaces';
import { HouseStatusSnapshotService } from '../../infrastructure/services/house-status-snapshot.service';
import { Period } from '@/shared/database/entities';
import { getRepositoryToken } from '@nestjs/typeorm';

describe('UpdatePeriodConceptsUseCase', () => {
  let useCase: UpdatePeriodConceptsUseCase;
  let periodRepository: jest.Mocked<IPeriodRepository>;
  let periodEntityRepository: jest.Mocked<Repository<Period>>;
  let snapshotService: jest.Mocked<HouseStatusSnapshotService>;

  const mockPeriod = {
    id: 1,
    year: 2026,
    month: 1,
    water_active: false,
    extraordinary_fee_active: false,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UpdatePeriodConceptsUseCase,
        {
          provide: 'IPeriodRepository',
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Period),
          useValue: {
            update: jest.fn(),
          },
        },
        {
          provide: HouseStatusSnapshotService,
          useValue: {
            invalidateAll: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<UpdatePeriodConceptsUseCase>(UpdatePeriodConceptsUseCase);
    periodRepository = module.get('IPeriodRepository');
    periodEntityRepository = module.get(getRepositoryToken(Period));
    snapshotService = module.get(HouseStatusSnapshotService);
  });

  describe('execute', () => {
    it('should enable water concept successfully', async () => {
      const periodId = 1;
      const dto = { water_active: true };

      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      periodEntityRepository.update.mockResolvedValue({ affected: 1 } as any);
      periodRepository.findById.mockResolvedValueOnce(mockPeriod as any);
      periodRepository.findById.mockResolvedValueOnce({
        ...mockPeriod,
        water_active: true,
      } as any);
      snapshotService.invalidateAll.mockResolvedValue(undefined);

      const result = await useCase.execute(periodId, dto);

      expect(result).toBeDefined();
      expect(periodEntityRepository.update).toHaveBeenCalledWith(periodId, {
        water_active: true,
      });
      expect(snapshotService.invalidateAll).toHaveBeenCalled();
    });

    it('should enable extraordinary fee concept successfully', async () => {
      const periodId = 1;
      const dto = { extraordinary_fee_active: true };

      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      periodEntityRepository.update.mockResolvedValue({ affected: 1 } as any);
      periodRepository.findById.mockResolvedValueOnce(mockPeriod as any);
      periodRepository.findById.mockResolvedValueOnce({
        ...mockPeriod,
        extraordinary_fee_active: true,
      } as any);
      snapshotService.invalidateAll.mockResolvedValue(undefined);

      const result = await useCase.execute(periodId, dto);

      expect(result).toBeDefined();
      expect(periodEntityRepository.update).toHaveBeenCalledWith(periodId, {
        extraordinary_fee_active: true,
      });
    });

    it('should update both water and extraordinary fee', async () => {
      const periodId = 1;
      const dto = { water_active: true, extraordinary_fee_active: true };

      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      periodEntityRepository.update.mockResolvedValue({ affected: 1 } as any);
      periodRepository.findById.mockResolvedValueOnce(mockPeriod as any);
      periodRepository.findById.mockResolvedValueOnce({
        ...mockPeriod,
        water_active: true,
        extraordinary_fee_active: true,
      } as any);
      snapshotService.invalidateAll.mockResolvedValue(undefined);

      const result = await useCase.execute(periodId, dto);

      expect(result).toBeDefined();
      expect(periodEntityRepository.update).toHaveBeenCalledWith(periodId, {
        water_active: true,
        extraordinary_fee_active: true,
      });
    });

    it('should disable water concept', async () => {
      const periodId = 1;
      const dto = { water_active: false };

      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      periodEntityRepository.update.mockResolvedValue({ affected: 1 } as any);
      periodRepository.findById.mockResolvedValueOnce(mockPeriod as any);
      periodRepository.findById.mockResolvedValueOnce(mockPeriod as any);
      snapshotService.invalidateAll.mockResolvedValue(undefined);

      const result = await useCase.execute(periodId, dto);

      expect(result).toBeDefined();
      expect(periodEntityRepository.update).toHaveBeenCalledWith(periodId, {
        water_active: false,
      });
    });

    it('should throw NotFoundException if period not found', async () => {
      periodRepository.findById.mockResolvedValue(null);

      await expect(
        useCase.execute(1, { water_active: true }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if no fields to update', async () => {
      const periodId = 1;
      const dto = {};

      periodRepository.findById.mockResolvedValue(mockPeriod as any);

      await expect(useCase.execute(periodId, dto as any)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should invalidate all snapshots after update', async () => {
      const periodId = 1;
      const dto = { water_active: true };

      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      periodEntityRepository.update.mockResolvedValue({ affected: 1 } as any);
      periodRepository.findById.mockResolvedValueOnce(mockPeriod as any);
      periodRepository.findById.mockResolvedValueOnce(mockPeriod as any);
      snapshotService.invalidateAll.mockResolvedValue(undefined);

      await useCase.execute(periodId, dto);

      expect(snapshotService.invalidateAll).toHaveBeenCalled();
    });

    it('should return updated Period entity', async () => {
      const periodId = 1;
      const dto = { water_active: true };
      const updatedPeriod = { ...mockPeriod, water_active: true };

      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      periodEntityRepository.update.mockResolvedValue({ affected: 1 } as any);
      periodRepository.findById.mockResolvedValueOnce(mockPeriod as any);
      periodRepository.findById.mockResolvedValueOnce(updatedPeriod as any);
      snapshotService.invalidateAll.mockResolvedValue(undefined);

      const result = await useCase.execute(periodId, dto);

      expect(result.id).toBe(1);
      expect(result.water_active).toBe(true);
    });

    it('should handle undefined water_active (no update)', async () => {
      const periodId = 1;
      const dto = { extraordinary_fee_active: true };

      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      periodEntityRepository.update.mockResolvedValue({ affected: 1 } as any);
      periodRepository.findById.mockResolvedValueOnce(mockPeriod as any);
      periodRepository.findById.mockResolvedValueOnce(mockPeriod as any);
      snapshotService.invalidateAll.mockResolvedValue(undefined);

      await useCase.execute(periodId, dto);

      expect(periodEntityRepository.update).toHaveBeenCalledWith(periodId, {
        extraordinary_fee_active: true,
      });
    });
  });
});
