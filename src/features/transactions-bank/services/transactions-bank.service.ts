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
    private readonly lastTransactionBankRepository: LastTransactionBankRepository,
  ) { }

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
      const currentBankName = options?.bank || options?.bankName || '';

      // Obtener el registro de referencia para evitar duplicados
      const referenceTransaction = await this.getReferenceTransactionForBank(currentBankName);

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
          console.error('Error al insertar transacciones:', error);
          throw new BadRequestException(`Error al guardar transacciones: ${error.message}`);
        }

        // Encontrar la transacción más reciente por fecha y hora
        if (savedTransactions.length > 0) {
          const latestTransaction = this.findLatestTransaction(savedTransactions);
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
      const invalidTransactions = rawTransactions.length - validTransactions.length;

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
      const currentDateTime = this.combineDateAndTime(current.date, current.time);
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

  private async saveLastTransactionReference(transactionId: string): Promise<void> {
    try {
      await this.lastTransactionBankRepository.create(transactionId);
      console.log(`Última transacción guardada en last_transaction_bank: ${transactionId}`);
    } catch (error) {
      console.error('Error al guardar la última transacción:', error);
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
      console.error('Error al obtener la última transacción procesada:', error);
      return null;
    }
  }

  // Esta función se mantiene solo para obtener referencia informativa
  // El trigger SQL maneja automáticamente la lógica de validación
  private async getReferenceTransactionForBank(currentBankName: string): Promise<any | null> {
    try {
      const recentRecords = await this.lastTransactionBankRepository.findRecent(7);
      if (!recentRecords || recentRecords.length === 0) {
        return null;
      }

      for (const record of recentRecords) {
        if (record.transactionBank && record.transactionBank.bank_name === currentBankName) {
          return record.transactionBank;
        }
      }

      return recentRecords[0].transactionBank;
    } catch (error) {
      console.error('Error al obtener el registro de referencia para el banco:', error);
      return null;
    }
  }

}
