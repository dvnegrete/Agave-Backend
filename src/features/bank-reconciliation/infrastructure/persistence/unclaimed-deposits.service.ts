import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TransactionStatusRepository } from '@/shared/database/repositories/transaction-status.repository';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { RecordRepository } from '@/shared/database/repositories/record.repository';
import { HouseRecordRepository } from '@/shared/database/repositories/house-record.repository';
import { TransactionBankRepository } from '@/shared/database/repositories/transaction-bank.repository';
import { TransactionBank } from '@/shared/database/entities/transaction-bank.entity';
import { TransactionStatus } from '@/shared/database/entities/transaction-status.entity';
import { ManualValidationApproval } from '@/shared/database/entities/manual-validation-approval.entity';
import { ValidationStatus } from '@/shared/database/entities/enums';
import {
  MIN_HOUSE_NUMBER,
  MAX_HOUSE_NUMBER,
  SYSTEM_USER_ID,
} from '@/shared/config/business-rules.config';
import { UnclaimedDepositsPageDto, AssignHouseResponseDto } from '../../dto';
import { AllocatePaymentUseCase } from '@/features/payment-management/application';
import { PeriodRepository } from '@/features/payment-management/infrastructure/repositories/period.repository';
import { EnsurePeriodExistsUseCase } from '@/features/payment-management/application';

/**
 * Servicio para manejar depósitos no reclamados (estados: conflict, not-found)
 */
@Injectable()
export class UnclaimedDepositsService {
  private readonly logger = new Logger(UnclaimedDepositsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly transactionStatusRepository: TransactionStatusRepository,
    private readonly houseRepository: HouseRepository,
    private readonly recordRepository: RecordRepository,
    private readonly houseRecordRepository: HouseRecordRepository,
    private readonly transactionBankRepository: TransactionBankRepository,
    private readonly allocatePaymentUseCase: AllocatePaymentUseCase,
    private readonly periodRepository: PeriodRepository,
    private readonly ensurePeriodExistsUseCase: EnsurePeriodExistsUseCase,
  ) {}

  /**
   * Obtiene depósitos sin casa asignada (estados: conflict, not-found)
   *
   * @param startDate Fecha inicial (opcional)
   * @param endDate Fecha final (opcional)
   * @param validationStatus Tipo de sobrante: 'conflict', 'not-found', 'all'
   * @param houseNumber Filtrar por casa sugerida (opcional)
   * @param page Página (comienza en 1)
   * @param limit Registros por página
   * @param sortBy Campo para ordenar: 'date', 'amount'
   * @returns Página de depósitos no reclamados
   */
  async getUnclaimedDeposits(
    startDate?: Date,
    endDate?: Date,
    validationStatus?: 'conflict' | 'not-found' | 'all',
    houseNumber?: number,
    page: number = 1,
    limit: number = 20,
    sortBy: 'date' | 'amount' = 'date',
  ): Promise<UnclaimedDepositsPageDto> {
    // Validar paginación
    if (page < 1) page = 1;
    if (limit < 1 || limit > 100) limit = 20;

    const offset = (page - 1) * limit;

    let query = this.dataSource
      .getRepository(TransactionBank)
      .createQueryBuilder('tb')
      .leftJoin(TransactionStatus, 'ts', 'ts.transactions_bank_id = tb.id')
      .where('tb.is_deposit = :isDeposit', { isDeposit: true })
      .distinctOn(['tb.id'])
      .select([
        'tb.id',
        'tb.amount',
        'tb.date',
        'tb.time',
        'tb.concept',
        'ts.validation_status',
        'ts.reason',
        'ts.identified_house_number',
        'ts.metadata',
        'ts.processed_at',
      ]);

    // Filtrar por estado de validación
    if (validationStatus && validationStatus !== 'all') {
      query = query.andWhere('ts.validation_status = :status', {
        status: validationStatus,
      });
    } else {
      // Por defecto mostrar conflict y not-found
      query = query.andWhere('ts.validation_status IN (:...statuses)', {
        statuses: [ValidationStatus.CONFLICT, ValidationStatus.NOT_FOUND],
      });
    }

    // Filtros opcionales
    if (startDate) {
      query = query.andWhere('tb.date >= :startDate', { startDate });
    }

    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.andWhere('tb.date <= :endDate', { endDate: endOfDay });
    }

    if (houseNumber !== undefined) {
      // Filtrar por casa sugerida (centavos)
      query = query.andWhere(
        'CAST(FLOOR((tb.amount % 1) * 100) AS INT) = :houseNumber',
        { houseNumber },
      );
    }

