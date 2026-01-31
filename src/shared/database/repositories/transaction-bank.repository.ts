import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionBank } from '../entities/transaction-bank.entity';
import {
  CreateTransactionBankDto,
  UpdateTransactionBankDto,
} from '../../../features/transactions-bank/dto/transaction-bank.dto';
import { Between } from 'typeorm';
import { Retry } from '../../decorators/retry.decorator';

@Injectable()
export class TransactionBankRepository {
  constructor(
    @InjectRepository(TransactionBank)
    private transactionBankRepository: Repository<TransactionBank>,
  ) {}

  @Retry({
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
  })
  async create(data: CreateTransactionBankDto): Promise<TransactionBank> {
    // If data.date is already an ISO string (YYYY-MM-DD), create Date in local timezone to avoid UTC offset
    let date: Date;
    if (
      typeof data.date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(data.date)
    ) {
      const [year, month, day] = data.date.split('-').map(Number);
      date = new Date(year, month - 1, day); // month is 0-indexed
    } else {
      date = new Date(data.date);
    }

    const transactionBank = this.transactionBankRepository.create({
      date,
      time: data.time,
      concept: data.concept,
      amount: data.amount,
      currency: data.currency,
      is_deposit: data.is_deposit,
      bank_name: (data as any).bank_name,
      confirmation_status: data.validation_flag || false,
    });
    return this.transactionBankRepository.save(transactionBank);
  }

  @Retry({
    maxAttempts: 3,
    delayMs: 1500,
    backoffMultiplier: 2,
  })
  async createMany(
    data: CreateTransactionBankDto[],
  ): Promise<TransactionBank[]> {
    const transactionBanks = data.map((transaction) => {
      // If transaction.date is already an ISO string (YYYY-MM-DD), create Date in local timezone to avoid UTC offset
      let date: Date;
      if (
        typeof transaction.date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(transaction.date)
      ) {
        const [year, month, day] = transaction.date.split('-').map(Number);
        date = new Date(year, month - 1, day); // month is 0-indexed
      } else {
        date = new Date(transaction.date);
      }

      return this.transactionBankRepository.create({
        date,
        time: transaction.time,
        concept: transaction.concept,
        amount: transaction.amount,
        currency: transaction.currency,
        is_deposit: transaction.is_deposit,
        bank_name: (transaction as any).bank_name,
        confirmation_status: transaction.validation_flag || false,
      });
    });
    return this.transactionBankRepository.save(transactionBanks);
  }

  @Retry({
    maxAttempts: 3,
    delayMs: 1000,
  })
  async findAll(): Promise<TransactionBank[]> {
    return this.transactionBankRepository.find({
      order: { created_at: 'DESC' },
    });
  }

  @Retry({
    maxAttempts: 3,
    delayMs: 1000,
  })
  async findById(id: string): Promise<TransactionBank | null> {
    return this.transactionBankRepository.findOne({
      where: { id },
    });
  }

  @Retry({
    maxAttempts: 3,
    delayMs: 1000,
  })
  async findByStatus(
    status: 'pending' | 'processed' | 'failed' | 'reconciled',
  ): Promise<TransactionBank[]> {
    // Map status to confirmation_status
    // pending/processed/failed → confirmation_status = false
    // reconciled → confirmation_status = true
    const confirmationStatus = status === 'reconciled';

    return this.transactionBankRepository.find({
      where: {
        confirmation_status: confirmationStatus,
      },
      order: { created_at: 'DESC' },
    });
  }

  @Retry({
    maxAttempts: 3,
    delayMs: 1000,
  })
  async findByDateRange(
    startDate: string | Date,
    endDate: string | Date,
  ): Promise<TransactionBank[]> {
    // Convertir a string YYYY-MM-DD si es Date
    const startStr =
      typeof startDate === 'string'
        ? startDate
        : startDate.toISOString().split('T')[0];

    const endStr =
      typeof endDate === 'string'
        ? endDate
        : endDate.toISOString().split('T')[0];

    // TypeORM QueryBuilder con comparación de strings
    const query = this.transactionBankRepository
      .createQueryBuilder('tb')
      .where('CAST(tb.date AS VARCHAR) >= :startDate', { startDate: startStr })
      .andWhere('CAST(tb.date AS VARCHAR) <= :endDate', { endDate: endStr })
      .orderBy('tb.date', 'DESC')
      .addOrderBy('tb.created_at', 'DESC');

    const results = await query.getMany();

    return results;
  }

