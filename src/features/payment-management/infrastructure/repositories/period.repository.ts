import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Period } from '@/shared/database/entities';
import { IPeriodRepository } from '../../interfaces';

@Injectable()
export class PeriodRepository implements IPeriodRepository {
  constructor(
    @InjectRepository(Period)
    private readonly repository: Repository<Period>,
  ) {}

  async create(
    year: number,
    month: number,
    configId?: number,
  ): Promise<Period> {
    const period = this.repository.create({
      year,
      month,
      period_config_id: configId,
    });
    return this.repository.save(period);
  }

  async findByYearAndMonth(
    year: number,
    month: number,
  ): Promise<Period | null> {
    return this.repository.findOne({ where: { year, month } });
  }

  async findAll(): Promise<Period[]> {
    return this.repository.find({ order: { year: 'DESC', month: 'DESC' } });
  }

  async findById(id: number): Promise<Period | null> {
    return this.repository.findOne({ where: { id } });
  }

  async findByIdWithRelations(id: number): Promise<Period | null> {
    return this.repository.findOne({
      where: { id },
      relations: [
        'periodConfig',
        'maintenances',
        'waters',
        'extraordinaryFees',
        'penalties',
      ],
    });
  }

  async exists(year: number, month: number): Promise<boolean> {
    const count = await this.repository.count({ where: { year, month } });
    return count > 0;
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async findFromDate(year: number, month: number): Promise<Period[]> {
    return this.repository
      .createQueryBuilder('p')
      .where('(p.year > :year OR (p.year = :year AND p.month >= :month))', {
        year,
        month,
      })
      .orderBy('p.year', 'ASC')
      .addOrderBy('p.month', 'ASC')
      .getMany();
  }
}
