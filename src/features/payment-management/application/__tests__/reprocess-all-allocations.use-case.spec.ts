import { Test, TestingModule } from '@nestjs/testing';
import { ReprocessAllAllocationsUseCase } from '../reprocess-all-allocations.use-case';
import {
  IRecordAllocationRepository,
  IHouseBalanceRepository,
} from '../../interfaces';
import { BackfillAllocationsUseCase } from '../backfill-allocations.use-case';
import { HouseStatusSnapshotService } from '../../infrastructure/services/house-status-snapshot.service';

describe('ReprocessAllAllocationsUseCase', () => {
  let useCase: ReprocessAllAllocationsUseCase;
  let recordAllocationRepository: jest.Mocked<IRecordAllocationRepository>;
  let houseBalanceRepository: jest.Mocked<IHouseBalanceRepository>;
  let backfillAllocationsUseCase: jest.Mocked<BackfillAllocationsUseCase>;
  let snapshotService: jest.Mocked<HouseStatusSnapshotService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReprocessAllAllocationsUseCase,
        {
          provide: 'IRecordAllocationRepository',
          useValue: {
            deleteAll: jest.fn(),
          },
        },
        {
          provide: 'IHouseBalanceRepository',
          useValue: {
            resetAll: jest.fn(),
          },
        },
        {
          provide: BackfillAllocationsUseCase,
          useValue: {
            execute: jest.fn(),
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

    useCase = module.get<ReprocessAllAllocationsUseCase>(
      ReprocessAllAllocationsUseCase,
    );
    recordAllocationRepository = module.get('IRecordAllocationRepository');
    houseBalanceRepository = module.get('IHouseBalanceRepository');
    backfillAllocationsUseCase = module.get(BackfillAllocationsUseCase);
    snapshotService = module.get(HouseStatusSnapshotService);
  });

  describe('execute', () => {
    it('should perform full reprocess successfully', async () => {
      const backfillResult = {
        total_records_found: 500,
        processed: 450,
        skipped: 30,
        failed: 20,
      };

      recordAllocationRepository.deleteAll.mockResolvedValue(450);
      houseBalanceRepository.resetAll.mockResolvedValue(66);
      backfillAllocationsUseCase.execute.mockResolvedValue(backfillResult as any);
      snapshotService.invalidateAll.mockResolvedValue(undefined);

      const result = await useCase.execute();

      expect(result).toBeDefined();
      expect(result.allocations_deleted).toBe(450);
      expect(result.balances_reset).toBe(66);
      expect(result.backfill_result.processed).toBe(450);
    });

    it('should delete all allocations first', async () => {
      const backfillResult = {
        total_records_found: 100,
        processed: 100,
        skipped: 0,
        failed: 0,
      };

      recordAllocationRepository.deleteAll.mockResolvedValue(100);
      houseBalanceRepository.resetAll.mockResolvedValue(66);
      backfillAllocationsUseCase.execute.mockResolvedValue(backfillResult as any);
      snapshotService.invalidateAll.mockResolvedValue(undefined);

      await useCase.execute();

      expect(recordAllocationRepository.deleteAll).toHaveBeenCalled();
    });

    it('should reset all house balances', async () => {
      const backfillResult = {
        total_records_found: 100,
        processed: 100,
        skipped: 0,
        failed: 0,
      };

      recordAllocationRepository.deleteAll.mockResolvedValue(100);
      houseBalanceRepository.resetAll.mockResolvedValue(66);
      backfillAllocationsUseCase.execute.mockResolvedValue(backfillResult as any);
      snapshotService.invalidateAll.mockResolvedValue(undefined);

      await useCase.execute();

      expect(houseBalanceRepository.resetAll).toHaveBeenCalled();
    });

    it('should run backfill after deletion and reset', async () => {
      const backfillResult = {
        total_records_found: 150,
        processed: 145,
        skipped: 5,
        failed: 0,
      };

      recordAllocationRepository.deleteAll.mockResolvedValue(100);
      houseBalanceRepository.resetAll.mockResolvedValue(66);
      backfillAllocationsUseCase.execute.mockResolvedValue(backfillResult as any);
      snapshotService.invalidateAll.mockResolvedValue(undefined);

      await useCase.execute();

      expect(backfillAllocationsUseCase.execute).toHaveBeenCalled();
    });

    it('should handle case with no allocations to delete', async () => {
      const backfillResult = {
        total_records_found: 0,
        processed: 0,
        skipped: 0,
        failed: 0,
      };

      recordAllocationRepository.deleteAll.mockResolvedValue(0);
      houseBalanceRepository.resetAll.mockResolvedValue(66);
      backfillAllocationsUseCase.execute.mockResolvedValue(backfillResult as any);
      snapshotService.invalidateAll.mockResolvedValue(undefined);

      const result = await useCase.execute();

      expect(result.allocations_deleted).toBe(0);
      expect(result.backfill_result.total_records_found).toBe(0);
    });

    it('should invalidate all snapshots after reprocess', async () => {
      const backfillResult = {
        total_records_found: 100,
        processed: 100,
        skipped: 0,
        failed: 0,
      };

      recordAllocationRepository.deleteAll.mockResolvedValue(100);
      houseBalanceRepository.resetAll.mockResolvedValue(66);
      backfillAllocationsUseCase.execute.mockResolvedValue(backfillResult as any);
      snapshotService.invalidateAll.mockResolvedValue(undefined);

      await useCase.execute();

      expect(snapshotService.invalidateAll).toHaveBeenCalled();
    });

    it('should return correct ReprocessResultDto structure', async () => {
      const backfillResult = {
        total_records_found: 500,
        processed: 450,
        skipped: 30,
        failed: 20,
      };

      recordAllocationRepository.deleteAll.mockResolvedValue(450);
      houseBalanceRepository.resetAll.mockResolvedValue(66);
      backfillAllocationsUseCase.execute.mockResolvedValue(backfillResult as any);
      snapshotService.invalidateAll.mockResolvedValue(undefined);

      const result = await useCase.execute();

      expect(result).toHaveProperty('allocations_deleted');
      expect(result).toHaveProperty('balances_reset');
      expect(result).toHaveProperty('backfill_result');
      expect(result.backfill_result).toHaveProperty('total_records_found');
      expect(result.backfill_result).toHaveProperty('processed');
      expect(result.backfill_result).toHaveProperty('skipped');
      expect(result.backfill_result).toHaveProperty('failed');
    });

    it('should handle backfill with failures', async () => {
      const backfillResult = {
        total_records_found: 1000,
        processed: 950,
        skipped: 40,
        failed: 10,
      };

      recordAllocationRepository.deleteAll.mockResolvedValue(1000);
      houseBalanceRepository.resetAll.mockResolvedValue(66);
      backfillAllocationsUseCase.execute.mockResolvedValue(backfillResult as any);
      snapshotService.invalidateAll.mockResolvedValue(undefined);

      const result = await useCase.execute();

      expect(result.backfill_result.failed).toBe(10);
      expect(result.backfill_result.processed).toBe(950);
    });

    it('should handle large-scale reprocessing', async () => {
      const backfillResult = {
        total_records_found: 10000,
        processed: 9800,
        skipped: 150,
        failed: 50,
      };

      recordAllocationRepository.deleteAll.mockResolvedValue(10000);
      houseBalanceRepository.resetAll.mockResolvedValue(66);
      backfillAllocationsUseCase.execute.mockResolvedValue(backfillResult as any);
      snapshotService.invalidateAll.mockResolvedValue(undefined);

      const result = await useCase.execute();

      expect(result.allocations_deleted).toBe(10000);
      expect(result.backfill_result.processed).toBe(9800);
    });

    it('should maintain data consistency across operations', async () => {
      const backfillResult = {
        total_records_found: 300,
        processed: 300,
        skipped: 0,
        failed: 0,
      };

      recordAllocationRepository.deleteAll.mockResolvedValue(300);
      houseBalanceRepository.resetAll.mockResolvedValue(66);
      backfillAllocationsUseCase.execute.mockResolvedValue(backfillResult as any);
      snapshotService.invalidateAll.mockResolvedValue(undefined);

      const result = await useCase.execute();

      // Verify all operations were called
      expect(recordAllocationRepository.deleteAll).toHaveBeenCalled();
      expect(houseBalanceRepository.resetAll).toHaveBeenCalled();
      expect(backfillAllocationsUseCase.execute).toHaveBeenCalled();
    });
  });
});
