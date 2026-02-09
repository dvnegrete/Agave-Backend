import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PeriodConfigDomain } from '../domain';
import { UpdatePeriodConfigDto } from '../dto';
import { IPeriodConfigRepository } from '../interfaces';

@Injectable()
export class UpdatePeriodConfigUseCase {
  constructor(
    @Inject('IPeriodConfigRepository')
    private readonly periodConfigRepository: IPeriodConfigRepository,
  ) {}

  async execute(
    id: number,
    dto: UpdatePeriodConfigDto,
  ): Promise<PeriodConfigDomain> {
    const existing = await this.periodConfigRepository.findById(id);
    if (!existing) {
      throw new NotFoundException(`PeriodConfig con id ${id} no encontrada`);
    }

    const updateData: Record<string, any> = {};

    if (dto.default_maintenance_amount !== undefined) {
      updateData.default_maintenance_amount = dto.default_maintenance_amount;
    }
    if (dto.default_water_amount !== undefined) {
      updateData.default_water_amount = dto.default_water_amount;
    }
    if (dto.default_extraordinary_fee_amount !== undefined) {
      updateData.default_extraordinary_fee_amount =
        dto.default_extraordinary_fee_amount;
    }
    if (dto.payment_due_day !== undefined) {
      updateData.payment_due_day = dto.payment_due_day;
    }
    if (dto.late_payment_penalty_amount !== undefined) {
      updateData.late_payment_penalty_amount = dto.late_payment_penalty_amount;
    }
    if (dto.effective_from !== undefined) {
      updateData.effective_from = new Date(dto.effective_from);
    }
    if (dto.effective_until !== undefined) {
      updateData.effective_until = new Date(dto.effective_until);
    }
    if (dto.is_active !== undefined) {
      updateData.is_active = dto.is_active;
    }

    if (Object.keys(updateData).length === 0) {
      throw new BadRequestException(
        'Debe proporcionar al menos un campo para actualizar',
      );
    }

    const updated = await this.periodConfigRepository.update(id, updateData);

    return PeriodConfigDomain.create({
      id: updated.id,
      defaultMaintenanceAmount: updated.default_maintenance_amount,
      defaultWaterAmount: updated.default_water_amount,
      defaultExtraordinaryFeeAmount: updated.default_extraordinary_fee_amount,
      paymentDueDay: updated.payment_due_day,
      latePaymentPenaltyAmount: updated.late_payment_penalty_amount,
      effectiveFrom: updated.effective_from,
      effectiveUntil: updated.effective_until,
      isActive: updated.is_active,
    });
  }
}
