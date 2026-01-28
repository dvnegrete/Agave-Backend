import { Injectable, Inject } from '@nestjs/common';
import { PeriodConfigDomain } from '../domain';
import { CreatePeriodConfigDto } from '../dto';
import { IPeriodConfigRepository } from '../interfaces';

/**
 * Caso de uso: Crear configuración de período
 * Permite configurar montos default y reglas para rangos de fechas
 */
@Injectable()
export class CreatePeriodConfigUseCase {
  constructor(
    @Inject('IPeriodConfigRepository')
    private readonly periodConfigRepository: IPeriodConfigRepository,
  ) {}

  async execute(dto: CreatePeriodConfigDto): Promise<PeriodConfigDomain> {
    const config = await this.periodConfigRepository.create({
      default_maintenance_amount: dto.default_maintenance_amount,
      default_water_amount: dto.default_water_amount,
      default_extraordinary_fee_amount: dto.default_extraordinary_fee_amount,
      payment_due_day: dto.payment_due_day,
      late_payment_penalty_amount: dto.late_payment_penalty_amount,
      effective_from: new Date(dto.effective_from),
      effective_until: dto.effective_until
        ? new Date(dto.effective_until)
        : undefined,
      is_active: dto.is_active ?? true,
    });

    return PeriodConfigDomain.create({
      id: config.id,
      defaultMaintenanceAmount: config.default_maintenance_amount,
      defaultWaterAmount: config.default_water_amount,
      defaultExtraordinaryFeeAmount: config.default_extraordinary_fee_amount,
      paymentDueDay: config.payment_due_day,
      latePaymentPenaltyAmount: config.late_payment_penalty_amount,
      effectiveFrom: config.effective_from,
      effectiveUntil: config.effective_until,
      isActive: config.is_active,
    });
  }
}
