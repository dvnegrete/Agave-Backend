import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { HouseStatusSnapshot } from '@/shared/database/entities';
import { IHouseStatusSnapshotRepository } from '../../interfaces/house-status-snapshot.repository.interface';

@Injectable()
export class HouseStatusSnapshotRepository
  implements IHouseStatusSnapshotRepository
{
  constructor(
    @InjectRepository(HouseStatusSnapshot)
    private readonly repository: Repository<HouseStatusSnapshot>,
  ) {}

  async findByHouseId(houseId: number): Promise<HouseStatusSnapshot | null> {
    return this.repository.findOne({
      where: { house_id: houseId },
    });
  }

  async findAll(): Promise<HouseStatusSnapshot[]> {
    return this.repository.find({
      order: { house_id: 'ASC' },
    });
  }

  async findAllFresh(): Promise<HouseStatusSnapshot[]> {
    return this.repository.find({
      where: { is_stale: false },
      order: { house_id: 'ASC' },
    });
  }

  async upsert(
    houseId: number,
    data: Partial<HouseStatusSnapshot>,
  ): Promise<HouseStatusSnapshot> {
    // Usar INSERT ... ON CONFLICT para upsert atómico
    const result = await this.repository.upsert(
      {
        house_id: houseId,
        ...data,
      },
      {
        conflictPaths: ['house_id'],
        skipUpdateIfNoValuesChanged: true,
      },
    );

    // Retornar el snapshot actualizado
    const snapshot = await this.findByHouseId(houseId);
    if (!snapshot) {
      throw new Error(`HouseStatusSnapshot for house ${houseId} not found`);
    }
    return snapshot;
  }

  async invalidateByHouseId(houseId: number): Promise<void> {
    await this.repository.update(
      { house_id: houseId },
      {
        is_stale: true,
        invalidated_at: new Date(),
      },
    );
  }

  async invalidateAll(): Promise<void> {
    await this.repository.query(
      `UPDATE house_status_snapshots SET is_stale = true, invalidated_at = NOW()`,
    );
  }

  async invalidateByHouseIds(houseIds: number[]): Promise<void> {
    if (houseIds.length === 0) {
      return;
    }
    await this.repository.update(
      { house_id: require('typeorm').In(houseIds) },
      {
        is_stale: true,
        invalidated_at: new Date(),
      },
    );
  }
}
