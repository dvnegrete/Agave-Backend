import { Injectable, Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { TransactionStatusRepository } from '@/shared/database/repositories/transaction-status.repository';
import { RecordRepository } from '@/shared/database/repositories/record.repository';
import { HouseRecordRepository } from '@/shared/database/repositories/house-record.repository';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { Voucher } from '@/shared/database/entities/voucher.entity';
import { ValidationStatus } from '@/shared/database/entities/enums';
import { GcsCleanupService } from '@/shared/libs/google-cloud/gcs-cleanup.service';

/**
 * Servicio de infraestructura para persistencia de conciliaciones
 * Maneja todas las operaciones de base de datos relacionadas con la conciliación
 */
@Injectable()
export class ReconciliationPersistenceService {
  private readonly logger = new Logger(ReconciliationPersistenceService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly transactionStatusRepository: TransactionStatusRepository,
    private readonly recordRepository: RecordRepository,
    private readonly houseRecordRepository: HouseRecordRepository,
    private readonly houseRepository: HouseRepository,
    private readonly voucherRepository: VoucherRepository,
    private readonly gcsCleanupService: GcsCleanupService,
  ) {}

  /**
   * Persiste una conciliación exitosa en la base de datos
   * Crea todos los registros necesarios en una transacción atómica
   *
   * @param transactionBankId - ID de la transacción bancaria
   * @param voucher - Objeto completo del voucher (ya obtenido en el matching)
   * @param houseNumber - Número de casa
   */
  async persistReconciliation(
    transactionBankId: string,
    voucher: Voucher,
    houseNumber: number,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Crear TransactionStatus asociando transaction_bank con voucher
      const transactionStatus = await this.createTransactionStatus(
        transactionBankId,
        voucher.id,
        queryRunner,
      );

      // 2. Obtener o crear Record
      const recordId = await this.getOrCreateRecord(
        voucher.id,
        transactionStatus.id,
        queryRunner,
      );

      // 3. Verificar que la casa existe y crear HouseRecord
      await this.createHouseRecordAssociation(
        houseNumber,
        recordId,
        queryRunner,
      );

      // 4. Actualizar confirmation_status en TransactionBank
      await this.updateTransactionBankStatus(transactionBankId, queryRunner);

      // Pasar el objeto Voucher completo para evitar consulta adicional a BD
      await this.updateVoucherStatus(voucher, queryRunner);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Conciliación exitosa: TransactionBank ${transactionBankId} <-> Voucher ${voucher.id} -> Casa ${houseNumber}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error al persistir conciliación: ${errorMessage}`,
        errorStack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Crea un TransactionStatus con validation_status = CONFIRMED
   */
  private async createTransactionStatus(
    transactionBankId: string,
    voucherId: number,
    queryRunner: QueryRunner,
  ) {
    return await this.transactionStatusRepository.create(
      {
        validation_status: ValidationStatus.CONFIRMED,
        transactions_bank_id: transactionBankId,
        vouchers_id: voucherId,
      },
      queryRunner,
    );
  }

  /**
   * Obtiene el Record existente del voucher o crea uno nuevo
   * Regla de negocio: Reutilizar record si ya existe
   */
  private async getOrCreateRecord(
    voucherId: number,
    transactionStatusId: number,
    queryRunner: QueryRunner,
  ): Promise<number> {
    const voucher = await this.voucherRepository.findById(voucherId);

    if (voucher?.records && voucher.records.length > 0) {
      // Usar record existente
      const existingRecord = voucher.records[0];
      this.logger.log(
        `Usando record existente ID: ${existingRecord.id} para voucher ID: ${voucherId}`,
      );
      return existingRecord.id;
    } else {
      // Crear nuevo record
      const newRecord = await this.recordRepository.create(
        {
          vouchers_id: voucherId,
          transaction_status_id: transactionStatusId,
        },
        queryRunner,
      );
      this.logger.log(
        `Creado nuevo record ID: ${newRecord.id} para voucher ID: ${voucherId}`,
      );
      return newRecord.id;
    }
  }

  /**
   * Crea la asociación HouseRecord después de verificar que la casa existe
   */
  private async createHouseRecordAssociation(
    houseNumber: number,
    recordId: number,
    queryRunner: QueryRunner,
  ): Promise<void> {
    const house = await this.houseRepository.findByNumberHouse(houseNumber);

    if (!house) {
      throw new Error(`Casa con número ${houseNumber} no encontrada`);
    }

    await this.houseRecordRepository.create(
      {
        house_id: house.id,
        record_id: recordId,
      },
      queryRunner,
    );
  }

  /**
   * Actualiza confirmation_status = TRUE en TransactionBank
   */
  private async updateTransactionBankStatus(
    transactionBankId: string,
    queryRunner: QueryRunner,
  ): Promise<void> {
    await queryRunner.manager.update(
      'transactions_bank',
      { id: transactionBankId },
      { confirmation_status: true },
    );
  }

  /**
   * Actualiza confirmation_status = TRUE en Voucher y elimina el archivo del bucket
   *
   * Proceso:
   * 1. Si voucher tiene URL (nombre del archivo), elimina el archivo del bucket
   * 2. Actualiza el registro: confirmation_status = TRUE, url = NULL
   *
   * NOTA: El campo `url` contiene solo el NOMBRE DEL ARCHIVO (ej: p-2025-10-17_14-30-45-uuid.jpg)
   * no una URL completa. El bucket se obtiene de la configuración por defecto.
   */
  private async updateVoucherStatus(
    voucher: Voucher,
    queryRunner: QueryRunner,
  ): Promise<void> {
    if (voucher.url) {
      await this.gcsCleanupService.deleteFile(voucher.url, {
        reason: 'reconciliacion-completada',
        fileType: 'permanente',
        blocking: false,
      });
    }

    // 2. Actualizar confirmation_status = TRUE y url = NULL
    await queryRunner.manager.update(
      'vouchers',
      { id: voucher.id },
      { confirmation_status: true, url: null },
    );
  }
}
