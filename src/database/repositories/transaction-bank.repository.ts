import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateTransactionBankDto, UpdateTransactionBankDto } from '../../transactions-bank/dto/transaction-bank.dto';

@Injectable()
export class TransactionBankRepository {
  constructor(private prisma: PrismaService) {}

  async create(data: CreateTransactionBankDto): Promise<any> {
    return (this.prisma as any).transactionsBank.create({
      data: {
        date: new Date(data.date),
        time: data.time,
        concept: data.concept,
        amount: data.amount,
        currency: data.currency,
        is_deposit: data.is_deposit,
        confirmationStatus: data.validation_flag || false,
      },
    });
  }

  async createMany(data: CreateTransactionBankDto[]): Promise<any[]> {
    await (this.prisma as any).transactionsBank.createMany({
      data: data.map((transaction) => ({
        date: new Date(transaction.date),
        time: transaction.time,
        concept: transaction.concept,
        amount: transaction.amount,
        currency: transaction.currency,
        is_deposit: transaction.is_deposit,
        confirmationStatus: transaction.validation_flag || false,
      })),
    });
    return this.findAll();
  }

  async findAll(): Promise<any[]> {
    return (this.prisma as any).transactionsBank.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findById(id: string): Promise<any | null> {
    let whereId: any = id as any;
    try {
      whereId = BigInt(id);
    } catch (_) {}
    return (this.prisma as any).transactionsBank.findUnique({
      where: { id: whereId },
    });
  }

  async findByStatus(_status: any): Promise<any[]> {
    return this.findAll();
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<any[]> {
    return (this.prisma as any).transactionsBank.findMany({
      where: {
        date: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: UpdateTransactionBankDto): Promise<any> {
    const updateData: any = {};

    if (data.date) updateData.date = new Date(data.date);
    if (data.time) updateData.time = data.time;
    if (data.concept) updateData.concept = data.concept;
    if (data.amount !== undefined) updateData.amount = data.amount;
    if (data.currency) updateData.currency = data.currency;
    if (data.is_deposit !== undefined) updateData.is_deposit = data.is_deposit;
    if (data.validation_flag !== undefined) updateData.confirmationStatus = data.validation_flag;

    let whereId: any = id as any;
    try {
      whereId = BigInt(id);
    } catch (_) {}

    return (this.prisma as any).transactionsBank.update({
      where: { id: whereId },
      data: updateData,
    });
  }

  async delete(id: string): Promise<any> {
    let whereId: any = id as any;
    try {
      whereId = BigInt(id);
    } catch (_) {}
    return (this.prisma as any).transactionsBank.delete({
      where: { id: whereId },
    });
  }

  async getTransactionSummary() {
    const total = await (this.prisma as any).transactionsBank.count();
    const pending = total;
    const processed = 0;
    const failed = 0;
    const reconciled = 0;

    const totalAmount = await (this.prisma as any).transactionsBank.aggregate({
      _sum: { amount: true },
    });

    const currencies = await (this.prisma as any).transactionsBank.findMany({
      select: { currency: true },
      distinct: ['currency'],
    });

    const concepts = await (this.prisma as any).transactionsBank.findMany({
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
      currencies: currencies.map((c: any) => c.currency).filter((c: any): c is string => !!c),
      concepts: concepts.map((c: any) => c.concept).filter((c: any): c is string => !!c),
    };
  }

  async findDuplicateConcepts(): Promise<string[]> {
    const duplicates = await (this.prisma as any).transactionsBank.groupBy({
      by: ['concept'],
      _count: { concept: true },
      having: {
        concept: {
          _count: { gt: 1 },
        },
      },
    });

    return duplicates.map((d: any) => d.concept).filter((c: any): c is string => !!c);
  }
}


