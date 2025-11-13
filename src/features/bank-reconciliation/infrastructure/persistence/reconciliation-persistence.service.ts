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
import { SurplusTransaction, ManualValidationCase } from '../../domain';

/**
 * UUID del usuario "Sistema" para casas creadas automáticamente por conciliación bancaria
 * Este usuario debe existir en la tabla users
 *
 * IMPORTANTE: Asegúrate de que existe un usuario con este UUID en tu base de datos.
 * Si no existe, créalo con:
 * INSERT INTO users (id, email) VALUES ('00000000-0000-0000-0000-000000000000', 'sistema@conciliacion.local');
 */
const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

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
   * @param voucher - Objeto completo del voucher (puede ser null si conciliación automática sin voucher)
   * @param houseNumber - Número de casa
   */
  async persistReconciliation(
    transactionBankId: string,
    voucher: Voucher | null,
    houseNumber: number,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Crear TransactionStatus (con o sin voucher)
      const transactionStatus = await this.createTransactionStatus(
        transactionBankId,
        voucher?.id ?? null,
        queryRunner,
      );

      // 2. Obtener o crear Record (solo si hay voucher)
      let recordId: number;
      if (voucher) {
        recordId = await this.getOrCreateRecord(
          voucher.id,
          transactionStatus.id,
          queryRunner,
        );
      } else {
        // Sin voucher, crear record directamente
        const newRecord = await this.recordRepository.create(
          {
            vouchers_id: null,
            transaction_status_id: transactionStatus.id,
          },
          queryRunner,
        );
        recordId = newRecord.id;
        this.logger.log(
          `Creado record sin voucher ID: ${recordId} para TransactionStatus ID: ${transactionStatus.id}`,
        );
      }

      // 3. Verificar que la casa existe y crear HouseRecord
      await this.createHouseRecordAssociation(
        houseNumber,
        recordId,
        queryRunner,
      );

      // 4. Actualizar confirmation_status en TransactionBank
      await this.updateTransactionBankStatus(transactionBankId, queryRunner);

      // 5. Actualizar voucher solo si existe
      if (voucher) {
        await this.updateVoucherStatus(voucher, queryRunner);
      }

      await queryRunner.commitTransaction();

      const voucherInfo = voucher
        ? `Voucher ${voucher.id}`
        : 'Sin voucher (conciliación automática)';
      this.logger.log(
        `Conciliación exitosa: TransactionBank ${transactionBankId} <-> ${voucherInfo} -> Casa ${houseNumber}`,
      );

      // 6. Eliminar archivo del bucket si el voucher tiene URL (fire-and-forget)
      if (voucher?.url) {
        this.deleteVoucherFileFromBucket(voucher.id, voucher.url).catch(
          (error) => {
            this.logger.warn(
              `No se pudo eliminar archivo del bucket para voucher ${voucher.id}: ${error.message}`,
            );
          },
        );
      }
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
   * @param voucherId - ID del voucher (puede ser null si conciliación automática)
   * @param metadata - Información adicional de la conciliación (matchCriteria, confidenceLevel)
   */
  private async createTransactionStatus(
    transactionBankId: string,
    voucherId: number | null,
    queryRunner: QueryRunner,
    metadata?: {
      matchCriteria?: string[];
      confidenceLevel?: string;
    },
  ) {
    return await this.transactionStatusRepository.create(
      {
        validation_status: ValidationStatus.CONFIRMED,
        transactions_bank_id: transactionBankId,
        vouchers_id: voucherId,
        reason: voucherId
          ? 'Conciliado con voucher'
          : 'Conciliado automáticamente por centavos/concepto',
        processed_at: new Date(),
        metadata: metadata,
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
   * Crea la asociación HouseRecord, creando la casa si no existe
   * Sigue el mismo patrón que confirm-voucher.use-case.ts
   */
  private async createHouseRecordAssociation(
    houseNumber: number,
    recordId: number,
    queryRunner: QueryRunner,
  ): Promise<void> {
    // Buscar casa existente por número
    let house = await this.houseRepository.findByNumberHouse(houseNumber);

    if (!house) {
      // Casa no existe, crear nueva asignada al usuario "Sistema"
      this.logger.log(
        `Casa ${houseNumber} no existe, creando automáticamente (asignada a usuario Sistema)`,
      );

      house = await this.houseRepository.create(
        {
          number_house: houseNumber,
          user_id: SYSTEM_USER_ID, // Usuario "Sistema" para conciliación automática
        },
        queryRunner,
      );

      this.logger.log(
        `Casa ${houseNumber} creada exitosamente con ID: ${house.id} (propietario: Sistema)`,
      );
    }

    // Crear asociación en house_records
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

  /**
   * Persiste una transacción sobrante en la base de datos
   * Crea un TransactionStatus con estado NOT_FOUND o CONFLICT
   *
   * @param transactionBankId - ID de la transacción bancaria
   * @param surplus - Objeto SurplusTransaction con información del sobrante
   */
  async persistSurplus(
    transactionBankId: string,
    surplus: SurplusTransaction,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Determinar el status según si requiere validación manual
      // CONFLICT: cuando hay conflicto entre centavos y concepto
      // NOT_FOUND: cuando no hay información suficiente
      const status = surplus.reason.includes('Conflicto')
        ? ValidationStatus.CONFLICT
        : ValidationStatus.NOT_FOUND;

      await this.transactionStatusRepository.create(
        {
          validation_status: status,
          transactions_bank_id: transactionBankId,
          vouchers_id: null,
          reason: surplus.reason,
          identified_house_number: surplus.houseNumber,
          processed_at: new Date(),
          metadata: undefined,
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();
      this.logger.log(
        `Sobrante persistido: Transaction ${transactionBankId}, Status: ${status}, Razón: ${surplus.reason}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error al persistir sobrante: ${errorMessage}`,
        errorStack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Persiste un caso que requiere validación manual
   * Guarda los posibles candidatos en el campo metadata para revisión posterior
   *
   * @param transactionBankId - ID de la transacción bancaria
   * @param manualCase - Objeto ManualValidationCase con candidatos y scores
   */
  async persistManualValidationCase(
    transactionBankId: string,
    manualCase: ManualValidationCase,
  ): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await this.transactionStatusRepository.create(
        {
          validation_status: ValidationStatus.REQUIRES_MANUAL,
          transactions_bank_id: transactionBankId,
          vouchers_id: null,
          reason: manualCase.reason,
          identified_house_number: undefined,
          processed_at: new Date(),
          metadata: {
            possibleMatches: manualCase.possibleMatches,
          },
        },
        queryRunner,
      );

      await queryRunner.commitTransaction();
      this.logger.log(
        `Caso manual persistido: Transaction ${transactionBankId}, Candidatos: ${manualCase.possibleMatches.length}, Razón: ${manualCase.reason}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;

      this.logger.error(
        `Error al persistir caso manual: ${errorMessage}`,
        errorStack,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Elimina voucher del bucket y actualiza campo url a null en BD
   *
   * @param voucherId - ID del voucher
   * @param fileUrl - URL del archivo a eliminar (path relativo en el bucket)
   * @private
   */
  private async deleteVoucherFileFromBucket(
    voucherId: number,
    fileUrl: string,
  ): Promise<void> {
    // Con blocking: false, no lanza excepción si falla, solo loguea
    const deleted = await this.gcsCleanupService.deleteFile(fileUrl, {
      reason: 'voucher-conciliado',
      fileType: 'permanente',
      blocking: false,
    });

    // Solo actualizar BD si el archivo fue eliminado exitosamente
    if (deleted) {
      // Actualizar voucher.url a null en la base de datos
      await this.dataSource.query(
        'UPDATE vouchers SET url = NULL WHERE id = $1',
        [voucherId],
      );

      this.logger.log(
        `✅ Voucher ${voucherId}: archivo eliminado del bucket y URL actualizada a null`,
      );
    }
  }
}
