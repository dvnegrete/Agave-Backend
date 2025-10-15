import { Injectable } from '@nestjs/common';
import { Repository, QueryRunner } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TransactionStatus } from '../entities/transaction-status.entity';
import { ValidationStatus } from '../entities/enums';

export interface CreateTransactionStatusDto {
  validation_status?: ValidationStatus;
  transactions_bank_id?: string | null;
  vouchers_id?: number | null;
}

export interface UpdateTransactionStatusDto {
  validation_status?: ValidationStatus;
  transactions_bank_id?: string | null;
  vouchers_id?: number | null;
}

@Injectable()
export class TransactionStatusRepository {
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
    return this.transactionStatusRepository.find({
      where: { transactions_bank_id: transactionBankId },
      relations: ['voucher', 'records'],
      order: { created_at: 'DESC' },
    });
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
