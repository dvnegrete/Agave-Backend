import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { IHousePeriodChargeRepository } from '../interfaces/house-period-charge.repository.interface';
import { IPeriodRepository } from '../interfaces/period.repository.interface';
import { HouseStatusSnapshotService } from '../infrastructure/services/house-status-snapshot.service';
import { InitialDebtDto } from '../dto/admin-operations.dto';
import { formatMonthName } from '@/shared/common/utils/date';

export interface InitialDebtResult {
  house_id: number;
  period_id: number;
  period_display_name: string;
  concept_type: string;
  amount: number;
  previous_amount: number;
  action: 'created' | 'updated';
  message: string;
}

/**
 * Use case para registrar deuda inicial de una casa en un período específico.
 * Hace upsert de un house_period_charge con source='manual' para el trío
 * (house_id, period_id, concept_type). El cargo aparecerá como morosidad en
 * GET /houses/:houseId/status si no hay allocations que lo cubran.
 */
@Injectable()
export class SetInitialDebtUseCase {
  constructor(
    @Inject('IHousePeriodChargeRepository')
    private readonly chargeRepository: IHousePeriodChargeRepository,
    @Inject('IPeriodRepository')
    private readonly periodRepository: IPeriodRepository,
    private readonly snapshotService: HouseStatusSnapshotService,
  ) {}

  async execute(houseId: number, dto: InitialDebtDto): Promise<InitialDebtResult> {
    // 1. Verificar que el período exista
    const period = await this.periodRepository.findById(dto.period_id);
    if (!period) {
      throw new NotFoundException(`Período con ID ${dto.period_id} no encontrado`);
    }

    // 2. Buscar cargo existente para la combinación house/period/concept
    const existingCharges = await this.chargeRepository.findByHouseAndPeriod(
      houseId,
      dto.period_id,
    );
    const existingCharge = existingCharges.find(
      (c) => c.concept_type === dto.concept_type,
    );

    let action: 'created' | 'updated';
    let previousAmount: number;

    if (existingCharge) {
      // Actualizar cargo existente
      previousAmount = existingCharge.expected_amount;
      await this.chargeRepository.update(existingCharge.id, {
        expected_amount: dto.amount,
        source: 'manual',
      });
      action = 'updated';
    } else {
      // Crear nuevo cargo
      previousAmount = 0;
      await this.chargeRepository.create({
        house_id: houseId,
        period_id: dto.period_id,
        concept_type: dto.concept_type,
        expected_amount: dto.amount,
        source: 'manual',
      });
      action = 'created';
    }

    // 3. Invalidar snapshot de la casa para que el siguiente GET /status recalcule
    await this.snapshotService.invalidateByHouseId(houseId);

    const periodDisplayName = formatMonthName(period.month, period.year);

    return {
      house_id: houseId,
      period_id: dto.period_id,
      period_display_name: periodDisplayName,
      concept_type: dto.concept_type,
      amount: dto.amount,
      previous_amount: previousAmount,
      action,
      message:
        action === 'created'
          ? `Deuda inicial de $${dto.amount} registrada para ${periodDisplayName}`
          : `Deuda inicial actualizada de $${previousAmount} a $${dto.amount} para ${periodDisplayName}`,
    };
  }
}
