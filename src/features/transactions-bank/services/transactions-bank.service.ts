import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileProcessorService } from './file-processor.service';
import { TransactionValidatorService } from './transaction-validator.service';
import { TransactionBankRepository } from '../../../shared/database/repositories/transaction-bank.repository';
import { LastTransactionBankRepository } from '../../../shared/database/repositories/last-transaction-bank.repository';
import {
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
import {
  TransactionsBankErrorMessages,
  TransactionsBankWarningMessages,
} from '@/shared/content';

@Injectable()
export class TransactionsBankService {
  constructor(
    private readonly fileProcessorService: FileProcessorService,
    private readonly transactionValidatorService: TransactionValidatorService,
    private readonly bankTransactionRepository: TransactionBankRepository,
    private readonly lastTransactionBankRepository: LastTransactionBankRepository,
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

      // Determinar el nombre del banco del archivo actual
      const currentBankName = options?.bankName || '';

      // Validar transacciones
      const validationResults = await Promise.all(
        rawTransactions.map((transaction) =>
          this.transactionValidatorService.validateTransaction(transaction),
        ),
      );

      // Filtrar transacciones válidas
      const validTransactions: ProcessedBankTransaction[] = [];
      const errors: string[] = [];

      // Procesar transacciones válidas
      for (let index = 0; index < rawTransactions.length; index++) {
        const transaction = rawTransactions[index];
        const validation = validationResults[index];

        if (validation.isValid) {
          // El trigger SQL maneja automáticamente los duplicados
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
      }

      // Guardar transacciones válidas (el trigger SQL maneja duplicados automáticamente)
      let savedTransactions: any[] = [];
      if (!options?.validateOnly) {
        try {
          savedTransactions = await this.bankTransactionRepository.createMany(
            validTransactions.map((transaction) => ({
              date: transaction.date,
              time: transaction.time,
              concept: transaction.concept,
              amount: transaction.amount,
              currency: transaction.currency,
              is_deposit: transaction.is_deposit,
              bank_name: transaction.bank_name,
              validation_flag: transaction.validation_flag,
            })),
          );
        } catch (error) {
          throw new BadRequestException(
            TransactionsBankErrorMessages.savingError(error.message),
          );
        }

        // Encontrar la transacción más reciente por fecha y hora
        if (savedTransactions.length > 0) {
          const latestTransaction =
            this.findLatestTransaction(savedTransactions);
          if (latestTransaction) {
            await this.saveLastTransactionReference(latestTransaction.id);
          }
        }
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

      // Calcular estadísticas
      const actuallyInserted = savedTransactions.length;
      const duplicatesIgnored = validTransactions.length - actuallyInserted;
      const invalidTransactions =
        rawTransactions.length - validTransactions.length;

      return {
        success: errors.length === 0,
        totalTransactions: rawTransactions.length,
        validTransactions: actuallyInserted,
        invalidTransactions: invalidTransactions,
        previouslyProcessedTransactions: duplicatesIgnored,
        transactions: validTransactions,
        errors,
        processingTime,
        bankName: options?.bankName,
        accountNumber: options?.accountNumber,
        dateRange,
        lastDayTransaction: [], // El trigger SQL maneja duplicados
      };
    } catch (error) {
      throw new BadRequestException(
        TransactionsBankErrorMessages.fileProcessingErrorDetail(error.message),
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
        TransactionsBankErrorMessages.transactionNotFound(id),
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
    const transactions =
      await this.bankTransactionRepository.findByStatus(status);
    return transactions.map((t) => this.mapToProcessedTransaction(t));
  }

  async getTransactionsByDateRange(
    startDate: string | Date,
    endDate: string | Date,
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
        TransactionsBankWarningMessages.duplicateConceptsFound(
          duplicateConcepts,
        ),
      );
    }

    const highAmountTransactions = finalTransactions.filter(
      (t) => t.amount > 100000,
    );
    if (highAmountTransactions.length > 0) {
      discrepancies.push(
        TransactionsBankWarningMessages.highAmountTransactions(
          highAmountTransactions.length,
        ),
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

  async getExpensesByMonth(
    date: string | Date,
  ): Promise<{
    month: string;
    expenses: ProcessedBankTransaction[];
    summary: {
      totalExpenses: number;
      count: number;
      currencies: string[];
      largestExpense: number;
    };
  }> {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const monthStr = `${year}-${month}`;

    const transactions =
      await this.bankTransactionRepository.findExpensesByMonth(date);
    const processedTransactions = transactions.map((t) =>
      this.mapToProcessedTransaction(t),
    );

    // Calcular resumen
    const totalExpenses = processedTransactions.reduce(
      (sum, t) => sum + t.amount,
      0,
    );
    const currencies = [...new Set(processedTransactions.map((t) => t.currency))];
    const largestExpense =
      processedTransactions.length > 0
        ? Math.max(...processedTransactions.map((t) => t.amount))
        : 0;

    return {
      month: monthStr,
      expenses: processedTransactions,
      summary: {
        totalExpenses,
        count: processedTransactions.length,
        currencies,
        largestExpense,
      },
    };
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
      bank_name: transaction.bank_name,
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

  private findLatestTransaction(transactions: any[]): any | null {
    if (!transactions || transactions.length === 0) {
      return null;
    }

    return transactions.reduce((latest, current) => {
      const currentDateTime = this.combineDateAndTime(
        current.date,
        current.time,
      );
      const latestDateTime = this.combineDateAndTime(latest.date, latest.time);

      return currentDateTime > latestDateTime ? current : latest;
    });
  }

  private combineDateAndTime(date: Date | string, time: string): Date {
    try {
      const dateObj = typeof date === 'string' ? new Date(date) : date;

      // Verificar que la fecha sea válida
      if (isNaN(dateObj.getTime())) {
        throw new Error('Invalid date');
      }

      const timeParts = time.split(':');
      const hours = parseInt(timeParts[0]) || 0;
      const minutes = parseInt(timeParts[1]) || 0;
      const seconds = parseInt(timeParts[2]) || 0;

      // Verificar que las partes de tiempo sean válidas
      if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) {
        throw new Error('Invalid time');
      }

      const combined = new Date(dateObj);
      combined.setHours(hours, minutes, seconds, 0);

      return combined;
    } catch (error) {
      throw new Error(`Error combining date and time: ${error.message}`);
    }
  }

  private async saveLastTransactionReference(
    transactionId: string,
  ): Promise<void> {
    try {
      await this.lastTransactionBankRepository.create(Number(transactionId));
    } catch (error) {
      // No lanzamos la excepción para no interrumpir el proceso principal
    }
  }

  private async getLastProcessedTransaction(): Promise<any | null> {
    try {
      const lastRecord = await this.lastTransactionBankRepository.findLatest();
      if (!lastRecord || !lastRecord.transactionBank) {
        return null;
      }
      return lastRecord.transactionBank;
    } catch (error) {
      return null;
    }
  }
}
