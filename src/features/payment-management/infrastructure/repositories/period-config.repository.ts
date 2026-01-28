import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThanOrEqual, MoreThanOrEqual, IsNull, Or } from 'typeorm';
import { PeriodConfig } from '@/shared/database/entities';
import { IPeriodConfigRepository } from '../../interfaces';

@Injectable()
export class PeriodConfigRepository implements IPeriodConfigRepository {
  constructor(
    @InjectRepository(PeriodConfig)
    private readonly repository: Repository<PeriodConfig>,
  ) {}

  async create(data: {
    default_maintenance_amount: number;
    default_water_amount?: number;
    default_extraordinary_fee_amount?: number;
    payment_due_day: number;
    late_payment_penalty_amount: number;
    effective_from: Date;
    effective_until?: Date;
    is_active?: boolean;
  }): Promise<PeriodConfig> {
    const config = this.repository.create(data);
    return this.repository.save(config);
  }

  async findActiveForDate(date: Date): Promise<PeriodConfig | null> {
    return this.repository.findOne({
      where: {
        is_active: true,
        effective_from: LessThanOrEqual(date),
        effective_until: Or(MoreThanOrEqual(date), IsNull()),
      },
      order: { effective_from: 'DESC' },
    });
  }

  async findAll(): Promise<PeriodConfig[]> {
    return this.repository.find({ order: { effective_from: 'DESC' } });
  }

  async findById(id: number): Promise<PeriodConfig | null> {
    return this.repository.findOne({ where: { id } });
  }

  async update(
    id: number,
    data: Partial<PeriodConfig>,
  ): Promise<PeriodConfig> {
    await this.repository.update(id, data);
    const result = await this.repository.findOne({ where: { id } });
    if (!result) {
      throw new Error(`PeriodConfig with id ${id} not found`);
    }
    return result;
  }

  async deactivate(id: number): Promise<PeriodConfig> {
    await this.repository.update(id, { is_active: false });
    const result = await this.repository.findOne({ where: { id } });
    if (!result) {
      throw new Error(`PeriodConfig with id ${id} not found`);
    }
    return result;
  }
}
