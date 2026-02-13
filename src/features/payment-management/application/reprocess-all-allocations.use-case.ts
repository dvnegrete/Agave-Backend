import { Injectable, Inject, Logger } from '@nestjs/common';
import { IRecordAllocationRepository, IHouseBalanceRepository } from '../interfaces';
import { ReprocessResultDto } from '../dto';
import { BackfillAllocationsUseCase } from './backfill-allocations.use-case';
import { HouseStatusSnapshotService } from '../infrastructure/services/house-status-snapshot.service';

@Injectable()
export class ReprocessAllAllocationsUseCase {
  private readonly logger = new Logger(ReprocessAllAllocationsUseCase.name);

  constructor(
    @Inject('IRecordAllocationRepository')
    private readonly recordAllocationRepository: IRecordAllocationRepository,
    @Inject('IHouseBalanceRepository')
    private readonly houseBalanceRepository: IHouseBalanceRepository,
    private readonly backfillAllocationsUseCase: BackfillAllocationsUseCase,
    private readonly snapshotService: HouseStatusSnapshotService,
  ) {}

  async execute(): Promise<ReprocessResultDto> {
    this.logger.warn('Starting full reprocess of all allocations');

    // 1. Delete all allocations
    const allocationsDeleted =
      await this.recordAllocationRepository.deleteAll();
    this.logger.log(`Deleted ${allocationsDeleted} allocations`);

    // 2. Reset all balances
    const balancesReset = await this.houseBalanceRepository.resetAll();
    this.logger.log(`Reset ${balancesReset} house balances`);

    // 3. Re-run backfill FIFO for all houses
    const backfillResult = await this.backfillAllocationsUseCase.execute();
    this.logger.log(
      `Backfill complete: ${backfillResult.processed} processed, ${backfillResult.skipped} skipped, ${backfillResult.failed} failed`,
    );

    // 4. Invalidar todos los snapshots
    await this.snapshotService.invalidateAll();
    this.logger.log('All house status snapshots invalidated');

    return {
      allocations_deleted: allocationsDeleted,
      balances_reset: balancesReset,
      backfill_result: {
        total_records_found: backfillResult.total_records_found,
        processed: backfillResult.processed,
        skipped: backfillResult.skipped,
        failed: backfillResult.failed,
      },
    };
  }
}
