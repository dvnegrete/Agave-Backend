import { Injectable, Logger } from '@nestjs/common';
import { Repository, QueryRunner } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionStatus } from '../entities/transaction-status.entity';
import { ValidationStatus } from '../entities/enums';

export interface CreateTransactionStatusDto {
  validation_status?: ValidationStatus;
  transactions_bank_id?: number | null;
  vouchers_id?: number | null;
  reason?: string;
  identified_house_number?: number;
  processed_at?: Date;
  metadata?: {
    possibleMatches?: Array<{
      voucherId: number;
      similarity: number;
      dateDifferenceHours: number;
    }>;
    matchCriteria?: string[];
    confidenceLevel?: string;
  };
}

export interface UpdateTransactionStatusDto {
  validation_status?: ValidationStatus;
  transactions_bank_id?: number | null;
  vouchers_id?: number | null;
  reason?: string;
  identified_house_number?: number;
  processed_at?: Date;
  metadata?: {
    possibleMatches?: Array<{
      voucherId: number;
      similarity: number;
      dateDifferenceHours: number;
    }>;
    matchCriteria?: string[];
    confidenceLevel?: string;
  };
}

@Injectable()
export class TransactionStatusRepository {
  private readonly logger = new Logger(TransactionStatusRepository.name);

  constructor(
    @InjectRepository(TransactionStatus)
    private transactionStatusRepository: Repository<TransactionStatus>,
  ) {}

  /**
   * Crea un nuevo transaction status
   */
  async create(
    data: CreateTransactionStatusDto,
    queryRunner?: QueryRunner,
  ): Promise<TransactionStatus> {
    const transactionStatusData: Partial<TransactionStatus> = {
      validation_status: data.validation_status || ValidationStatus.PENDING,
      transactions_bank_id: data.transactions_bank_id ?? undefined,
      vouchers_id: data.vouchers_id ?? undefined,
      reason: data.reason,
      identified_house_number: data.identified_house_number,
      processed_at: data.processed_at,
      metadata: data.metadata,
    };

    if (queryRunner) {
      const transactionStatus = queryRunner.manager.create(
        TransactionStatus,
        transactionStatusData,
      );
      return await queryRunner.manager.save(transactionStatus);
    }

    const transactionStatus = this.transactionStatusRepository.create(
      transactionStatusData,
    );
    return await this.transactionStatusRepository.save(transactionStatus);
  }

  /**
   * Busca un transaction status por su ID
   */
  async findById(id: number): Promise<TransactionStatus | null> {
    return this.transactionStatusRepository.findOne({
      where: { id },
      relations: ['transactionBank', 'voucher', 'records'],
    });
  }

  /**
   * Busca transaction status por bank transaction ID
   */
  async findByTransactionBankId(
    transactionBankId: string,
  ): Promise<TransactionStatus[]> {
    const results = await this.transactionStatusRepository.find({
      where: { transactions_bank_id: Number(transactionBankId) },
      relations: ['voucher', 'records'],
      order: { created_at: 'DESC' },
    });

    if (results.length > 1) {
      this.logger.warn(
        `TransactionStatus duplicados detectados para TransactionBank ${transactionBankId}. ` +
          `Encontrados: ${results.length}, IDs: [${results.map((r) => r.id).join(', ')}]`,
      );
    }

    return results;
  }

  /**
   * Busca transaction status por voucher ID
   */
  async findByVoucherId(voucherId: number): Promise<TransactionStatus[]> {
    return this.transactionStatusRepository.find({
      where: { vouchers_id: voucherId },
      relations: ['transactionBank', 'records'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Busca transaction status por validation status
   */
  async findByValidationStatus(
    status: ValidationStatus,
  ): Promise<TransactionStatus[]> {
    return this.transactionStatusRepository.find({
      where: { validation_status: status },
      relations: ['transactionBank', 'voucher', 'records'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Obtiene todos los transaction status
   */
  async findAll(): Promise<TransactionStatus[]> {
    return this.transactionStatusRepository.find({
      relations: ['transactionBank', 'voucher', 'records'],
      order: { created_at: 'DESC' },
    });
  }

  /**
   * Actualiza un transaction status por su ID
   */
  async update(
    id: number,
    data: UpdateTransactionStatusDto,
  ): Promise<TransactionStatus> {
    const updateData: Partial<TransactionStatus> = {};
    if (data.validation_status !== undefined)
      updateData.validation_status = data.validation_status;
    if (data.transactions_bank_id !== undefined)
      updateData.transactions_bank_id = data.transactions_bank_id ?? undefined;
    if (data.vouchers_id !== undefined)
      updateData.vouchers_id = data.vouchers_id ?? undefined;
    if (data.reason !== undefined) updateData.reason = data.reason;
    if (data.identified_house_number !== undefined)
      updateData.identified_house_number = data.identified_house_number;
    if (data.processed_at !== undefined)
      updateData.processed_at = data.processed_at;
    if (data.metadata !== undefined) updateData.metadata = data.metadata;

    await this.transactionStatusRepository.update(id, updateData);
    const updated = await this.findById(id);
    if (!updated) {
      throw new Error(`TransactionStatus con ID ${id} no encontrado`);
    }
    return updated;
  }

  /**
   * Elimina un transaction status por su ID
   */
  async delete(id: number): Promise<void> {
    await this.transactionStatusRepository.delete(id);
  }
}
