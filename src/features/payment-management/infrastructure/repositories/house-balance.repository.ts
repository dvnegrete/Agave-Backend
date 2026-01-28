import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { HouseBalance } from '@/shared/database/entities';
import { IHouseBalanceRepository } from '../../interfaces/house-balance.repository.interface';

@Injectable()
export class HouseBalanceRepository implements IHouseBalanceRepository {
  constructor(
    @InjectRepository(HouseBalance)
    private readonly repository: Repository<HouseBalance>,
  ) {}

  async findByHouseId(houseId: number): Promise<HouseBalance | null> {
    return this.repository.findOne({
      where: { house_id: houseId },
      relations: ['house'],
    });
  }

  async create(houseId: number): Promise<HouseBalance> {
    const balance = this.repository.create({
      house_id: houseId,
      accumulated_cents: 0,
      credit_balance: 0,
      debit_balance: 0,
    });
    return this.repository.save(balance);
  }

  async update(
    houseId: number,
    balance: Partial<HouseBalance>,
  ): Promise<HouseBalance> {
    await this.repository.update({ house_id: houseId }, balance);
    const updated = await this.findByHouseId(houseId);
    if (!updated) {
      throw new Error(`HouseBalance for house ${houseId} not found`);
    }
    return updated;
  }

  async getOrCreate(houseId: number): Promise<HouseBalance> {
    let balance = await this.findByHouseId(houseId);
    if (!balance) {
      balance = await this.create(houseId);
    }
    return balance;
  }

  async addCreditBalance(
    houseId: number,
    amount: number,
  ): Promise<HouseBalance> {
    const balance = await this.getOrCreate(houseId);
    const newCredit = Math.max(0, balance.credit_balance + amount);
    return this.update(houseId, { credit_balance: newCredit });
  }

  async subtractCreditBalance(
    houseId: number,
    amount: number,
  ): Promise<HouseBalance> {
    const balance = await this.getOrCreate(houseId);
    const newCredit = Math.max(0, balance.credit_balance - amount);
    return this.update(houseId, { credit_balance: newCredit });
  }

  async addDebitBalance(
    houseId: number,
    amount: number,
  ): Promise<HouseBalance> {
    const balance = await this.getOrCreate(houseId);
    const newDebit = Math.max(0, balance.debit_balance + amount);
    return this.update(houseId, { debit_balance: newDebit });
  }

  async subtractDebitBalance(
    houseId: number,
    amount: number,
  ): Promise<HouseBalance> {
    const balance = await this.getOrCreate(houseId);
    const newDebit = Math.max(0, balance.debit_balance - amount);
    return this.update(houseId, { debit_balance: newDebit });
  }

  async addAccumulatedCents(
    houseId: number,
    amount: number,
  ): Promise<HouseBalance> {
    const balance = await this.getOrCreate(houseId);
    // Mantener entre 0.00 y 0.99
    let newCents = balance.accumulated_cents + amount;
    if (newCents >= 1) {
      newCents = newCents % 1; // Solo mantener la parte decimal
    }
    if (newCents < 0) {
      newCents = 0;
    }
    return this.update(houseId, { accumulated_cents: newCents });
  }

  async resetAccumulatedCents(houseId: number): Promise<HouseBalance> {
    return this.update(houseId, { accumulated_cents: 0 });
  }

  async findWithDebt(): Promise<HouseBalance[]> {
    return this.repository.find({
      where: { debit_balance: MoreThan(0) },
      relations: ['house'],
      order: { debit_balance: 'DESC' },
    });
  }

  async findWithCredit(): Promise<HouseBalance[]> {
    return this.repository.find({
      where: { credit_balance: MoreThan(0) },
      relations: ['house'],
      order: { credit_balance: 'DESC' },
    });
  }

  async delete(houseId: number): Promise<boolean> {
    const result = await this.repository.delete({ house_id: houseId });
    return (result.affected ?? 0) > 0;
  }
}
