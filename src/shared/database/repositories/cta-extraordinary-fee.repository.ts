import { Injectable } from '@nestjs/common';
import { Repository, QueryRunner } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CtaExtraordinaryFee } from '../entities/cta-extraordinary-fee.entity';

export interface CreateCtaExtraordinaryFeeDto {
  amount: number;
  period_id: number;
}

@Injectable()
export class CtaExtraordinaryFeeRepository {
  constructor(
    @InjectRepository(CtaExtraordinaryFee)
    private repository: Repository<CtaExtraordinaryFee>,
  ) {}

  /**
   * Crea un nuevo registro en cta_extraordinary_fee
   * Acepta QueryRunner para transacciones
   */
  async create(
    data: CreateCtaExtraordinaryFeeDto,
    queryRunner?: QueryRunner,
  ): Promise<CtaExtraordinaryFee> {
    const ctaData: Partial<CtaExtraordinaryFee> = {
      amount: data.amount,
      period_id: data.period_id,
    };

    if (queryRunner) {
      const cta = queryRunner.manager.create(CtaExtraordinaryFee, ctaData);
      return await queryRunner.manager.save(cta);
    }

    const cta = this.repository.create(ctaData);
    return await this.repository.save(cta);
  }

  /**
   * Busca un registro por su ID
   */
  async findById(id: number): Promise<CtaExtraordinaryFee | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * Busca todos los registros de un período
   */
  async findByPeriodId(periodId: number): Promise<CtaExtraordinaryFee[]> {
    return this.repository.find({
      where: { period_id: periodId },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Obtiene todos los registros
   */
  async findAll(): Promise<CtaExtraordinaryFee[]> {
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
