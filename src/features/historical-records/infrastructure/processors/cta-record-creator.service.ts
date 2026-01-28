import { Injectable, Logger } from '@nestjs/common';
import { QueryRunner } from 'typeorm';
import { HistoricalRecordRow } from '../../domain/historical-record-row.entity';
import { CtaMaintenanceRepository } from '@/shared/database/repositories/cta-maintenance.repository';
import { CtaWaterRepository } from '@/shared/database/repositories/cta-water.repository';
import { CtaPenaltiesRepository } from '@/shared/database/repositories/cta-penalties.repository';
import { CtaExtraordinaryFeeRepository } from '@/shared/database/repositories/cta-extraordinary-fee.repository';

/**
 * Interface representing the IDs of created cta_* records
 */
export interface CtaRecordIds {
  cta_extraordinary_fee_id?: number;
  cta_maintence_id?: number;
  cta_penalities_id?: number;
  cta_water_id?: number;
}

/**
 * Service to create cta_* records for a historical row
 * Handles creation of maintenance, water, penalties, and extraordinary fee records
 */
@Injectable()
export class CtaRecordCreatorService {
  private readonly logger = new Logger(CtaRecordCreatorService.name);

  constructor(
    private readonly ctaMaintenanceRepository: CtaMaintenanceRepository,
    private readonly ctaWaterRepository: CtaWaterRepository,
    private readonly ctaPenaltiesRepository: CtaPenaltiesRepository,
    private readonly ctaExtraordinaryFeeRepository: CtaExtraordinaryFeeRepository,
  ) {}

  /**
   * Create all necessary cta_* records and return their IDs
   * Uses QueryRunner for transactional consistency
   * @param row Historical record row to process
   * @param periodId Period ID to associate with cta records
   * @param queryRunner Database query runner for transactions
   * @returns Object with IDs of created cta_* records (empty if no cta_* to create)
   */
  async createCtaRecords(
    row: HistoricalRecordRow,
    periodId: number,
    queryRunner: QueryRunner,
  ): Promise<CtaRecordIds> {
    const ids: CtaRecordIds = {};
    const activeTypes = row.getActiveCtaTypes();

    // If no active cta types (sum = 0), skip cta creation
    // This is valid for registered payments without concept assignment
    if (activeTypes.length === 0) {
      return ids; // Return empty object
    }

    for (const ctaType of activeTypes) {
      try {
        switch (ctaType.type) {
          case 'extraordinary_fee':
            const extraordinaryFee =
              await this.ctaExtraordinaryFeeRepository.create(
                { amount: ctaType.amount, period_id: periodId },
                queryRunner,
              );
            ids.cta_extraordinary_fee_id = extraordinaryFee.id;
            break;

          case 'maintenance':
            const maintenance = await this.ctaMaintenanceRepository.create(
              { amount: ctaType.amount, period_id: periodId },
              queryRunner,
            );
            ids.cta_maintence_id = maintenance.id;
            break;

          case 'penalties':
            const penalties = await this.ctaPenaltiesRepository.create(
              {
                amount: ctaType.amount,
                period_id: periodId,
                description: row.concepto || 'Registro histórico',
              },
              queryRunner,
            );
            ids.cta_penalities_id = penalties.id;
            break;

          case 'water':
            const water = await this.ctaWaterRepository.create(
              { amount: ctaType.amount, period_id: periodId },
              queryRunner,
            );
            ids.cta_water_id = water.id;
            break;
        }
      } catch (error) {
        this.logger.error(
          `Failed to create ${ctaType.type} record: ${error instanceof Error ? error.message : 'Unknown error'}`,
        );
        throw error;
      }
    }

    return ids;
  }
}
