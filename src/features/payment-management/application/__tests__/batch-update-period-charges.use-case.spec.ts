import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { BatchUpdatePeriodChargesUseCase } from '../batch-update-period-charges.use-case';
import { IHousePeriodChargeRepository } from '../../interfaces';
import { EnsurePeriodExistsUseCase } from '../ensure-period-exists.use-case';
import { HouseStatusSnapshotService } from '../../infrastructure/services/house-status-snapshot.service';
import { AllocationConceptType } from '@/shared/database/entities/enums';

describe('BatchUpdatePeriodChargesUseCase', () => {
  let useCase: BatchUpdatePeriodChargesUseCase;
  let chargeRepository: jest.Mocked<IHousePeriodChargeRepository>;
  let ensurePeriodExistsUseCase: jest.Mocked<EnsurePeriodExistsUseCase>;
  let dataSource: jest.Mocked<DataSource>;
  let snapshotService: jest.Mocked<HouseStatusSnapshotService>;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    query: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      create: jest.fn(),
      save: jest.fn(),
    },
  };

  const mockPeriod = {
    id: 1,
    year: 2026,
    month: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BatchUpdatePeriodChargesUseCase,
        {
          provide: 'IHousePeriodChargeRepository',
          useValue: {
            upsertBatchForPeriods: jest.fn(),
            deleteByPeriodsAndConcept: jest.fn(),
          },
        },
        {
          provide: EnsurePeriodExistsUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
            query: jest.fn(),
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

    useCase = module.get<BatchUpdatePeriodChargesUseCase>(
      BatchUpdatePeriodChargesUseCase,
    );
    chargeRepository = module.get('IHousePeriodChargeRepository');
    ensurePeriodExistsUseCase = module.get(EnsurePeriodExistsUseCase);
    dataSource = module.get(DataSource);
    snapshotService = module.get(HouseStatusSnapshotService);
  });

  describe('execute', () => {
    it('should update batch charges for single month successfully', async () => {
      const dto = {
        start_year: 2026,
        start_month: 1,
        end_year: 2026,
        end_month: 1,
        amounts: {
          maintenance_amount: 800,
          water_amount: 100,
        },
      };

      dataSource.query.mockResolvedValue([{ id: 1 }]);
      ensurePeriodExistsUseCase.execute.mockResolvedValue(mockPeriod as any);
      chargeRepository.upsertBatchForPeriods.mockResolvedValue(66);
      mockQueryRunner.query.mockResolvedValue(undefined);
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);

      const result = await useCase.execute(dto);

      expect(result).toBeDefined();
      expect(result.periods_affected).toBe(1);
      expect(result.charges_updated).toBeGreaterThan(0);
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should update multiple periods across months', async () => {
      const dto = {
        start_year: 2026,
        start_month: 1,
        end_year: 2026,
        end_month: 3,
        amounts: {
          maintenance_amount: 800,
          water_amount: 100,
        },
      };

      dataSource.query.mockResolvedValue([{ id: 1 }]);
      ensurePeriodExistsUseCase.execute.mockResolvedValue(mockPeriod as any);
      chargeRepository.upsertBatchForPeriods.mockResolvedValue(66);
      mockQueryRunner.query.mockResolvedValue(undefined);
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);

      const result = await useCase.execute(dto);

      expect(result.periods_affected).toBe(3); // Jan, Feb, Mar
    });

    it('should handle year boundary (Dec to Jan)', async () => {
      const dto = {
        start_year: 2025,
        start_month: 12,
        end_year: 2026,
        end_month: 1,
        amounts: {
          maintenance_amount: 800,
        },
      };

      dataSource.query.mockResolvedValue([]);
      ensurePeriodExistsUseCase.execute.mockResolvedValue(mockPeriod as any);
      chargeRepository.upsertBatchForPeriods.mockResolvedValue(66);
      mockQueryRunner.query.mockResolvedValue(undefined);
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);

      const result = await useCase.execute(dto);

      expect(result.periods_affected).toBe(2);
    });

    it('should throw BadRequestException for invalid date range', async () => {
      const dto = {
        start_year: 2026,
        start_month: 3,
        end_year: 2026,
        end_month: 1,
        amounts: {
          maintenance_amount: 800,
        },
      };

      await expect(useCase.execute(dto)).rejects.toThrow(BadRequestException);
    });

    it('should enable water_active flag when water_amount > 0', async () => {
      const dto = {
        start_year: 2026,
        start_month: 1,
        end_year: 2026,
        end_month: 1,
        amounts: {
          maintenance_amount: 800,
          water_amount: 50,
        },
      };

      dataSource.query.mockResolvedValue([]);
      ensurePeriodExistsUseCase.execute.mockResolvedValue(mockPeriod as any);
      chargeRepository.upsertBatchForPeriods.mockResolvedValue(66);
      mockQueryRunner.query.mockResolvedValue(undefined);
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);

      await useCase.execute(dto);

      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining('water_active = $1'),
        expect.arrayContaining([true]),
      );
    });

    it('should disable water when water_amount is 0 and delete charges', async () => {
      const dto = {
        start_year: 2026,
        start_month: 1,
        end_year: 2026,
        end_month: 1,
        amounts: {
          maintenance_amount: 800,
          water_amount: 0,
        },
      };

      dataSource.query.mockResolvedValue([]);
      ensurePeriodExistsUseCase.execute.mockResolvedValue(mockPeriod as any);
      chargeRepository.upsertBatchForPeriods.mockResolvedValue(66);
      chargeRepository.deleteByPeriodsAndConcept.mockResolvedValue(66);
      mockQueryRunner.query.mockResolvedValue(undefined);
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);

      await useCase.execute(dto);

      expect(chargeRepository.deleteByPeriodsAndConcept).toHaveBeenCalledWith(
        [1],
        AllocationConceptType.WATER,
      );
    });

    it('should detect retroactive changes when allocations exist', async () => {
      const dto = {
        start_year: 2026,
        start_month: 1,
        end_year: 2026,
        end_month: 1,
        amounts: {
          maintenance_amount: 900, // Changed from 800
        },
      };

      dataSource.query.mockResolvedValue([]);
      ensurePeriodExistsUseCase.execute.mockResolvedValue(mockPeriod as any);
      chargeRepository.upsertBatchForPeriods.mockResolvedValue(66);
      mockQueryRunner.query.mockResolvedValueOnce(undefined);
      mockQueryRunner.query.mockResolvedValueOnce([
        { has_allocations: true },
      ]); // Check query
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);

      const result = await useCase.execute(dto);

      expect(result.has_retroactive_changes).toBe(true);
    });

    it('should handle rollback on transaction error', async () => {
      const dto = {
        start_year: 2026,
        start_month: 1,
        end_year: 2026,
        end_month: 1,
        amounts: {
          maintenance_amount: 800,
        },
      };

      dataSource.query.mockResolvedValue([]);
      ensurePeriodExistsUseCase.execute.mockRejectedValue(
        new Error('Period error'),
      );

      await expect(useCase.execute(dto)).rejects.toThrow();
      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should invalidate all snapshots after successful update', async () => {
      const dto = {
        start_year: 2026,
        start_month: 1,
        end_year: 2026,
        end_month: 1,
        amounts: {
          maintenance_amount: 800,
        },
      };

      dataSource.query.mockResolvedValue([]);
      ensurePeriodExistsUseCase.execute.mockResolvedValue(mockPeriod as any);
      chargeRepository.upsertBatchForPeriods.mockResolvedValue(66);
      mockQueryRunner.query.mockResolvedValue(undefined);
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
      snapshotService.invalidateAll.mockResolvedValue(undefined);

      await useCase.execute(dto);

      expect(snapshotService.invalidateAll).toHaveBeenCalled();
    });

    it('should handle months > 12 correctly by incrementing year', async () => {
      const dto = {
        start_year: 2025,
        start_month: 11,
        end_year: 2026,
        end_month: 2,
        amounts: {
          maintenance_amount: 800,
        },
      };

      dataSource.query.mockResolvedValue([]);
      ensurePeriodExistsUseCase.execute.mockResolvedValue(mockPeriod as any);
      chargeRepository.upsertBatchForPeriods.mockResolvedValue(66);
      mockQueryRunner.query.mockResolvedValue(undefined);
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);

      const result = await useCase.execute(dto);

      // Nov 2025, Dec 2025, Jan 2026, Feb 2026
      expect(result.periods_affected).toBe(4);
    });

    it('should return correct BatchUpdateResultDto structure', async () => {
      const dto = {
        start_year: 2026,
        start_month: 1,
        end_year: 2026,
        end_month: 1,
        amounts: {
          maintenance_amount: 800,
        },
      };

      dataSource.query.mockResolvedValue([]);
      ensurePeriodExistsUseCase.execute.mockResolvedValue(mockPeriod as any);
      chargeRepository.upsertBatchForPeriods.mockResolvedValue(66);
      mockQueryRunner.query.mockResolvedValue(undefined);
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);

      const result = await useCase.execute(dto);

      expect(result).toHaveProperty('periods_affected');
      expect(result).toHaveProperty('periods_created');
      expect(result).toHaveProperty('charges_updated');
      expect(result).toHaveProperty('has_retroactive_changes');
    });
  });
});