  @Retry({
    maxAttempts: 3,
    delayMs: 1000,
    backoffMultiplier: 2,
  })
  async update(
    id: string,
    data: UpdateTransactionBankDto,
  ): Promise<TransactionBank> {
    const updateData: Partial<TransactionBank> = {};

    if (data.date) {
      // If data.date is already an ISO string (YYYY-MM-DD), create Date in local timezone to avoid UTC offset
      if (
        typeof data.date === 'string' &&
        /^\d{4}-\d{2}-\d{2}$/.test(data.date)
      ) {
        const [year, month, day] = data.date.split('-').map(Number);
        updateData.date = new Date(year, month - 1, day); // month is 0-indexed
      } else {
        updateData.date = new Date(data.date);
      }
    }
    if (data.time) updateData.time = data.time;
    if (data.concept) updateData.concept = data.concept;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.currency) updateData.currency = data.currency;
    if (data.is_deposit !== undefined) updateData.is_deposit = data.is_deposit;
    if ((data as any).bank_name) updateData.bank_name = (data as any).bank_name;
    if (data.validation_flag !== undefined)
      updateData.confirmation_status = data.validation_flag;

    await this.transactionBankRepository.update(id, updateData);
    const updated = await this.transactionBankRepository.findOne({
      where: { id },
    });
    if (!updated) {
      throw new Error('Transaction not found after update');
    }
    return updated;
  }

  @Retry({
    maxAttempts: 3,
    delayMs: 1000,
  })
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
      concepts: concepts.map((c) => c.concept).filter((c): c is string => !!c),
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

    return duplicates.map((d) => d.concept).filter((c): c is string => !!c);
  }

  @Retry({
    maxAttempts: 3,
    delayMs: 1000,
  })
  async findTransactionsByDateAndBank(
    date: Date,
    bankName: string,
  ): Promise<TransactionBank[]> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    return this.transactionBankRepository.find({
      where: {
        date: Between(startOfDay, endOfDay),
        bank_name: bankName,
      },
      order: { date: 'ASC', time: 'ASC' },
    });
  }

  /**
   * Obtiene todas las transacciones bancarias asociadas a una casa
   * por su número de casa (number_house)
   *
   * Utiliza relaciones de TypeORM en lugar de SQL directo.
   * Flujo de relaciones:
   * TransactionBank → TransactionStatus → Record → HouseRecord → House
   */
  @Retry({
    maxAttempts: 3,
    delayMs: 1000,
  })
  async findByHouseNumberHouse(
    numberHouse: number,
  ): Promise<TransactionBank[]> {
    return this.transactionBankRepository
      .createQueryBuilder('tb')
      .leftJoinAndSelect('tb.transactionStatuses', 'ts')
      .leftJoinAndSelect('ts.records', 'r')
      .leftJoinAndSelect('r.houseRecords', 'hr')
      .leftJoinAndSelect('hr.house', 'h')
      .where('h.number_house = :numberHouse', { numberHouse })
      .orderBy('tb.date', 'DESC')
      .addOrderBy('tb.time', 'DESC')
      .getMany();
  }

  @Retry({
    maxAttempts: 3,
    delayMs: 1000,
  })
  async findExpensesByMonth(date: string | Date): Promise<TransactionBank[]> {
    // Extraer mes y año de la fecha
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const monthStr = `${year}-${month}`;

    // Buscar transacciones del mes donde is_deposit = false
    const query = this.transactionBankRepository
      .createQueryBuilder('tb')
      .where('CAST(tb.date AS VARCHAR) LIKE :monthPattern', {
        monthPattern: `${monthStr}%`,
      })
      .andWhere('tb.is_deposit = :isDeposit', { isDeposit: false })
      .orderBy('tb.date', 'DESC')
      .addOrderBy('tb.time', 'DESC');

    return query.getMany();
  }
}
