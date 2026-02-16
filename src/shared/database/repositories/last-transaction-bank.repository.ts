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

  async create(transactionsBankId: number): Promise<LastTransactionBank> {
    const lastTransaction = this.lastTransactionBankRepository.create({
      transactions_bank_id: transactionsBankId,
    });
    return this.lastTransactionBankRepository.save(lastTransaction);
  }

  async findLatest(): Promise<LastTransactionBank | null> {
    return this.lastTransactionBankRepository
      .createQueryBuilder('ltb')
      .leftJoinAndSelect('ltb.transactionBank', 'tb')
      .orderBy('ltb.id', 'DESC')
      .addOrderBy('ltb.created_at', 'DESC')
      .take(1)
      .getOne();
  }

  async findRecent(limit: number = 7): Promise<LastTransactionBank[]> {
    return this.lastTransactionBankRepository
      .createQueryBuilder('ltb')
      .leftJoinAndSelect('ltb.transactionBank', 'tb')
      .orderBy('ltb.id', 'DESC')
      .addOrderBy('ltb.created_at', 'DESC')
      .take(limit)
      .getMany();
  }

  async findAll(): Promise<LastTransactionBank[]> {
    return this.lastTransactionBankRepository
      .createQueryBuilder('ltb')
      .leftJoinAndSelect('ltb.transactionBank', 'tb')
      .orderBy('ltb.id', 'DESC')
      .addOrderBy('ltb.created_at', 'DESC')
      .getMany();
  }

  async deleteAll(): Promise<void> {
    await this.lastTransactionBankRepository.clear();
  }

  async findByTransactionId(
    transactionsBankId: number,
  ): Promise<LastTransactionBank | null> {
    return this.lastTransactionBankRepository.findOne({
      where: { transactions_bank_id: transactionsBankId },
      relations: ['transactionBank'],
    });
  }
}
