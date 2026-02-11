import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { AllocationConceptType } from '@/shared/database/entities/enums';
import { IHousePeriodChargeRepository } from '../interfaces/house-period-charge.repository.interface';
import { IRecordAllocationRepository } from '../interfaces/record-allocation.repository.interface';
import { IPeriodRepository } from '../interfaces/period.repository.interface';
import { ChargeAdjustmentValidatorService } from '../infrastructure/services/charge-adjustment-validator.service';

/**
 * Use case para condonar (eliminar) penalidades de una casa en un período
 * Se usa como decisión gerencial para perdonar penalidades por deuda anterior
 */
@Injectable()
export class CondonePenaltyUseCase {
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
   * Condona (elimina) una penalidad de una casa en un período
   * Busca el cargo de tipo PENALTIES y lo elimina si aún no ha sido pagado
   * @param houseId ID de la casa
   * @param periodId ID del período
   */
  async execute(houseId: number, periodId: number): Promise<{
    houseId: number;
    periodId: number;
    condonedAmount: number;
    message: string;
  }> {
    // Obtener el período para validación
    const period = await this.periodRepository.findById(periodId);
    if (!period) {
      throw new NotFoundException(`Period with ID ${periodId} not found`);
    }

    // Obtener los cargos de esta casa en este período
    const charges = await this.chargeRepository.findByHouseAndPeriod(
      houseId,
      periodId,
    );

    // Buscar cargo de penalidad
    const penaltyCharge = charges.find(
      (c) => c.concept_type === AllocationConceptType.PENALTIES,
    );

    if (!penaltyCharge) {
      throw new NotFoundException(
        `No penalty charge found for house ${houseId} in period ${periodId}`,
      );
    }

    // Obtener pagos realizados para la penalidad
    const allocations = await this.allocationRepository.findByHouseAndPeriod(
      houseId,
      periodId,
    );

    const paidAmount = allocations
      .filter((a) => a.concept_type === AllocationConceptType.PENALTIES)
      .reduce((sum, a) => sum + a.allocated_amount, 0);

    // Validar que la condonación es permitida
    this.validator.validatePenaltyCondonation(
      penaltyCharge.concept_type,
      paidAmount,
    );

    // Eliminar la penalidad
    const deleted = await this.chargeRepository.delete(penaltyCharge.id);

    if (!deleted) {
      throw new BadRequestException(
        `No se pudo eliminar la penalidad con ID ${penaltyCharge.id}`,
      );
    }

    return {
      houseId,
      periodId,
      condonedAmount: penaltyCharge.expected_amount,
      message: `Penalidad de $${penaltyCharge.expected_amount} ha sido condonada para casa ${houseId} en período ${period.year}-${period.month}`,
    };
  }

  /**
   * Condona penalidades para múltiples casas en un período (condonación masiva)
   * Útil para decisiones gerenciales que aplican a varias casas
   * @param periodId ID del período
   * @param houseIds IDs de las casas (si está vacío, aplica a todas)
   */
  async executeMultiple(
    periodId: number,
    houseIds?: number[],
  ): Promise<{
    periodId: number;
    totalCondonedAmount: number;
    condoneCount: number;
    failureCount: number;
    details: Array<{
      houseId: number;
      condonedAmount: number;
      status: 'success' | 'failed';
      reason?: string;
    }>;
  }> {
    // Obtener el período
    const period = await this.periodRepository.findById(periodId);
    if (!period) {
      throw new NotFoundException(`Period with ID ${periodId} not found`);
    }

    // Si no se especifican casas, obtener todas con penalidades en este período
    let targetHouseIds = houseIds;
    if (!targetHouseIds || targetHouseIds.length === 0) {
      const charges = await this.chargeRepository.findByPeriod(periodId);
      const housesWithPenalties = charges
        .filter((c) => c.concept_type === AllocationConceptType.PENALTIES)
        .map((c) => c.house_id);

      targetHouseIds = [...new Set(housesWithPenalties)]; // Eliminar duplicados
    }

    const details: Array<{
      houseId: number;
      condonedAmount: number;
      status: 'success' | 'failed';
      reason?: string;
    }> = [];
    let totalCondonedAmount = 0;
    let condoneCount = 0;
    let failureCount = 0;

    for (const houseId of targetHouseIds) {
      try {
        const result = await this.execute(houseId, periodId);
        details.push({
          houseId,
          condonedAmount: result.condonedAmount,
          status: 'success',
        });
        totalCondonedAmount += result.condonedAmount;
        condoneCount++;
      } catch (error) {
        details.push({
          houseId,
          condonedAmount: 0,
          status: 'failed',
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
        failureCount++;
      }
    }

    return {
      periodId,
      totalCondonedAmount,
      condoneCount,
      failureCount,
      details,
    };
  }
}
