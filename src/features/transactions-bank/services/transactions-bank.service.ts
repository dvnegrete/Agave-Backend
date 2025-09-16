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
      let previouslyProcessedCount = 0;
      const lastDayDuplicates: TransactionBank[] = [];

      // Cache para transacciones de la BD por fecha para evitar múltiples consultas
      const dbTransactionsByDate = new Map<string, any[]>();

      // Crear mapa de transacciones del archivo por fecha para detección interna
      const fileTransactionsByDate = new Map<string, TransactionBank[]>();

      // Obtener transacciones del último día si existe registro de referencia
      let lastDayTransactions: any[] = [];
      if (referenceTransaction) {
        const referenceDate = new Date(referenceTransaction.date);
        const referenceDateString = referenceDate.toISOString().split('T')[0];
        lastDayTransactions = await this.bankTransactionRepository.findTransactionsByDateAndBank(
          referenceDate,
          currentBankName,
        );
        dbTransactionsByDate.set(referenceDateString, lastDayTransactions);
      }

      // Procesar transacciones válidas
      for (let index = 0; index < rawTransactions.length; index++) {
        const transaction = rawTransactions[index];
        const validation = validationResults[index];

        if (validation.isValid) {
          // Verificar si la transacción es posterior al registro de referencia
          if (this.isTransactionAfterLastProcessed(transaction, referenceTransaction, currentBankName)) {

            // 1. Verificar duplicados dentro del mismo archivo
            const transactionDateString = new Date(transaction.date).toISOString().split('T')[0];
            if (!fileTransactionsByDate.has(transactionDateString)) {
              fileTransactionsByDate.set(transactionDateString, []);
            }

            const isDuplicateInFile = this.isDuplicateInFile(
              transaction,
              fileTransactionsByDate.get(transactionDateString)!,
            );

            if (isDuplicateInFile) {
              lastDayDuplicates.push(transaction);
              previouslyProcessedCount++;
              continue;
            }

            // 2. Verificar duplicados contra la BD (último día procesado + días específicos)
            let dbTransactionsForDate: any[] = [];
            if (dbTransactionsByDate.has(transactionDateString)) {
              dbTransactionsForDate = dbTransactionsByDate.get(transactionDateString)!;
            } else {
              // Obtener transacciones de la BD para esta fecha específica
              const transactionDate = new Date(transaction.date);
              dbTransactionsForDate = await this.bankTransactionRepository.findTransactionsByDateAndBank(
                transactionDate,
                currentBankName,
              );
              dbTransactionsByDate.set(transactionDateString, dbTransactionsForDate);
            }

            const isDuplicateInDB = this.isDuplicateInDatabase(
              transaction,
              dbTransactionsForDate,
              currentBankName,
            );

            if (isDuplicateInDB) {
              lastDayDuplicates.push(transaction);
              previouslyProcessedCount++;
            } else {
              // Agregar a las transacciones válidas
              const processedTransaction: ProcessedBankTransaction = {
                ...transaction,
                id: this.generateId(),
                status: 'pending',
                createdAt: new Date(),
                updatedAt: new Date(),
              };
              validTransactions.push(processedTransaction);

              // Agregar al cache de archivo para futuras comparaciones
              fileTransactionsByDate.get(transactionDateString)!.push(transaction);
            }
          } else {
            previouslyProcessedCount++;
          }
        } else {
          errors.push(`Línea ${index + 1}: ${validation.errors.join(', ')}`);
        }
      }

      // Guardar transacciones válidas
      let savedTransactions: any[] = [];
      if (!options?.validateOnly) {
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

      return {
        success: errors.length === 0,
        totalTransactions: rawTransactions.length,
        validTransactions: validTransactions.length,
        invalidTransactions: rawTransactions.length - validTransactions.length - previouslyProcessedCount,
        previouslyProcessedTransactions: previouslyProcessedCount,
        transactions: validTransactions,
        errors,
        processingTime,
        bankName: options?.bankName,
        accountNumber: options?.accountNumber,
        dateRange,
        lastDayTransaction: lastDayDuplicates,
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

  private async getReferenceTransactionForBank(currentBankName: string): Promise<any | null> {
    try {
      // Obtener los últimos 7 registros
      const recentRecords = await this.lastTransactionBankRepository.findRecent(7);

      if (!recentRecords || recentRecords.length === 0) {
        return null;
      }

      // Buscar el primer registro que coincida con el banco actual
      for (const record of recentRecords) {
        if (record.transactionBank && record.transactionBank.bank_name === currentBankName) {
          console.log(`Banco coincidente encontrado en registro #${recentRecords.indexOf(record) + 1}: ${currentBankName}`);
          return record.transactionBank;
        }
      }

      // Si no se encuentra coincidencia, usar el más reciente y dejar que el sistema procese todas las transacciones
      console.log(`No se encontró banco coincidente "${currentBankName}" en los últimos 7 registros. Usando el más reciente.`);
      return recentRecords[0].transactionBank;
    } catch (error) {
      console.error('Error al obtener el registro de referencia para el banco:', error);
      return null;
    }
  }

  private isTransactionAfterLastProcessed(
    transaction: TransactionBank,
    lastProcessedTransaction: any | null,
    currentBankName: string,
  ): boolean {
    // Si no hay transacciones previas, procesar todas
    if (!lastProcessedTransaction) {
      return true;
    }

    try {
      // Comparar nombre del banco primero
      const lastProcessedBankName = lastProcessedTransaction.bank_name || '';

      // Si el banco es diferente, procesar todas las transacciones
      if (currentBankName !== lastProcessedBankName) {
        console.log(`Banco diferente detectado. Actual: "${currentBankName}", Anterior: "${lastProcessedBankName}". Procesando todas las transacciones.`);
        return true;
      }

      // Si es el mismo banco, comparar solo fechas (sin hora)
      const transactionDate = new Date(transaction.date);
      const lastProcessedDate = new Date(lastProcessedTransaction.date);

      // Verificar que las fechas sean válidas
      if (isNaN(transactionDate.getTime()) || isNaN(lastProcessedDate.getTime())) {
        throw new Error('Invalid date format');
      }

      transactionDate.setHours(0, 0, 0, 0);
      lastProcessedDate.setHours(0, 0, 0, 0);

      // Procesar transacciones del mismo día o posteriores
      console.warn(`transactionDate ${transactionDate.getDate()},  lastProcessedDate: ${lastProcessedDate.getDate()}. valor de operacion: ${transactionDate >= lastProcessedDate}`);
      return transactionDate >= lastProcessedDate;
    } catch (error) {
      console.error('Error al comparar fechas de transacciones:', error);
      // En caso de error, procesamos la transacción para no perder datos
      return true;
    }
  }

  private isDuplicateInFile(
    transaction: TransactionBank,
    fileTransactions: TransactionBank[],
  ): boolean {
    return fileTransactions.some((existingTx) => {
      const isSameDate = existingTx.date === transaction.date;
      const isSameTime = existingTx.time === transaction.time;
      const isSameConcept = existingTx.concept === transaction.concept;
      const isSameAmount = existingTx.amount === transaction.amount; // Comparación exacta
      const isSameBank = existingTx.bank_name === transaction.bank_name;

      const isDuplicate = isSameDate && isSameTime && isSameConcept && isSameAmount && isSameBank;

      if (isDuplicate) {
        console.error(`Duplicado en archivo detectado: fecha=${transaction.date}, hora=${transaction.time}, concepto="${transaction.concept}", monto=${transaction.amount}, banco="${transaction.bank_name}"`);
      }

      return isDuplicate;
    });
  }

  private isDuplicateInDatabase(
    transaction: TransactionBank,
    dbTransactions: any[],
    currentBankName: string,
  ): boolean {
    if (!dbTransactions.length) {
      return false;
    }

    try {
      const isDuplicate = dbTransactions.some((existingTx) => {
        // Normalizar fechas para comparación
        const transactionDate = new Date(transaction.date).toISOString().split('T')[0];
        const existingDate = new Date(existingTx.date).toISOString().split('T')[0];

        const isSameDate = existingDate === transactionDate;
        const isSameTime = existingTx.time === transaction.time;
        const isSameConcept = existingTx.concept === transaction.concept;
        const isSameAmount = existingTx.amount === transaction.amount; // Comparación exacta
        const isSameBank = existingTx.bank_name === currentBankName;

        return isSameDate && isSameTime && isSameConcept && isSameAmount && isSameBank;
      });

      if (isDuplicate) {
        console.log(`Duplicado en BD detectado: fecha=${transaction.date}, hora=${transaction.time}, concepto="${transaction.concept}", monto=${transaction.amount}, banco="${currentBankName}"`);
      }

      return isDuplicate;
    } catch (error) {
      console.error('Error en comparación de duplicados con BD:', error);
      // En caso de error, no marcar como duplicado para evitar pérdida de datos
      return false;
    }
  }
}
