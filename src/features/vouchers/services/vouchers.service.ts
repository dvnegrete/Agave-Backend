import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { FileProcessorService } from './file-processor.service';
import { TransactionValidatorService } from './transaction-validator.service';
import {
  ProcessedTransaction,
  FileProcessingResult,
} from '../interfaces/transaction.interface';
import { ProcessFileDto } from '../dto/process-file.dto';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
} from '../dto/transaction.dto';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';

@Injectable()
export class VouchersService {
  private transactions: ProcessedTransaction[] = [];

  constructor(
    private readonly fileProcessorService: FileProcessorService,
    private readonly transactionValidatorService: TransactionValidatorService,
    private readonly voucherRepository: VoucherRepository,
  ) {}

  async processFile(
    file: Express.Multer.File,
    options?: ProcessFileDto,
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
      const validTransactions: ProcessedTransaction[] = [];
      const errors: string[] = [];

      rawTransactions.forEach((transaction, index) => {
        const validation = validationResults[index];

        if (validation.isValid) {
          const processedTransaction: ProcessedTransaction = {
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

      return {
        success: errors.length === 0,
        totalTransactions: rawTransactions.length,
        validTransactions: validTransactions.length,
        invalidTransactions: rawTransactions.length - validTransactions.length,
        transactions: validTransactions,
        errors,
        processingTime,
      };
    } catch (error) {
      throw new BadRequestException(
        `Error al procesar el archivo: ${error.message}`,
      );
    }
  }

  /**
   * Obtiene todos los vouchers desde la base de datos
   * @returns Lista de todos los vouchers registrados
   */
  async getAllTransactions() {
    return await this.voucherRepository.findAll();
  }

  async getTransactionById(id: string): Promise<ProcessedTransaction> {
    const transaction = this.transactions.find((t) => t.id === id);
    if (!transaction) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }
    return transaction;
  }

  async createTransaction(
    createTransactionDto: CreateTransactionDto,
  ): Promise<ProcessedTransaction> {
    const transaction: ProcessedTransaction = {
      ...createTransactionDto,
      id: this.generateId(),
      date: new Date(createTransactionDto.date),
      status: 'pending',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Validar la transacción
    const validation =
      await this.transactionValidatorService.validateTransaction(transaction);
    if (!validation.isValid) {
      throw new BadRequestException(
        `Transacción inválida: ${validation.errors.join(', ')}`,
      );
    }

    this.transactions.push(transaction);
    return transaction;
  }

  async updateTransaction(
    id: string,
    updateTransactionDto: UpdateTransactionDto,
  ): Promise<ProcessedTransaction> {
    const index = this.transactions.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }

    const updatedTransaction: ProcessedTransaction = {
      ...this.transactions[index],
      id,
      updatedAt: new Date(),
    };

    // Actualizar solo las propiedades que están presentes en el DTO
    if (updateTransactionDto.date) {
      updatedTransaction.date = new Date(updateTransactionDto.date);
    }
    if (updateTransactionDto.description) {
      updatedTransaction.description = updateTransactionDto.description;
    }
    if (updateTransactionDto.amount !== undefined) {
      updatedTransaction.amount = updateTransactionDto.amount;
    }
    if (updateTransactionDto.type) {
      updatedTransaction.type = updateTransactionDto.type;
    }
    if (updateTransactionDto.accountNumber) {
      updatedTransaction.accountNumber = updateTransactionDto.accountNumber;
    }
    if (updateTransactionDto.reference !== undefined) {
      updatedTransaction.reference = updateTransactionDto.reference;
    }
    if (updateTransactionDto.category !== undefined) {
      updatedTransaction.category = updateTransactionDto.category;
    }
    if (updateTransactionDto.status) {
      updatedTransaction.status = updateTransactionDto.status;
    }

    // Validar la transacción actualizada
    const validation =
      await this.transactionValidatorService.validateTransaction(
        updatedTransaction,
      );
    if (!validation.isValid) {
      throw new BadRequestException(
        `Transacción inválida: ${validation.errors.join(', ')}`,
      );
    }

    this.transactions[index] = updatedTransaction;
    return updatedTransaction;
  }

  async deleteTransaction(id: string): Promise<void> {
    const index = this.transactions.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new NotFoundException(`Transacción con ID ${id} no encontrada`);
    }

    this.transactions.splice(index, 1);
  }

  async getTransactionsByStatus(
    status: 'pending' | 'processed' | 'failed',
  ): Promise<ProcessedTransaction[]> {
    return this.transactions.filter((t) => t.status === status);
  }

  async getTransactionsByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<ProcessedTransaction[]> {
    return this.transactions.filter(
      (t) => t.date >= startDate && t.date <= endDate,
    );
  }

  async getTransactionSummary(): Promise<{
    total: number;
    pending: number;
    processed: number;
    failed: number;
    totalAmount: number;
  }> {
    const total = this.transactions.length;
    const pending = this.transactions.filter(
      (t) => t.status === 'pending',
    ).length;
    const processed = this.transactions.filter(
      (t) => t.status === 'processed',
    ).length;
    const failed = this.transactions.filter(
      (t) => t.status === 'failed',
    ).length;

    const totalAmount = this.transactions.reduce((sum, t) => {
      return sum + (t.type === 'credit' ? t.amount : -t.amount);
    }, 0);

    return {
      total,
      pending,
      processed,
      failed,
      totalAmount,
    };
  }

  private generateId(): string {
    return `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}