    // Contar total ANTES de paginación (sin DISTINCT ON para evitar error SQL)
    // NOTA: Crear query separado para conteo porque DISTINCT ON no funciona con getCount()
    const countQuery = this.dataSource
      .getRepository(TransactionBank)
      .createQueryBuilder('tb')
      .leftJoin(TransactionStatus, 'ts', 'ts.transactions_bank_id = tb.id')
      .where('tb.is_deposit = :isDeposit', { isDeposit: true });

    // Aplicar los mismos filtros al query de conteo
    if (validationStatus && validationStatus !== 'all') {
      countQuery.andWhere('ts.validation_status = :status', {
        status: validationStatus,
      });
    } else {
      countQuery.andWhere('ts.validation_status IN (:...statuses)', {
        statuses: [ValidationStatus.CONFLICT, ValidationStatus.NOT_FOUND],
      });
    }

    if (startDate) {
      countQuery.andWhere('tb.date >= :startDate', { startDate });
    }

    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      countQuery.andWhere('tb.date <= :endDate', { endDate: endOfDay });
    }

    if (houseNumber !== undefined) {
      countQuery.andWhere(
        'CAST(FLOOR((tb.amount % 1) * 100) AS INT) = :houseNumber',
        { houseNumber },
      );
    }

    // Contar usando DISTINCT ON directamente en la query
    const countResult = await countQuery
      .select('COUNT(DISTINCT tb.id)', 'cnt')
      .getRawOne();
    const totalCount = countResult?.cnt ? Number(countResult.cnt) : 0;

    // Ordenar (tb.id primero para DISTINCT ON)
    if (sortBy === 'date') {
      query = query.orderBy('tb.id').addOrderBy('tb.date', 'DESC');
    } else if (sortBy === 'amount') {
      query = query.orderBy('tb.id').addOrderBy('tb.amount', 'DESC');
    } else {
      query = query.orderBy('tb.id');
    }

    // Paginación
    const items = await query.skip(offset).take(limit).getRawMany();

    // Mapear a DTOs
    const deposits = items.map((item) => this.mapToUnclaimedDepositDto(item));

    const totalPages = Math.ceil(totalCount / limit);

    return {
      totalCount,
      page,
      limit,
      totalPages,
      items: deposits,
    };
  }

  /**
   * Asigna manualmente una casa a un depósito no reclamado
   *
   * @param transactionId ID de la transacción bancaria
   * @param houseNumber Número de casa a asignar
   * @param userId ID del usuario que realiza la asignación
   * @param adminNotes Notas opcionales del administrador
   * @returns Respuesta con resultado de la asignación
   */
  async assignHouseToDeposit(
    transactionId: string,
    houseNumber: number,
    userId: string,
    adminNotes?: string,
  ): Promise<AssignHouseResponseDto> {
    // Validaciones
    if (houseNumber < MIN_HOUSE_NUMBER || houseNumber > MAX_HOUSE_NUMBER) {
      throw new BadRequestException(
        `Número de casa inválido: ${houseNumber}. Debe estar entre ${MIN_HOUSE_NUMBER} y ${MAX_HOUSE_NUMBER}`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 0. Guarda de idempotencia: verificar que la transacción no haya sido ya asignada
      const existingTransaction =
        await this.transactionBankRepository.findById(transactionId);

      if (!existingTransaction) {
        throw new NotFoundException(
          `Transacción bancaria no encontrada: ${transactionId}`,
        );
      }

      if (existingTransaction.confirmation_status === true) {
        throw new BadRequestException(
          `El depósito ${transactionId} ya fue asignado previamente`,
        );
      }

      // 1. Obtener transacción y su estado usando repositorio
      const transactionStatuses =
        await this.transactionStatusRepository.findByTransactionBankId(
          transactionId,
        );

      const transactionStatus = transactionStatuses?.find(
        (ts) =>
          ts.validation_status === ValidationStatus.CONFLICT ||
          ts.validation_status === ValidationStatus.NOT_FOUND,
      );

      if (!transactionStatus) {
        throw new NotFoundException(
          `Depósito no reclamado no encontrado: ${transactionId}`,
        );
      }

      // 2. Usar transacción bancaria ya obtenida
      const transaction = existingTransaction;

      // 3. Validar o crear casa usando repositorio (within transaction)
      let house = await this.houseRepository.findByNumberHouse(
        houseNumber,
        queryRunner,
      );

      if (!house) {
        // Crear casa con usuario Sistema dentro de la transacción
        house = await this.houseRepository.create(
          {
            number_house: houseNumber,
            user_id: SYSTEM_USER_ID,
          },
          queryRunner,
        );

        this.logger.log(
          `Casa ${houseNumber} creada automáticamente para usuario Sistema`,
        );
      }

      // 4. Actualizar transaction_status usando queryRunner.manager
      const updatedTransactionStatus = queryRunner.manager.create(
        TransactionStatus,
        {
          ...transactionStatus,
          validation_status: ValidationStatus.CONFIRMED,
          identified_house_number: houseNumber,
          reason: `Asignación manual por administrador: ${adminNotes || 'Sin notas'}`,
          processed_at: new Date(),
        },
      );
      await queryRunner.manager.save(updatedTransactionStatus);

      // 5. Actualizar confirmación en transactions_bank usando queryRunner.manager
      const updatedTransaction = queryRunner.manager.create(TransactionBank, {
        ...transaction,
        confirmation_status: true,
      });
      await queryRunner.manager.save(updatedTransaction);

      // 6. Crear Record usando repositorio dentro de transacción
      const record = await this.recordRepository.create(
        {
          transaction_status_id: transactionStatus.id,
        },
        queryRunner,
      );

      const recordId = record.id;

      // 7. Crear HouseRecord usando repositorio dentro de transacción
      await this.houseRecordRepository.create(
        {
          house_id: house.id,
          record_id: recordId,
        },
        queryRunner,
      );

      // 8. Crear auditoría en manual_validation_approvals usando queryRunner.manager
      const approval = queryRunner.manager.create(ManualValidationApproval, {
        transaction_id: Number(transactionId),
        voucher_id: null, // Sin voucher
        approved_by_user_id: userId,
        approval_notes: `Asignación manual de casa ${houseNumber}. ${adminNotes || ''}`,
        approved_at: new Date(),
      });
      await queryRunner.manager.save(approval);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Depósito asignado: Transaction ${transactionId} → Casa ${houseNumber} por usuario ${userId}`,
      );

      // 9. FUERA DE TRANSACCIÓN: Asignar pago a conceptos
      let paymentAllocation: any = undefined;

      try {
        const period = await this.getOrCreateCurrentPeriod();

        const allocationResult = await this.allocatePaymentUseCase.execute({
          record_id: recordId,
          house_id: house.id,
          amount_to_distribute: transaction.amount,
          period_id: period.id,
        });

        paymentAllocation = {
          total_distributed: allocationResult.total_distributed,
          allocations: allocationResult.allocations.map((a: any) => ({
            conceptType: a.concept_type,
            allocatedAmount: a.allocated_amount,
            paymentStatus: a.payment_status,
          })),
        };

        this.logger.log(
          `Pago asignado: $${allocationResult.total_distributed} en ${allocationResult.allocations.length} conceptos`,
        );
      } catch (allocationError) {
        this.logger.error(
          `Error al asignar pago: ${allocationError.message}. El depósito fue conciliado pero la asignación de pago falló.`,
        );
        // No relanzar - la conciliación se completó
      }

      return {
        message: `Depósito asignado exitosamente a casa ${houseNumber}`,
        reconciliation: {
          transactionBankId: transactionId,
          houseNumber,
          status: 'confirmed',
          paymentAllocation,
        },
        assignedAt: new Date(),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error al asignar casa: ${error.message}`);
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Obtiene o crea el período actual
   * @private
   */
  private async getOrCreateCurrentPeriod() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const existingPeriod = await this.periodRepository.findByYearAndMonth(
      year,
      month,
    );

    if (existingPeriod) {
      return existingPeriod;
    }

    return await this.ensurePeriodExistsUseCase.execute(year, month);
  }

  /**
   * Mapea resultado raw de query a DTO
   * @private
   */
  private mapToUnclaimedDepositDto(item: any) {
    // Extraer casa sugerida de centavos
    const suggestedHouseNumber = Math.floor((item.tb_amount % 1) * 100) || null;

    // Extraer casa sugerida de concepto (si existe en metadata)
    const metadata = item.ts_metadata || {};
    const conceptHouseNumber = metadata.conceptHouseNumber || null;

    return {
      transactionBankId: String(item.tb_id),
      amount: item.tb_amount,
      date: item.tb_date,
      time: item.tb_time || null,
      concept: item.tb_concept,
      validationStatus: item.ts_validation_status,
      reason: item.ts_reason,
      suggestedHouseNumber:
        suggestedHouseNumber && suggestedHouseNumber > 0
          ? suggestedHouseNumber
          : null,
      conceptHouseNumber,
      processedAt: item.ts_processed_at,
    };
  }
}
