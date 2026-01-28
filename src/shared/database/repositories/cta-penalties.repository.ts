import { Injectable } from '@nestjs/common';
import { Repository, QueryRunner } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CtaPenalties } from '../entities/cta-penalties.entity';

export interface CreateCtaPenaltiesDto {
  amount: number;
  period_id?: number;
  description?: string;
}

@Injectable()
export class CtaPenaltiesRepository {
  constructor(
    @InjectRepository(CtaPenalties)
    private repository: Repository<CtaPenalties>,
  ) {}

  /**
   * Crea un nuevo registro en cta_penalties
   * Acepta QueryRunner para transacciones
   */
  async create(
    data: CreateCtaPenaltiesDto,
    queryRunner?: QueryRunner,
  ): Promise<CtaPenalties> {
    const ctaData: Partial<CtaPenalties> = {
      amount: data.amount,
      period_id: data.period_id,
      description: data.description,
    };

    if (queryRunner) {
      const cta = queryRunner.manager.create(CtaPenalties, ctaData);
      return await queryRunner.manager.save(cta);
    }

    const cta = this.repository.create(ctaData);
    return await this.repository.save(cta);
  }

  /**
   * Busca un registro por su ID
   */
  async findById(id: number): Promise<CtaPenalties | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * Busca todos los registros de un período
   */
  async findByPeriodId(periodId: number): Promise<CtaPenalties[]> {
    return this.repository.find({
      where: { period_id: periodId },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Obtiene todos los registros
   */
  async findAll(): Promise<CtaPenalties[]> {
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
