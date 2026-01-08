import { Injectable, Logger, OnModuleInit, Inject } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { TransactionStatusRepository } from '@/shared/database/repositories/transaction-status.repository';
import { RecordRepository } from '@/shared/database/repositories/record.repository';
import { HouseRecordRepository } from '@/shared/database/repositories/house-record.repository';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { Voucher } from '@/shared/database/entities/voucher.entity';
import { ValidationStatus } from '@/shared/database/entities/enums';
import { GcsCleanupService } from '@/shared/libs/google-cloud/gcs-cleanup.service';
import {
  MIN_HOUSE_NUMBER,
  MAX_HOUSE_NUMBER,
  SYSTEM_USER_ID,
} from '@/shared/config/business-rules.config';
import { EnsureHouseExistsService } from '@/shared/database/services';
import { UnclaimedDeposit, ManualValidationCase } from '../../domain';
import { AllocatePaymentUseCase } from '@/features/payment-management/application';
import { PeriodRepository } from '@/features/payment-management/infrastructure/repositories/period.repository';
import { EnsurePeriodExistsUseCase } from '@/features/payment-management/application';
import { TransactionBankRepository as TransactionBankRepo } from '@/shared/database/repositories/transaction-bank.repository';

/**
 * Servicio de infraestructura para persistencia de conciliaciones
 * Maneja todas las operaciones de base de datos relacionadas con la conciliación
 */
@Injectable()
export class ReconciliationPersistenceService implements OnModuleInit {
  private readonly logger = new Logger(ReconciliationPersistenceService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly transactionStatusRepository: TransactionStatusRepository,
    private readonly recordRepository: RecordRepository,
    private readonly houseRecordRepository: HouseRecordRepository,
    private readonly houseRepository: HouseRepository,
    private readonly voucherRepository: VoucherRepository,
    private readonly gcsCleanupService: GcsCleanupService,
    private readonly allocatePaymentUseCase: AllocatePaymentUseCase,
    private readonly periodRepository: PeriodRepository,
    private readonly ensurePeriodExistsUseCase: EnsurePeriodExistsUseCase,
    private readonly transactionBankRepository: TransactionBankRepo,
    private readonly ensureHouseExistsService: EnsureHouseExistsService,
  ) {}

  /**
   * Verifica que el usuario Sistema existe al iniciar el módulo
   * Lanza un error descriptivo si no existe
   */
  async onModuleInit() {
    try {
      const result = await this.dataSource.query(
        'SELECT id, email FROM users WHERE id = $1',
        [SYSTEM_USER_ID],
      );

      if (!result || result.length === 0) {
        const errorMessage = `
          USUARIO SISTEMA NO ENCONTRADO. Asignar casas creadas automáticamente sistema@conciliacion.local
        `;
        this.logger.error(errorMessage);
        throw new Error(
          'Usuario Sistema no encontrado. Ver logs para instrucciones de setup.',
        );
      }

      this.logger.log(
        `✅ Usuario Sistema verificado: ${result[0].email} (${result[0].id})`,
      );
    } catch (error) {
      if (error.message.includes('Usuario Sistema no encontrado')) {
        throw error;
      }
      this.logger.warn(
        `No se pudo verificar usuario Sistema: ${error.message}`,
      );
    }
  }

