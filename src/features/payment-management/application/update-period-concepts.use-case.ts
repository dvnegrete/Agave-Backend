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

@Injectable()
export class UpdatePeriodConceptsUseCase {
  constructor(
    @Inject('IPeriodRepository')
    private readonly periodRepository: IPeriodRepository,
    @InjectRepository(Period)
    private readonly periodEntityRepository: Repository<Period>,
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
      dto.extraordinary_fee_active === undefined
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

    await this.periodEntityRepository.update(periodId, updateData);

    const updated = await this.periodRepository.findById(periodId);
    return updated!;
  }
}
