import { Injectable } from '@nestjs/common';
import { Repository, QueryRunner } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Record } from '../entities/record.entity';

export interface CreateRecordDto {
  vouchers_id: number;
  transaction_status_id?: number | null;
  cta_extraordinary_fee_id?: number | null;
  cta_maintence_id?: number | null;
  cta_penalities_id?: number | null;
  cta_water_id?: number | null;
  cta_other_payments_id?: number | null;
}

@Injectable()
export class RecordRepository {
  constructor(
    @InjectRepository(Record)
    private recordRepository: Repository<Record>,
  ) {}

  /**
   * Crea un nuevo record en la base de datos
   */
  async create(data: CreateRecordDto, queryRunner?: QueryRunner): Promise<Record> {
    const recordData: Partial<Record> = {
      vouchers_id: data.vouchers_id,
      transaction_status_id: data.transaction_status_id ?? null,
      cta_extraordinary_fee_id: data.cta_extraordinary_fee_id ?? null,
      cta_maintence_id: data.cta_maintence_id ?? null,
      cta_penalities_id: data.cta_penalities_id ?? null,
      cta_water_id: data.cta_water_id ?? null,
      cta_other_payments_id: data.cta_other_payments_id ?? null,
    };

    if (queryRunner) {
      const record = queryRunner.manager.create(Record, recordData);
      return await queryRunner.manager.save(record);
    }

    const record = this.recordRepository.create(recordData);
    return await this.recordRepository.save(record);
  }

  /**
   * Busca un record por su ID
   */
  async findById(id: number): Promise<Record | null> {
    return this.recordRepository.findOne({ where: { id } });
  }

  /**
   * Obtiene todos los records con relaciones
   */
  async findAll(): Promise<Record[]> {
    return this.recordRepository.find({
      relations: ['voucher', 'transactionStatus', 'houseRecords'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Actualiza un record por su ID
   */
  async update(id: number, data: Partial<CreateRecordDto>): Promise<Record> {
    await this.recordRepository.update(id, data);
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`Record con ID ${id} no encontrado`);
    }
    return updated;
  }

  /**
   * Elimina un record por su ID
   */
  async delete(id: number): Promise<void> {
    await this.recordRepository.delete(id);
  }
}
