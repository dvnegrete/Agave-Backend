import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionBank } from '../entities/transaction-bank.entity';
import {
  CreateTransactionBankDto,
  UpdateTransactionBankDto,
} from '../../../features/transactions-bank/dto/transaction-bank.dto';
import { Between } from 'typeorm';

@Injectable()
export class TransactionBankRepository {
  constructor(
    @InjectRepository(TransactionBank)
    private transactionBankRepository: Repository<TransactionBank>,
  ) {}

  async create(data: CreateTransactionBankDto): Promise<TransactionBank> {
    const transactionBank = this.transactionBankRepository.create({
      date: new Date(data.date),
      time: data.time,
      concept: data.concept,
      amount: data.amount,
      currency: data.currency,
      is_deposit: data.is_deposit,
      confirmation_status: data.validation_flag || false,
    });
    return this.transactionBankRepository.save(transactionBank);
  }

  async createMany(
    data: CreateTransactionBankDto[],
  ): Promise<TransactionBank[]> {
    const transactionBanks = data.map((transaction) =>
      this.transactionBankRepository.create({
        date: new Date(transaction.date),
        time: transaction.time,
        concept: transaction.concept,
        amount: transaction.amount,
        currency: transaction.currency,
        is_deposit: transaction.is_deposit,
        confirmation_status: transaction.validation_flag || false,
      }),
    );
    return this.transactionBankRepository.save(transactionBanks);
  }

  async findAll(): Promise<TransactionBank[]> {
    return this.transactionBankRepository.find({
      order: { created_at: 'DESC' },
    });
  }

  async findById(id: string): Promise<TransactionBank | null> {
    return this.transactionBankRepository.findOne({
      where: { id },
    });
  }

  async findByStatus(): Promise<TransactionBank[]> {
    return this.findAll();
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<TransactionBank[]> {
    return this.transactionBankRepository.find({
      where: {
        date: Between(startDate, endDate),
      },
      order: { created_at: 'DESC' },
    });
  }

  async update(
    id: string,
    data: UpdateTransactionBankDto,
  ): Promise<TransactionBank> {
    const updateData: Partial<TransactionBank> = {};

    if (data.date) updateData.date = new Date(data.date);
    if (data.time) updateData.time = data.time;
    if (data.concept) updateData.concept = data.concept;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.currency) updateData.currency = data.currency;
    if (data.is_deposit !== undefined) updateData.is_deposit = data.is_deposit;
    if (data.validation_flag !== undefined)
      updateData.confirmation_status = data.validation_flag;

    await this.transactionBankRepository.update(id, updateData);
    const updated = await this.transactionBankRepository.findOne({ where: { id } });
    if (!updated) {
      throw new Error('Transaction not found after update');
    }
    return updated;
  }

  async delete(id: string): Promise<TransactionBank> {
    const transactionBank = await this.transactionBankRepository.findOne({
      where: { id },
    });
    if (!transactionBank) {
      throw new Error('Transaction not found');
    }
    await this.transactionBankRepository.delete(id);
    return transactionBank;
  }

  async getTransactionSummary(): Promise<{
    total: number;
    pending: number;
    processed: number;
    failed: number;
    reconciled: number;
    totalAmount: number;
    currencies: string[];
    concepts: string[];
  }> {
    const total = await this.transactionBankRepository.count();
    const pending = total;
    const processed = 0;
    const failed = 0;
    const reconciled = 0;

    const result = await this.transactionBankRepository
      .createQueryBuilder('transaction')
      .select('SUM(transaction.amount)', 'totalAmount')
      .getRawOne<{ totalAmount: number | null }>();

    const currencies = await this.transactionBankRepository
      .createQueryBuilder('transaction')
      .select('DISTINCT transaction.currency', 'currency')
      .where('transaction.currency IS NOT NULL')
      .getRawMany<{ currency: string }>();

    const concepts = await this.transactionBankRepository
      .createQueryBuilder('transaction')
      .select('DISTINCT transaction.concept', 'concept')
      .where('transaction.concept IS NOT NULL')
      .getRawMany<{ concept: string }>();

    return {
      total,
      pending,
      processed,
      failed,
      reconciled,
      totalAmount: result?.totalAmount || 0,
      currencies: currencies
        .map((c) => c.currency)
        .filter((c): c is string => !!c),
      concepts: concepts
        .map((c) => c.concept)
        .filter((c): c is string => !!c),
    };
  }

  async findDuplicateConcepts(): Promise<string[]> {
    const duplicates = await this.transactionBankRepository
      .createQueryBuilder('transaction')
      .select('transaction.concept', 'concept')
      .addSelect('COUNT(transaction.concept)', 'count')
      .where('transaction.concept IS NOT NULL')
      .groupBy('transaction.concept')
      .having('COUNT(transaction.concept) > 1')
      .getRawMany<{ concept: string; count: number }>();

    return duplicates
      .map((d) => d.concept)
      .filter((c): c is string => !!c);
  }
}
