import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { LastTransactionBank } from '../entities/last-transaction-bank.entity';

@Injectable()
export class LastTransactionBankRepository {
  constructor(
    @InjectRepository(LastTransactionBank)
    private lastTransactionBankRepository: Repository<LastTransactionBank>,
  ) {}

  async create(transactionsBankId: string): Promise<LastTransactionBank> {
    const lastTransaction = this.lastTransactionBankRepository.create({
      transactions_bank_id: transactionsBankId,
    });
    return this.lastTransactionBankRepository.save(lastTransaction);
  }

  async findLatest(): Promise<LastTransactionBank | null> {
    return this.lastTransactionBankRepository.findOne({
      order: { created_at: 'DESC' },
      relations: ['transactionBank'],
    });
  }

  async findAll(): Promise<LastTransactionBank[]> {
    return this.lastTransactionBankRepository.find({
      order: { created_at: 'DESC' },
      relations: ['transactionBank'],
    });
  }

  async deleteAll(): Promise<void> {
    await this.lastTransactionBankRepository.clear();
  }

  async findByTransactionId(transactionsBankId: string): Promise<LastTransactionBank | null> {
    return this.lastTransactionBankRepository.findOne({
      where: { transactions_bank_id: transactionsBankId },
      relations: ['transactionBank'],
    });
  }
}