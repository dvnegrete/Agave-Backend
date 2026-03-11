import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { IHousePeriodChargeRepository } from '../interfaces/house-period-charge.repository.interface';
import { IRecordAllocationRepository } from '../interfaces/record-allocation.repository.interface';
import { IPeriodRepository } from '../interfaces/period.repository.interface';
import { ChargeAdjustmentValidatorService } from '../infrastructure/services/charge-adjustment-validator.service';
import { HouseStatusSnapshotService } from '../infrastructure/services/house-status-snapshot.service';

/**
 * Use case para reversionar (eliminar) un cargo de casa-período
 * Se usa cuando un cargo fue creado erróneamente y nunca fue pagado
 */
@Injectable()
export class ReverseHousePeriodChargeUseCase {
  constructor(
    @Inject('IHousePeriodChargeRepository')
    private readonly chargeRepository: IHousePeriodChargeRepository,
    @Inject('IRecordAllocationRepository')
    private readonly allocationRepository: IRecordAllocationRepository,
    @Inject('IPeriodRepository')
    private readonly periodRepository: IPeriodRepository,
    private readonly validator: ChargeAdjustmentValidatorService,
    private readonly snapshotService: HouseStatusSnapshotService,
  ) {}

  /**
   * Revierte (elimina) un cargo
   * Solo permite si:
   * 1. No hay pagos asignados al cargo
   * 2. El período no es muy antiguo (menos de 3 meses)
   * @param chargeId ID del cargo a reversionar
   */
  async execute(chargeId: number): Promise<{
    chargeId: number;
    houseId: number;
    periodId: number;
    conceptType: string;
    removedAmount: number;
    message: string;
  }> {
    // Obtener el cargo actual
    const charge = await this.chargeRepository.findById(chargeId);
    if (!charge) {
      throw new NotFoundException(`Charge with ID ${chargeId} not found`);
    }

    // Obtener el período para validación
    const period = await this.periodRepository.findById(charge.period_id);
    if (!period) {
      throw new NotFoundException(
        `Period with ID ${charge.period_id} not found`,
      );
    }

    // Obtener pagos realizados para este cargo
    const allocations = await this.allocationRepository.findByHouseAndPeriod(
      charge.house_id,
      charge.period_id,
    );

    const paidAmount = allocations
      .filter((a) => a.concept_type === charge.concept_type)
      .reduce((sum, a) => sum + a.allocated_amount, 0);

    // Validar que la reversión es permitida
    this.validator.validateReversal(
      charge.expected_amount,
      paidAmount,
      period.month,
      period.year,
    );

    // Eliminar el cargo
    const deleted = await this.chargeRepository.delete(chargeId);

    if (!deleted) {
      throw new BadRequestException(
        `No se pudo eliminar el cargo con ID ${chargeId}`,
      );
    }

    // Invalidar snapshot de la casa
    await this.snapshotService.invalidateByHouseId(charge.house_id);

    return {
      chargeId,
      houseId: charge.house_id,
      periodId: charge.period_id,
      conceptType: charge.concept_type,
      removedAmount: charge.expected_amount,
      message: `Cargo de $${charge.expected_amount} (${charge.concept_type}) ha sido reversado exitosamente para casa ${charge.house_id} en período ${period.year}-${period.month}`,
    };
  }
}
