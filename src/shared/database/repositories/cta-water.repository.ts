import { Injectable } from '@nestjs/common';
import { Repository, QueryRunner } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CtaWater } from '../entities/cta-water.entity';

export interface CreateCtaWaterDto {
  amount: number;
  period_id: number;
}

@Injectable()
export class CtaWaterRepository {
  constructor(
    @InjectRepository(CtaWater)
    private repository: Repository<CtaWater>,
  ) {}

  /**
   * Crea un nuevo registro en cta_water
   * Acepta QueryRunner para transacciones
   */
  async create(
    data: CreateCtaWaterDto,
    queryRunner?: QueryRunner,
  ): Promise<CtaWater> {
    const ctaData: Partial<CtaWater> = {
      amount: data.amount,
      period_id: data.period_id,
    };

    if (queryRunner) {
      const cta = queryRunner.manager.create(CtaWater, ctaData);
      return await queryRunner.manager.save(cta);
    }

    const cta = this.repository.create(ctaData);
    return await this.repository.save(cta);
  }

  /**
   * Busca un registro por su ID
   */
  async findById(id: number): Promise<CtaWater | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * Busca todos los registros de un período
   */
  async findByPeriodId(periodId: number): Promise<CtaWater[]> {
    return this.repository.find({
      where: { period_id: periodId },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Obtiene todos los registros
   */
  async findAll(): Promise<CtaWater[]> {
    return this.repository.find({
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Elimina un registro por su ID
   */
  async delete(id: number): Promise<void> {
    await this.repository.delete(id);
  }
}
