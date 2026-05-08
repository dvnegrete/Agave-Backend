import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecordAllocation } from '@/shared/database/entities';
import {
  AllocationConceptType,
  PaymentStatus,
} from '@/shared/database/entities/enums';
import { IRecordAllocationRepository } from '../../interfaces/record-allocation.repository.interface';
import { PeriodTransactionDto } from '../../dto/period-transactions.dto';

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

  async deleteAll(): Promise<number> {
    const result = await this.repository.query(
      'DELETE FROM record_allocations',
    );
    return result?.[1] ?? 0;
  }

  async deleteByRecordIds(recordIds: number[]): Promise<number> {
    if (recordIds.length === 0) return 0;
    const result = await this.repository
      .createQueryBuilder()
      .delete()
      .from('record_allocations')
      .where('record_id IN (:...recordIds)', { recordIds })
      .execute();
    return result.affected ?? 0;
  }

  async findOverpaidBuckets(houseId: number): Promise<
    Array<{
      period_id: number;
      concept_type: AllocationConceptType;
      total_allocated: number;
      current_charge: number;
    }>
  > {
    const rows = await this.repository.query(
      `
      WITH alloc_sum AS (
        SELECT period_id, concept_type, SUM(allocated_amount) AS total_allocated
        FROM record_allocations
        WHERE house_id = $1
        GROUP BY period_id, concept_type
      )
      SELECT
        a.period_id,
        a.concept_type,
        a.total_allocated,
        COALESCE(c.expected_amount, 0) AS current_charge
      FROM alloc_sum a
      LEFT JOIN house_period_charges c
        ON c.house_id = $1
        AND c.period_id = a.period_id
        AND c.concept_type = a.concept_type
      WHERE a.total_allocated > COALESCE(c.expected_amount, 0)
      `,
      [houseId],
    );

    return rows.map((r: any) => ({
      period_id: Number(r.period_id),
      concept_type: r.concept_type as AllocationConceptType,
      total_allocated: parseFloat(r.total_allocated),
      current_charge: parseFloat(r.current_charge),
    }));
  }

  async findRecordIdsContributingToBuckets(
    houseId: number,
    buckets: Array<{
      period_id: number;
      concept_type: AllocationConceptType;
    }>,
  ): Promise<number[]> {
    if (buckets.length === 0) return [];

    const rows = await this.repository
      .createQueryBuilder('ra')
      .select('DISTINCT ra.record_id', 'record_id')
      .where('ra.house_id = :houseId', { houseId })
      .andWhere(
        `(ra.period_id, ra.concept_type) IN (${buckets
          .map((_, i) => `(:p${i}, :c${i})`)
          .join(', ')})`,
        buckets.reduce(
          (acc, b, i) => {
            acc[`p${i}`] = b.period_id;
            acc[`c${i}`] = b.concept_type;
            return acc;
          },
          {} as Record<string, unknown>,
        ),
      )
      .getRawMany();

    return rows.map((r) => Number(r.record_id));
  }

  async findTransactionsByHousePeriod(
    houseId: number,
    periodId: number,
  ): Promise<PeriodTransactionDto[]> {
    const rows = await this.repository.query(
      `
      SELECT
        tb.id AS transaction_id,
        tb.date::text AS date,
        tb.amount AS amount,
        SUM(ra.allocated_amount) AS allocated_to_period,
        tb.concept AS concept,
        tb.bank_name AS bank_name,
        tb.confirmation_status AS confirmation_status
      FROM record_allocations ra
      INNER JOIN records r ON r.id = ra.record_id
      INNER JOIN transactions_status ts ON ts.id = r.transaction_status_id
      INNER JOIN transactions_bank tb ON tb.id = ts.transactions_bank_id
      WHERE ra.house_id = $1 AND ra.period_id = $2
      GROUP BY tb.id, tb.date, tb.amount, tb.concept, tb.bank_name, tb.confirmation_status
      ORDER BY tb.date DESC
      `,
      [houseId, periodId],
    );

    return rows.map((r: any) => ({
      transaction_id: Number(r.transaction_id),
      date: String(r.date),
      amount: parseFloat(r.amount),
      allocated_to_period: parseFloat(r.allocated_to_period),
      concept: r.concept ?? null,
      bank_name: r.bank_name ?? '',
      confirmation_status: Boolean(r.confirmation_status),
    }));
  }
}