  /**
   * Persiste una conciliación exitosa en la base de datos
   * Crea todos los registros necesarios en una transacción atómica
   *
   * @param transactionBankId - ID de la transacción bancaria
   * @param voucher - Objeto completo del voucher (puede ser null si conciliación automática sin voucher)
   * @param houseNumber - Número de casa
   * @throws Error si houseNumber no está en rango válido
   */
  async persistReconciliation(
    transactionBankId: string,
    voucher: Voucher | null,
    houseNumber: number,
  ): Promise<void> {
    if (!this.isValidHouseNumber(houseNumber)) {
      throw new Error(
        `❌ Número de casa inválido: ${houseNumber}. Debe estar en rango ${MIN_HOUSE_NUMBER}-${MAX_HOUSE_NUMBER}. ` +
          `Transacción ${transactionBankId} rechazada para persistencia.`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Crear TransactionStatus (con o sin voucher)
      const transactionStatus = await this.createTransactionStatus(
        transactionBankId,
        voucher?.id ?? null,
        houseNumber,
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
      const house = await this.createHouseRecordAssociation(
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

      // 6. FUERA DE LA TRANSACCIÓN: Asignar el pago a conceptos
      // Esto se hace fuera de la transacción original porque AllocatePaymentUseCase
      // puede hacer múltiples operaciones de base de datos
      try {
        const transactionBank = await this.transactionBankRepository.findById(
          transactionBankId,
        );

        if (!transactionBank) {
          this.logger.warn(
            `No se pudo obtener información de TransactionBank ${transactionBankId} para asignar pago. ` +
              `La asignación se hará al período actual pero sin información del monto original.`,
          );
        }

        // Obtener o crear el período actual
        const period = await this.getOrCreateCurrentPeriod();

        // Asignar el pago a conceptos (mantenimiento, agua, cuota extraordinaria)
        const allocationResult = await this.allocatePaymentUseCase.execute({
          record_id: recordId,
          house_id: house.id,
          amount_to_distribute: transactionBank?.amount ?? 0,
          period_id: period.id,
        });

        this.logger.log(
          `✅ Pago asignado automáticamente: ${allocationResult.total_distributed} distribuido ` +
            `en ${allocationResult.allocations.length} conceptos para casa ${houseNumber}`,
        );
      } catch (allocationError) {
        const errorMessage =
          allocationError instanceof Error
            ? allocationError.message
            : 'Unknown error during payment allocation';
        this.logger.error(
          `⚠️ Error al asignar pago para casa ${houseNumber}: ${errorMessage}. ` +
            `El registro fue creado pero la asignación falló. Se requiere revisión manual.`,
          allocationError instanceof Error ? allocationError.stack : undefined,
        );
        // No relanzar el error - la conciliación se completó, solo falta la asignación
      }

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
   *
   * @param transactionBankId - ID de la transacción bancaria
   * @param voucherId - ID del voucher (puede ser null si conciliación automática)
   * @param houseNumber - Número de casa identificado
   * @param queryRunner - QueryRunner para transacción
   * @param metadata - Información adicional de la conciliación (matchCriteria, confidenceLevel)
   */
  private async createTransactionStatus(
    transactionBankId: string,
    voucherId: number | null,
    houseNumber: number,
    queryRunner: QueryRunner,
    metadata?: {
      matchCriteria?: string[];
      confidenceLevel?: string;
    },
  ) {
    return await this.transactionStatusRepository.create(
      {
        validation_status: ValidationStatus.CONFIRMED,
        transactions_bank_id: Number(transactionBankId),
        vouchers_id: voucherId,
        reason: voucherId
          ? 'Conciliado con voucher'
          : 'Conciliado automáticamente por centavos/concepto',
        identified_house_number: houseNumber,
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
   * Retorna la casa para uso posterior en asignación de pagos
   * Usa EnsureHouseExistsService para garantizar que la casa existe
   */
  private async createHouseRecordAssociation(
    houseNumber: number,
    recordId: number,
    queryRunner: QueryRunner,
  ): Promise<any> {
    // Delegar búsqueda/creación al servicio compartido
    // (incluye validación de rango internamente)
    const { house } = await this.ensureHouseExistsService.execute(houseNumber, {
      createIfMissing: true,
      userId: SYSTEM_USER_ID,
      queryRunner,
    });

    this.logger.log(
      `Asociando casa ${houseNumber} (ID: ${house.id}) con record ${recordId}`,
    );

    // Crear asociación en house_records
    await this.houseRecordRepository.create(
      {
        house_id: house.id,
        record_id: recordId,
      },
      queryRunner,
    );

    // Retornar la casa para uso posterior (asignación de pagos)
    return house;
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
   * Persiste un depósito no reclamado en la base de datos
   * Crea un TransactionStatus con estado NOT_FOUND o CONFLICT
   *
   * @param transactionBankId - ID de la transacción bancaria
   * @param surplus - Objeto UnclaimedDeposit con información del depósito no reclamado
   */
  async persistSurplus(
    transactionBankId: string,
    surplus: UnclaimedDeposit,
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
          transactions_bank_id: Number(transactionBankId),
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
          transactions_bank_id: Number(transactionBankId),
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

  /**
   * Obtiene el período actual o lo crea si no existe
   * Usa la fecha actual (hoy) para determinar el período
   *
   * @returns Período actual o recién creado
   * @private
   */
  private async getOrCreateCurrentPeriod(): Promise<any> {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1; // Meses van de 1-12

    try {
      // Intentar obtener el período actual
      const existingPeriod = await this.periodRepository.findByYearAndMonth(
        currentYear,
        currentMonth,
      );

      if (existingPeriod) {
        this.logger.log(
          `Período actual encontrado: ${currentYear}-${currentMonth.toString().padStart(2, '0')} (ID: ${existingPeriod.id})`,
        );
        return existingPeriod;
      }

      // Si no existe, crear automáticamente usando EnsurePeriodExistsUseCase
      this.logger.log(
        `Período ${currentYear}-${currentMonth.toString().padStart(2, '0')} no existe, creando automáticamente`,
      );

      const newPeriod = await this.ensurePeriodExistsUseCase.execute(
        currentYear,
        currentMonth,
      );

      this.logger.log(
        `Período creado exitosamente: ${currentYear}-${currentMonth.toString().padStart(2, '0')} (ID: ${newPeriod.id})`,
      );

      return newPeriod;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error al obtener o crear período actual: ${errorMessage}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new Error(
        `No se pudo obtener o crear el período actual para ${currentYear}-${currentMonth}: ${errorMessage}`,
      );
    }
  }

  /**
   * Valida que un número de casa esté dentro del rango válido
   * @param houseNumber - Número de casa a validar
   * @returns boolean
   * @private
   */
  private isValidHouseNumber(houseNumber: number | undefined | null): boolean {
    return (
      houseNumber !== undefined &&
      houseNumber !== null &&
      houseNumber >= MIN_HOUSE_NUMBER &&
      houseNumber <= MAX_HOUSE_NUMBER
    );
  }
}
