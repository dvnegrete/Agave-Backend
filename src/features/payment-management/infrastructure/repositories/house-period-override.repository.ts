import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HousePeriodOverride } from '@/shared/database/entities';
import { ConceptType } from '@/shared/database/entities/enums';
import { IHousePeriodOverrideRepository } from '../../interfaces/house-period-override.repository.interface';

@Injectable()
export class HousePeriodOverrideRepository
  implements IHousePeriodOverrideRepository
{
  constructor(
    @InjectRepository(HousePeriodOverride)
    private readonly repository: Repository<HousePeriodOverride>,
  ) {}

  async findByHouseAndPeriod(
    houseId: number,
    periodId: number,
  ): Promise<HousePeriodOverride[]> {
    return this.repository.find({
      where: { house_id: houseId, period_id: periodId },
      relations: ['house', 'period'],
      order: { concept_type: 'ASC' },
    });
  }

  async findByHousePeriodAndConcept(
    houseId: number,
    periodId: number,
    conceptType: ConceptType,
  ): Promise<HousePeriodOverride | null> {
    return this.repository.findOne({
      where: {
        house_id: houseId,
        period_id: periodId,
        concept_type: conceptType,
      },
      relations: ['house', 'period'],
    });
  }

  async findByHouseId(houseId: number): Promise<HousePeriodOverride[]> {
    return this.repository.find({
      where: { house_id: houseId },
      relations: ['house', 'period'],
      order: { period_id: 'DESC', concept_type: 'ASC' },
    });
  }

  async findByPeriodId(periodId: number): Promise<HousePeriodOverride[]> {
    return this.repository.find({
      where: { period_id: periodId },
      relations: ['house', 'period'],
      order: { house_id: 'ASC', concept_type: 'ASC' },
    });
  }

  async create(
    override: Partial<HousePeriodOverride>,
  ): Promise<HousePeriodOverride> {
    const entity = this.repository.create(override);
    return this.repository.save(entity);
  }

  async update(
    id: number,
    override: Partial<HousePeriodOverride>,
  ): Promise<HousePeriodOverride> {
    await this.repository.update(id, override);
    const updated = await this.repository.findOne({
      where: { id },
      relations: ['house', 'period'],
    });
    if (!updated) {
      throw new Error(`HousePeriodOverride with id ${id} not found`);
    }
    return updated;
  }

  async findById(id: number): Promise<HousePeriodOverride | null> {
    return this.repository.findOne({
      where: { id },
    });
  }

  async findByIdWithRelations(id: number): Promise<HousePeriodOverride | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['house', 'period'],
    });
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async getApplicableAmount(
    houseId: number,
    periodId: number,
    conceptType: ConceptType,
    globalAmount: number,
  ): Promise<number> {
    const override = await this.findByHousePeriodAndConcept(
      houseId,
      periodId,
      conceptType,
    );
    return override?.custom_amount ?? globalAmount;
  }
}
