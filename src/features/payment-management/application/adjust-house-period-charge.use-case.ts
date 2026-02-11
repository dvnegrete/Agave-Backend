import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { HousePeriodCharge } from '@/shared/database/entities';
import { IHousePeriodChargeRepository } from '../interfaces/house-period-charge.repository.interface';
import { IRecordAllocationRepository } from '../interfaces/record-allocation.repository.interface';
import { IPeriodRepository } from '../interfaces/period.repository.interface';
import { ChargeAdjustmentValidatorService } from '../infrastructure/services/charge-adjustment-validator.service';

/**
 * Use case para ajustar (aumentar o disminuir) un cargo de casa-período
 * Permite corregir errores en montos esperados
 */
@Injectable()
export class AdjustHousePeriodChargeUseCase {
  constructor(
    @Inject('IHousePeriodChargeRepository')
    private readonly chargeRepository: IHousePeriodChargeRepository,
    @Inject('IRecordAllocationRepository')
    private readonly allocationRepository: IRecordAllocationRepository,
    @Inject('IPeriodRepository')
    private readonly periodRepository: IPeriodRepository,
    private readonly validator: ChargeAdjustmentValidatorService,
  ) {}

  /**
   * Ajusta el monto esperado de un cargo
   * @param chargeId ID del cargo a ajustar
   * @param newAmount Nuevo monto esperado
   */
  async execute(chargeId: number, newAmount: number): Promise<{
    chargeId: number;
    houseId: number;
    periodId: number;
    conceptType: string;
    previousAmount: number;
    newAmount: number;
    difference: number;
    isPaid: boolean;
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

    // Validar que el ajuste es permitido
    this.validator.validateAdjustment(
      charge.expected_amount,
      newAmount,
      period.month,
      period.year,
    );

    // Si ya hay pagos, no permitir disminuir por debajo de lo pagado
    if (paidAmount > 0 && newAmount < paidAmount) {
      throw new BadRequestException(
        `No se puede reducir el monto por debajo de lo ya pagado. Pagado: $${paidAmount}, Nuevo monto: $${newAmount}`,
      );
    }

    // Realizar el ajuste
    const updatedCharge = await this.chargeRepository.update(chargeId, {
      expected_amount: newAmount,
    });

    const difference = this.validator.calculateAdjustmentDifference(
      charge.expected_amount,
      newAmount,
    );

    return {
      chargeId: updatedCharge.id,
      houseId: updatedCharge.house_id,
      periodId: updatedCharge.period_id,
      conceptType: updatedCharge.concept_type,
      previousAmount: charge.expected_amount,
      newAmount: updatedCharge.expected_amount,
      difference,
      isPaid: paidAmount >= updatedCharge.expected_amount,
    };
  }
}
