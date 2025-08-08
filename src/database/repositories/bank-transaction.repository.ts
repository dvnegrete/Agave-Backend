import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { BankTransaction, TransactionStatus } from '@prisma/client';
import { CreateBankTransactionDto, UpdateBankTransactionDto } from '../../transactions-bank/dto/bank-transaction.dto';

@Injectable()
export class BankTransactionRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateBankTransactionDto): Promise<BankTransaction> {
    return this.prisma.bankTransaction.create({
      data: {
        date: data.date,
        time: data.time,
        concept: data.concept,
        amount: data.amount,
        currency: data.currency,
        is_deposit: data.is_deposit,
        validation_flag: data.validation_flag || false,
        status: 'PENDING',
      },
    });
  }

  async createMany(data: CreateBankTransactionDto[]): Promise<BankTransaction[]> {
    const transactions = await this.prisma.bankTransaction.createMany({
      data: data.map(transaction => ({
        date: transaction.date,
        time: transaction.time,
        concept: transaction.concept,
        amount: transaction.amount,
        currency: transaction.currency,
        is_deposit: transaction.is_deposit,
        validation_flag: transaction.validation_flag || false,
        status: 'PENDING',
      })),
    });

    // Retornar las transacciones creadas
    return this.findAll();
  }

  async findAll(): Promise<BankTransaction[]> {
    return this.prisma.bankTransaction.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<BankTransaction | null> {
    return this.prisma.bankTransaction.findUnique({
      where: { id },
    });
  }

  async findByStatus(status: TransactionStatus): Promise<BankTransaction[]> {
    return this.prisma.bankTransaction.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<BankTransaction[]> {
    return this.prisma.bankTransaction.findMany({
      where: {
        date: {
          gte: startDate.toISOString().split('T')[0],
          lte: endDate.toISOString().split('T')[0],
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: UpdateBankTransactionDto): Promise<BankTransaction> {
    const updateData: any = {};
    
    if (data.date) updateData.date = data.date;
    if (data.time) updateData.time = data.time;
    if (data.concept) updateData.concept = data.concept;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.currency) updateData.currency = data.currency;
    if (data.is_deposit !== undefined) updateData.is_deposit = data.is_deposit;
    if (data.validation_flag !== undefined) updateData.validation_flag = data.validation_flag;
    if (data.status) updateData.status = data.status.toUpperCase();

    return this.prisma.bankTransaction.update({
      where: { id },
      data: updateData,
    });
  }

  async delete(id: string): Promise<BankTransaction> {
    return this.prisma.bankTransaction.delete({
      where: { id },
    });
  }

  async getTransactionSummary() {
    const [total, pending, processed, failed, reconciled] = await Promise.all([
      this.prisma.bankTransaction.count(),
      this.prisma.bankTransaction.count({ where: { status: 'PENDING' } }),
      this.prisma.bankTransaction.count({ where: { status: 'PROCESSED' } }),
      this.prisma.bankTransaction.count({ where: { status: 'FAILED' } }),
      this.prisma.bankTransaction.count({ where: { status: 'RECONCILED' } }),
    ]);

    const totalAmount = await this.prisma.bankTransaction.aggregate({
      _sum: { amount: true },
    });

    const currencies = await this.prisma.bankTransaction.findMany({
      select: { currency: true },
      distinct: ['currency'],
    });

    const concepts = await this.prisma.bankTransaction.findMany({
      select: { concept: true },
      distinct: ['concept'],
    });

    return {
      total,
      pending,
      processed,
      failed,
      reconciled,
      totalAmount: totalAmount._sum.amount || 0,
      currencies: currencies.map(c => c.currency),
      concepts: concepts.map(c => c.concept),
    };
  }

  async findDuplicateConcepts(): Promise<string[]> {
    const duplicates = await this.prisma.bankTransaction.groupBy({
      by: ['concept'],
      _count: { concept: true },
      having: {
        concept: {
          _count: { gt: 1 },
        },
      },
    });

    return duplicates.map(d => d.concept);
  }
}
