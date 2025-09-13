import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileProcessorService } from './file-processor.service';
import { TransactionValidatorService } from './transaction-validator.service';
import { TransactionBankRepository } from '../../../shared/database/repositories/transaction-bank.repository';
import {
  TransactionBank,
  ProcessedBankTransaction,
  FileProcessingResult,
  ReconciliationResult,
} from '../interfaces/transaction-bank.interface';
import { UploadFileDto } from '../dto/upload-file.dto';
import {
  CreateTransactionBankDto,
  UpdateTransactionBankDto,
  ReconciliationDto,
} from '../dto/transaction-bank.dto';

@Injectable()
export class TransactionsBankService {
  constructor(
    private readonly fileProcessorService: FileProcessorService,
    private readonly transactionValidatorService: TransactionValidatorService,
    private readonly bankTransactionRepository: TransactionBankRepository,
  ) {}

  async processFile(
    file: Express.Multer.File,
    options?: UploadFileDto,
  ): Promise<FileProcessingResult> {
    try {
      const startTime = Date.now();

      // Procesar el archivo
      const rawTransactions = await this.fileProcessorService.parseFile(
        file,
        options,
      );

      // Validar transacciones
      const validationResults = await Promise.all(
        rawTransactions.map((transaction) =>
          this.transactionValidatorService.validateTransaction(transaction),
        ),
      );

      // Filtrar transacciones válidas
      const validTransactions: ProcessedBankTransaction[] = [];
      const errors: string[] = [];

      rawTransactions.forEach((transaction, index) => {
        const validation = validationResults[index];

        if (validation.isValid) {
          const processedTransaction: ProcessedBankTransaction = {
            ...transaction,
            id: this.generateId(),
            status: 'pending',
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          validTransactions.push(processedTransaction);
        } else {
          errors.push(`Línea ${index + 1}: ${validation.errors.join(', ')}`);
        }
      });

      // Guardar transacciones válidas
      if (!options?.validateOnly) {
        await this.bankTransactionRepository.createMany(
          validTransactions.map((transaction) => ({
            date: transaction.date,
            time: transaction.time,
            concept: transaction.concept,
            amount: transaction.amount,
            currency: transaction.currency,
            is_deposit: transaction.is_deposit,
            validation_flag: transaction.validation_flag,
          })),
        );
      }

      const processingTime = Date.now() - startTime;

      // Determinar rango de fechas
      const dates = validTransactions.map((t) => new Date(t.date)).sort();
      const dateRange =
        dates.length > 0
          ? {
              start: dates[0],
              end: dates[dates.length - 1],
            }
          : undefined;

      return {
        success: errors.length === 0,
        totalTransactions: rawTransactions.length,
        validTransactions: validTransactions.length,
        invalidTransactions: rawTransactions.length - validTransactions.length,
        transactions: validTransactions,
        errors,
        processingTime,
        bankName: options?.bankName,
        accountNumber: options?.accountNumber,
        dateRange,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al procesar el archivo: ${error.message}`,
      );
    }
  }

  async getAllTransactions(): Promise<ProcessedBankTransaction[]> {
    const transactions = await this.bankTransactionRepository.findAll();
    return transactions.map((t) => this.mapToProcessedTransaction(t));
  }

  async getTransactionById(id: string): Promise<ProcessedBankTransaction> {
    const transaction = await this.bankTransactionRepository.findById(id);
    if (!transaction) {
      throw new NotFoundException(
        `Transacción bancaria con ID ${id} no encontrada`,
      );
    }
    return this.mapToProcessedTransaction(transaction);
  }

  async createTransaction(
    createTransactionDto: CreateTransactionBankDto,
  ): Promise<ProcessedBankTransaction> {
    const transaction =
      await this.bankTransactionRepository.create(createTransactionDto);
    return this.mapToProcessedTransaction(transaction);
  }

  async updateTransaction(
    id: string,
    updateTransactionDto: UpdateTransactionBankDto,
  ): Promise<ProcessedBankTransaction> {
    const transaction = await this.bankTransactionRepository.update(
      id,
      updateTransactionDto,
    );
    return this.mapToProcessedTransaction(transaction);
  }

  async deleteTransaction(id: string): Promise<void> {
    await this.bankTransactionRepository.delete(id);
  }

  async getTransactionsByStatus(
    status: 'pending' | 'processed' | 'failed' | 'reconciled',
  ): Promise<ProcessedBankTransaction[]> {
    const transactions = await this.bankTransactionRepository.findByStatus();
    return transactions.map((t) => this.mapToProcessedTransaction(t));
  }

  async getTransactionsByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<ProcessedBankTransaction[]> {
    const transactions = await this.bankTransactionRepository.findByDateRange(
      startDate,
      endDate,
    );
    return transactions.map((t) => this.mapToProcessedTransaction(t));
  }

  async reconcileTransactions(
    reconciliationDto: ReconciliationDto,
  ): Promise<ReconciliationResult> {
    // Obtener todas las transacciones
    const filteredTransactions = await this.bankTransactionRepository.findAll();
    const processedTransactions = filteredTransactions.map((t) =>
      this.mapToProcessedTransaction(t),
    );

    // Filtrar por rango de fechas si se especifica
    let finalTransactions = processedTransactions;
    if (reconciliationDto.startDate && reconciliationDto.endDate) {
      const startDate = new Date(reconciliationDto.startDate);
      const endDate = new Date(reconciliationDto.endDate);
      finalTransactions = processedTransactions.filter((t) => {
        const transactionDate = new Date(t.date);
        return transactionDate >= startDate && transactionDate <= endDate;
      });
    }

    // Lógica de reconciliación básica
    const matchedTransactions = finalTransactions.filter(
      (t) => t.status === 'reconciled',
    ).length;
    const unmatchedTransactions = finalTransactions.filter(
      (t) => t.status !== 'reconciled',
    ).length;
    const totalTransactions = finalTransactions.length;

    const discrepancies: string[] = [];

    // Detectar posibles discrepancias
    const duplicateConcepts = this.findDuplicateConcepts(finalTransactions);
    if (duplicateConcepts.length > 0) {
      discrepancies.push(
        `Conceptos duplicados encontrados: ${duplicateConcepts.join(', ')}`,
      );
    }

    const highAmountTransactions = finalTransactions.filter(
      (t) => t.amount > 100000,
    );
    if (highAmountTransactions.length > 0) {
      discrepancies.push(
        `${highAmountTransactions.length} transacciones de monto alto`,
      );
    }

    return {
      success: discrepancies.length === 0,
      matchedTransactions,
      unmatchedTransactions,
      totalTransactions,
      reconciliationDate: new Date(),
      discrepancies,
    };
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
    return await this.bankTransactionRepository.getTransactionSummary();
  }

  private mapToProcessedTransaction(
    transaction: any,
  ): ProcessedBankTransaction {
    return {
      id: transaction.id,
      date: transaction.date,
      time: transaction.time,
      concept: transaction.concept,
      amount: transaction.amount,
      currency: transaction.currency,
      is_deposit: transaction.is_deposit,
      validation_flag: transaction.confirmation_status,
      status: transaction.confirmation_status ? 'reconciled' : 'pending',
      createdAt: transaction.created_at,
      updatedAt: transaction.updated_at,
    };
  }

  private generateId(): string {
    return `bank_txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private findDuplicateConcepts(
    transactions: ProcessedBankTransaction[],
  ): string[] {
    const conceptCounts = new Map<string, number>();

    transactions.forEach((t) => {
      if (t.concept) {
        conceptCounts.set(t.concept, (conceptCounts.get(t.concept) || 0) + 1);
      }
    });

    return Array.from(conceptCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([concept, _]) => concept);
  }
}
