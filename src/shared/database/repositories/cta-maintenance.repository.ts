import { Injectable } from '@nestjs/common';
import { Repository, QueryRunner } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { CtaMaintenance } from '../entities/cta-maintenance.entity';

export interface CreateCtaMaintenanceDto {
  amount: number;
  period_id: number;
}

@Injectable()
export class CtaMaintenanceRepository {
  constructor(
    @InjectRepository(CtaMaintenance)
    private repository: Repository<CtaMaintenance>,
  ) {}

  /**
   * Crea un nuevo registro en cta_maintenance
   * Acepta QueryRunner para transacciones
   */
  async create(
    data: CreateCtaMaintenanceDto,
    queryRunner?: QueryRunner,
  ): Promise<CtaMaintenance> {
    const ctaData: Partial<CtaMaintenance> = {
      amount: data.amount,
      period_id: data.period_id,
    };

    if (queryRunner) {
      const cta = queryRunner.manager.create(CtaMaintenance, ctaData);
      return await queryRunner.manager.save(cta);
    }

    const cta = this.repository.create(ctaData);
    return await this.repository.save(cta);
  }

  /**
   * Busca un registro por su ID
   */
  async findById(id: number): Promise<CtaMaintenance | null> {
    return this.repository.findOne({ where: { id } });
  }

  /**
   * Busca todos los registros de un período
   */
  async findByPeriodId(periodId: number): Promise<CtaMaintenance[]> {
    return this.repository.find({
      where: { period_id: periodId },
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Obtiene todos los registros
   */
  async findAll(): Promise<CtaMaintenance[]> {
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
