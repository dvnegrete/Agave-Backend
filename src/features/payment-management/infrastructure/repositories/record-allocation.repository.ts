import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecordAllocation } from '@/shared/database/entities';
import {
  AllocationConceptType,
  PaymentStatus,
} from '@/shared/database/entities/enums';
import { IRecordAllocationRepository } from '../../interfaces/record-allocation.repository.interface';

@Injectable()
export class RecordAllocationRepository implements IRecordAllocationRepository {
  constructor(
    @InjectRepository(RecordAllocation)
    private readonly repository: Repository<RecordAllocation>,
  ) {}

  async findByHouseId(houseId: number): Promise<RecordAllocation[]> {
    return this.repository.find({
      where: { house_id: houseId },
      relations: ['record', 'period', 'house'],
      order: { created_at: 'DESC' },
    });
  }

  async findByHouseAndPeriod(
    houseId: number,
    periodId: number,
  ): Promise<RecordAllocation[]> {
    return this.repository.find({
      where: { house_id: houseId, period_id: periodId },
      relations: ['record', 'period', 'house'],
      order: { created_at: 'DESC' },
    });
  }

  async findByRecordId(recordId: number): Promise<RecordAllocation[]> {
    return this.repository.find({
      where: { record_id: recordId },
      relations: ['record', 'period', 'house'],
      order: { created_at: 'DESC' },
    });
  }

  async findByPeriodId(periodId: number): Promise<RecordAllocation[]> {
    return this.repository.find({
      where: { period_id: periodId },
      relations: ['record', 'period', 'house'],
      order: { created_at: 'DESC' },
    });
  }

  async findByHousePeriodAndConcept(
    houseId: number,
    periodId: number,
    conceptType: AllocationConceptType,
  ): Promise<RecordAllocation | null> {
    return this.repository.findOne({
      where: {
        house_id: houseId,
        period_id: periodId,
        concept_type: conceptType,
      },
      relations: ['record', 'period', 'house'],
    });
  }

  async findByPaymentStatus(
    status: PaymentStatus,
  ): Promise<RecordAllocation[]> {
    return this.repository.find({
      where: { payment_status: status },
      relations: ['record', 'period', 'house'],
      order: { created_at: 'DESC' },
    });
  }

  async create(
    allocation: Partial<RecordAllocation>,
  ): Promise<RecordAllocation> {
    const entity = this.repository.create(allocation);
    return this.repository.save(entity);
  }

  async createBatch(
    allocations: Partial<RecordAllocation>[],
  ): Promise<RecordAllocation[]> {
    const entities = allocations.map((a) => this.repository.create(a));
    return this.repository.save(entities);
  }

  async update(
    id: number,
    allocation: Partial<RecordAllocation>,
  ): Promise<RecordAllocation> {
    await this.repository.update(id, allocation);
    const updated = await this.repository.findOne({
      where: { id },
      relations: ['record', 'period', 'house'],
    });
    if (!updated) {
      throw new Error(`RecordAllocation with id ${id} not found`);
    }
    return updated;
  }

  async findById(id: number): Promise<RecordAllocation | null> {
    return this.repository.findOne({
      where: { id },
    });
  }

  async findByIdWithRelations(id: number): Promise<RecordAllocation | null> {
    return this.repository.findOne({
      where: { id },
      relations: ['record', 'period', 'house'],
    });
  }

  async delete(id: number): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }

  async getTotalPaidByHousePeriod(
    houseId: number,
    periodId: number,
  ): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('ra')
      .select('SUM(ra.allocated_amount)', 'total')
      .where('ra.house_id = :houseId', { houseId })
      .andWhere('ra.period_id = :periodId', { periodId })
      .getRawOne();

    return result?.total ? parseFloat(result.total) : 0;
  }

  async getTotalExpectedByHousePeriod(
    houseId: number,
    periodId: number,
  ): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('ra')
      .select('SUM(ra.expected_amount)', 'total')
      .where('ra.house_id = :houseId', { houseId })
      .andWhere('ra.period_id = :periodId', { periodId })
      .getRawOne();

    return result?.total ? parseFloat(result.total) : 0;
  }
}
