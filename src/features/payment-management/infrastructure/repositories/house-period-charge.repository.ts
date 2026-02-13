import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HousePeriodCharge } from '@/shared/database/entities';
import { AllocationConceptType } from '@/shared/database/entities/enums';
import { IHousePeriodChargeRepository } from '../../interfaces/house-period-charge.repository.interface';

@Injectable()
export class HousePeriodChargeRepository
  implements IHousePeriodChargeRepository
{
  constructor(
    @InjectRepository(HousePeriodCharge)
    private readonly repository: Repository<HousePeriodCharge>,
  ) {}

  async findById(id: number): Promise<HousePeriodCharge | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['house', 'period'],
    });
  }

  async findByHouseAndPeriod(
    houseId: number,
    periodId: number,
  ): Promise<HousePeriodCharge[]> {
    return this.repository.find({
      where: { house_id: houseId, period_id: periodId },
      relations: ['house', 'period'],
      order: { concept_type: 'ASC' },
    });
  }

  async findByPeriod(periodId: number): Promise<HousePeriodCharge[]> {
    return this.repository.find({
      where: { period_id: periodId },
      relations: ['house', 'period'],
      order: { house_id: 'ASC', concept_type: 'ASC' },
    });
  }

  async create(charge: Partial<HousePeriodCharge>): Promise<HousePeriodCharge> {
    const entity = this.repository.create(charge);
    return this.repository.save(entity);
  }

  async createBatch(
    charges: Partial<HousePeriodCharge>[],
  ): Promise<HousePeriodCharge[]> {
    const entities = charges.map((c) => this.repository.create(c));
    return this.repository.save(entities);
  }

  async update(
    id: number,
    data: Partial<HousePeriodCharge>,
  ): Promise<HousePeriodCharge> {
    await this.repository.update(id, data);
    const updated = await this.repository.findOne({
      where: { id },
      relations: ['house', 'period'],
    });
    if (!updated) {
      throw new Error(`HousePeriodCharge with id ${id} not found`);
    }
    return updated;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async getTotalExpectedByHousePeriod(
    houseId: number,
    periodId: number,
  ): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('hpc')
      .select('SUM(hpc.expected_amount)', 'total')
      .where('hpc.house_id = :houseId', { houseId })
      .andWhere('hpc.period_id = :periodId', { periodId })
      .getRawOne();

    return result?.total ? parseFloat(result.total) : 0;
  }

  async upsertBatchForPeriods(
    periodIds: number[],
    conceptType: AllocationConceptType,
    expectedAmount: number,
    source: string,
  ): Promise<number> {
    if (periodIds.length === 0) return 0;

    const result = await this.repository.query(
      `INSERT INTO house_period_charges (house_id, period_id, concept_type, expected_amount, source)
       SELECT h.id, p.period_id, $1, $2, $3
       FROM houses h
       CROSS JOIN (SELECT unnest($4::int[]) AS period_id) p
       ON CONFLICT (house_id, period_id, concept_type)
       DO UPDATE SET expected_amount = EXCLUDED.expected_amount, source = EXCLUDED.source, updated_at = NOW()`,
      [conceptType, expectedAmount, source, periodIds],
    );

    return result?.length ?? (result?.rowCount ?? 0);
  }

  async deleteByPeriodsAndConcept(
    periodIds: number[],
    conceptType: AllocationConceptType,
  ): Promise<number> {
    if (periodIds.length === 0) return 0;

    const result = await this.repository.query(
      `DELETE FROM house_period_charges WHERE period_id = ANY($1::int[]) AND concept_type = $2`,
      [periodIds, conceptType],
    );

    return result?.[1] ?? 0;
  }
}
