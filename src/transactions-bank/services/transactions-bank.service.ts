import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { FileProcessorService } from './file-processor.service';
import { TransactionValidatorService } from './transaction-validator.service';
import { 
  TransactionBank, 
  ProcessedBankTransaction, 
  FileProcessingResult,
  ReconciliationResult
} from '../interfaces/bank-transaction.interface';
import { UploadFileDto } from '../dto/upload-file.dto';
import { CreateBankTransactionDto, UpdateBankTransactionDto, ReconciliationDto } from '../dto/bank-transaction.dto';

@Injectable()
export class TransactionsBankService {
  private transactions: ProcessedBankTransaction[] = [];

  constructor(
    private readonly fileProcessorService: FileProcessorService,
    private readonly transactionValidatorService: TransactionValidatorService,
  ) {}

  async processFile(file: Express.Multer.File, options?: UploadFileDto): Promise<FileProcessingResult> {
    try {
      const startTime = Date.now();

      // Procesar el archivo
      const rawTransactions = await this.fileProcessorService.parseFile(file, options);

      // Validar transacciones
      const validationResults = await Promise.all(
        rawTransactions.map(transaction => 
          this.transactionValidatorService.validateTransaction(transaction)
        )
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
        this.transactions.push(...validTransactions);
      }

      const processingTime = Date.now() - startTime;

      // Determinar rango de fechas
      const dates = validTransactions.map(t => new Date(t.date)).sort();
      const dateRange = dates.length > 0 ? {
        start: dates[0],
        end: dates[dates.length - 1]
      } : undefined;

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
      throw new BadRequestException(`Error al procesar el archivo: ${error.message}`);
    }
  }

  async getAllTransactions(): Promise<ProcessedBankTransaction[]> {
    return this.transactions;
  }

  async getTransactionById(id: string): Promise<ProcessedBankTransaction> {
    const transaction = this.transactions.find(t => t.id === id);
    if (!transaction) {
      throw new NotFoundException(`Transacción bancaria con ID ${id} no encontrada`);
    }
    return transaction;
  }

