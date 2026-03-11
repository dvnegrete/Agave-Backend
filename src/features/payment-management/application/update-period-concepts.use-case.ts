import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { IPeriodRepository } from '../interfaces';
import { UpdatePeriodConceptsDto } from '../dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Period } from '@/shared/database/entities';
import { HouseStatusSnapshotService } from '../infrastructure/services/house-status-snapshot.service';

@Injectable()
export class UpdatePeriodConceptsUseCase {
  constructor(
    @Inject('IPeriodRepository')
    private readonly periodRepository: IPeriodRepository,
    @InjectRepository(Period)
    private readonly periodEntityRepository: Repository<Period>,
    private readonly snapshotService: HouseStatusSnapshotService,
  ) {}

  async execute(
    periodId: number,
    dto: UpdatePeriodConceptsDto,
  ): Promise<Period> {
    const period = await this.periodRepository.findById(periodId);
    if (!period) {
      throw new NotFoundException(`Periodo con id ${periodId} no encontrado`);
    }

    if (
      dto.water_active === undefined &&
      dto.extraordinary_fee_active === undefined &&
      dto.payment_due_day === undefined
    ) {
      throw new BadRequestException(
        'Debe proporcionar al menos un campo para actualizar',
      );
    }

    const updateData: Partial<Period> = {};
    if (dto.water_active !== undefined) {
      updateData.water_active = dto.water_active;
    }
    if (dto.extraordinary_fee_active !== undefined) {
      updateData.extraordinary_fee_active = dto.extraordinary_fee_active;
    }
    if (dto.payment_due_day !== undefined) {
      // null = volver a usar el del PeriodConfig
      updateData.payment_due_day = dto.payment_due_day;
    }

    await this.periodEntityRepository.update(periodId, updateData);

    // Invalidar todos los snapshots (afecta todos los periodos)
    await this.snapshotService.invalidateAll();

    const updated = await this.periodRepository.findById(periodId);
    return updated!;
  }
}
