import { Injectable } from '@nestjs/common';
import { Repository, QueryRunner } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { HouseRecord } from '../entities/house-record.entity';

export interface CreateHouseRecordDto {
  house_id: number;
  record_id: number;
}

@Injectable()
export class HouseRecordRepository {
  constructor(
    @InjectRepository(HouseRecord)
    private houseRecordRepository: Repository<HouseRecord>,
  ) {}

  /**
   * Crea una nueva asociación entre casa y record
   */
  async create(
    data: CreateHouseRecordDto,
    queryRunner?: QueryRunner,
  ): Promise<HouseRecord> {
    const houseRecordData: Partial<HouseRecord> = {
      house_id: data.house_id,
      record_id: data.record_id,
    };

    if (queryRunner) {
      const houseRecord = queryRunner.manager.create(HouseRecord, houseRecordData);
      return await queryRunner.manager.save(houseRecord);
    }

    const houseRecord = this.houseRecordRepository.create(houseRecordData);
    return await this.houseRecordRepository.save(houseRecord);
  }

  /**
   * Busca una asociación por su ID
   */
  async findById(id: number): Promise<HouseRecord | null> {
    return this.houseRecordRepository.findOne({
      where: { id },
      relations: ['house', 'record'],
    });
  }

  /**
   * Busca todas las asociaciones de una casa
   */
  async findByHouseId(houseId: number): Promise<HouseRecord[]> {
    return this.houseRecordRepository.find({
      where: { house_id: houseId },
      relations: ['record'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Busca todas las casas asociadas a un record
   */
  async findByRecordId(recordId: number): Promise<HouseRecord[]> {
    return this.houseRecordRepository.find({
      where: { record_id: recordId },
      relations: ['house'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Verifica si existe una asociación específica
   */
  async exists(houseId: number, recordId: number): Promise<boolean> {
    const count = await this.houseRecordRepository.count({
      where: {
        house_id: houseId,
        record_id: recordId,
      },
    });
    return count > 0;
  }

  /**
   * Obtiene todas las asociaciones con relaciones
   */
  async findAll(): Promise<HouseRecord[]> {
    return this.houseRecordRepository.find({
      relations: ['house', 'record'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Elimina una asociación por su ID
   */
  async delete(id: number): Promise<void> {
    await this.houseRecordRepository.delete(id);
  }

  /**
   * Elimina todas las asociaciones de una casa
   */
  async deleteByHouseId(houseId: number): Promise<void> {
    await this.houseRecordRepository.delete({ house_id: houseId });
  }

  /**
   * Elimina todas las asociaciones de un record
   */
  async deleteByRecordId(recordId: number): Promise<void> {
    await this.houseRecordRepository.delete({ record_id: recordId });
  }
}
