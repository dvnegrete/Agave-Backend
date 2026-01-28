import { Injectable } from '@nestjs/common';
import { Repository, QueryRunner } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Record } from '../entities/record.entity';

export interface CreateRecordDto {
  vouchers_id?: number | null;
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
  async create(
    data: CreateRecordDto,
    queryRunner?: QueryRunner,
  ): Promise<Record> {
    const recordData: Partial<Record> = {
      vouchers_id: data.vouchers_id ?? undefined,
      transaction_status_id: data.transaction_status_id ?? undefined,
      cta_extraordinary_fee_id: data.cta_extraordinary_fee_id ?? undefined,
      cta_maintence_id: data.cta_maintence_id ?? undefined,
      cta_penalities_id: data.cta_penalities_id ?? undefined,
      cta_water_id: data.cta_water_id ?? undefined,
      cta_other_payments_id: data.cta_other_payments_id ?? undefined,
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
   * Busca records por voucher ID
   */
  async findByVoucherId(voucherId: number): Promise<Record[]> {
    return this.recordRepository.find({
      where: { vouchers_id: voucherId },
      relations: ['houseRecords'],
    });
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
    const updateData: any = {};
    if (data.vouchers_id !== undefined)
      updateData.vouchers_id = data.vouchers_id;
    if (data.transaction_status_id !== undefined)
      updateData.transaction_status_id = data.transaction_status_id;
    if (data.cta_extraordinary_fee_id !== undefined)
      updateData.cta_extraordinary_fee_id = data.cta_extraordinary_fee_id;
    if (data.cta_maintence_id !== undefined)
      updateData.cta_maintence_id = data.cta_maintence_id;
    if (data.cta_penalities_id !== undefined)
      updateData.cta_penalities_id = data.cta_penalities_id;
    if (data.cta_water_id !== undefined)
      updateData.cta_water_id = data.cta_water_id;
    if (data.cta_other_payments_id !== undefined)
      updateData.cta_other_payments_id = data.cta_other_payments_id;

    await this.recordRepository.update(id, updateData);
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

  /**
   * Obtiene todos los records (históricos) asociados a una casa
   * Utiliza relaciones de TypeORM a través de HouseRecord
   * Carga también las relaciones cta_* para obtener montos
   * Retorna records ordenados por fecha de creación (DESC)
   */
  async findByHouseId(houseId: number): Promise<Record[]> {
    return this.recordRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.houseRecords', 'hr')
      .leftJoinAndSelect('r.ctaExtraordinaryFee', 'cta_fee')
      .leftJoinAndSelect('r.ctaMaintenance', 'cta_maint')
      .leftJoinAndSelect('r.ctaPenalties', 'cta_pen')
      .leftJoinAndSelect('r.ctaWater', 'cta_water')
      .leftJoinAndSelect('r.ctaOtherPayments', 'cta_other')
      .where('hr.house_id = :houseId', { houseId })
      .orderBy('r.created_at', 'DESC')
      .getMany();
  }
}