  async createTransaction(createTransactionDto: CreateBankTransactionDto): Promise<ProcessedBankTransaction> {
    const transaction: ProcessedBankTransaction = {
      ...createTransactionDto,
      id: this.generateId(),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Validar la transacción
    const validation = await this.transactionValidatorService.validateTransaction(transaction);
    if (!validation.isValid) {
      throw new BadRequestException(`Transacción bancaria inválida: ${validation.errors.join(', ')}`);
    }

    this.transactions.push(transaction);
    return transaction;
  }

  async updateTransaction(id: string, updateTransactionDto: UpdateBankTransactionDto): Promise<ProcessedBankTransaction> {
    const index = this.transactions.findIndex(t => t.id === id);
    if (index === -1) {
      throw new NotFoundException(`Transacción bancaria con ID ${id} no encontrada`);
    }

    const updatedTransaction: ProcessedBankTransaction = {
      ...this.transactions[index],
      id,
      updatedAt: new Date(),
    };

    // Actualizar solo las propiedades que están presentes en el DTO
    if (updateTransactionDto.date) {
      updatedTransaction.date = updateTransactionDto.date;
    }
    if (updateTransactionDto.time) {
      updatedTransaction.time = updateTransactionDto.time;
    }
    if (updateTransactionDto.concept) {
      updatedTransaction.concept = updateTransactionDto.concept;
    }
    if (updateTransactionDto.amount !== undefined) {
      updatedTransaction.amount = updateTransactionDto.amount;
    }
    if (updateTransactionDto.currency) {
      updatedTransaction.currency = updateTransactionDto.currency;
    }
    if (updateTransactionDto.is_deposit !== undefined) {
      updatedTransaction.is_deposit = updateTransactionDto.is_deposit;
    }
    if (updateTransactionDto.validation_flag !== undefined) {
      updatedTransaction.validation_flag = updateTransactionDto.validation_flag;
    }
    if (updateTransactionDto.status) {
      updatedTransaction.status = updateTransactionDto.status;
    }

    // Validar la transacción actualizada
    const validation = await this.transactionValidatorService.validateTransaction(updatedTransaction);
    if (!validation.isValid) {
      throw new BadRequestException(`Transacción bancaria inválida: ${validation.errors.join(', ')}`);
    }

    this.transactions[index] = updatedTransaction;
    return updatedTransaction;
  }

  async deleteTransaction(id: string): Promise<void> {
    const index = this.transactions.findIndex(t => t.id === id);
    if (index === -1) {
      throw new NotFoundException(`Transacción bancaria con ID ${id} no encontrada`);
    }

    this.transactions.splice(index, 1);
  }

  async getTransactionsByStatus(status: 'pending' | 'processed' | 'failed' | 'reconciled'): Promise<ProcessedBankTransaction[]> {
    return this.transactions.filter(t => t.status === status);
  }

  async getTransactionsByDateRange(startDate: Date, endDate: Date): Promise<ProcessedBankTransaction[]> {
    return this.transactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= startDate && transactionDate <= endDate;
    });
  }

  async reconcileTransactions(reconciliationDto: ReconciliationDto): Promise<ReconciliationResult> {
    // Para reconciliación, usamos todas las transacciones ya que no tenemos accountNumber
    let filteredTransactions = this.transactions;

    // Filtrar por rango de fechas si se especifica
    if (reconciliationDto.startDate && reconciliationDto.endDate) {
      const startDate = new Date(reconciliationDto.startDate);
      const endDate = new Date(reconciliationDto.endDate);
      filteredTransactions = this.transactions.filter(t => {
        const transactionDate = new Date(t.date);
        return transactionDate >= startDate && transactionDate <= endDate;
      });
    }

    // Lógica de reconciliación básica
    const matchedTransactions = filteredTransactions.filter(t => t.status === 'reconciled').length;
    const unmatchedTransactions = filteredTransactions.filter(t => t.status !== 'reconciled').length;
    const totalTransactions = filteredTransactions.length;

    const discrepancies: string[] = [];
    
    // Detectar posibles discrepancias
    const duplicateConcepts = this.findDuplicateConcepts(filteredTransactions);
    if (duplicateConcepts.length > 0) {
      discrepancies.push(`Conceptos duplicados encontrados: ${duplicateConcepts.join(', ')}`);
    }

    const highAmountTransactions = filteredTransactions.filter(t => t.amount > 100000);
    if (highAmountTransactions.length > 0) {
      discrepancies.push(`${highAmountTransactions.length} transacciones de monto alto`);
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
    const total = this.transactions.length;
    const pending = this.transactions.filter(t => t.status === 'pending').length;
    const processed = this.transactions.filter(t => t.status === 'processed').length;
    const failed = this.transactions.filter(t => t.status === 'failed').length;
    const reconciled = this.transactions.filter(t => t.status === 'reconciled').length;
    
    const totalAmount = this.transactions.reduce((sum, t) => {
      return sum + (t.is_deposit ? t.amount : -t.amount);
    }, 0);

    const currencies = [...new Set(this.transactions.map(t => t.currency))];
    const concepts = [...new Set(this.transactions.map(t => t.concept))];

    return {
      total,
      pending,
      processed,
      failed,
      reconciled,
      totalAmount,
      currencies,
      concepts,
    };
  }

  private generateId(): string {
    return `bank_txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private findDuplicateConcepts(transactions: ProcessedBankTransaction[]): string[] {
    const conceptCounts = new Map<string, number>();
    
    transactions.forEach(t => {
      if (t.concept) {
        conceptCounts.set(t.concept, (conceptCounts.get(t.concept) || 0) + 1);
      }
    });

    return Array.from(conceptCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([concept, _]) => concept);
  }
}
