import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TransactionBank } from '@/shared/database/entities/transaction-bank.entity';
import { ManualValidationApproval } from '@/shared/database/entities/manual-validation-approval.entity';
import { TransactionStatusRepository } from '@/shared/database/repositories/transaction-status.repository';
import { ValidationStatus } from '@/shared/database/entities/enums';
import {
  ManualValidationCaseResponseDto,
  ManualValidationCasesPageDto,
  ManualValidationStatsDto,
  ApproveManualCaseResponseDto,
  RejectManualCaseResponseDto,
} from '../../dto';
import { ReconciliationPersistenceService } from './reconciliation-persistence.service';

/**
 * Servicio para manejar aprobaciones y rechazos de casos de validación manual
 */
@Injectable()
export class ManualValidationService {
  private readonly logger = new Logger(ManualValidationService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly transactionStatusRepository: TransactionStatusRepository,
    private readonly persistenceService: ReconciliationPersistenceService,
  ) {}

  /**
   * Obtiene casos pendientes de validación manual con filtros y paginación
   *
   * @param startDate Fecha inicial (opcional)
   * @param endDate Fecha final (opcional)
   * @param houseNumber Número de casa (opcional)
   * @param page Página (comienza en 1)
   * @param limit Registros por página
   * @param sortBy Campo para ordenar
   * @returns Página de casos de validación manual
   */
  async getPendingManualCases(
    startDate?: Date,
    endDate?: Date,
    houseNumber?: number,
    page: number = 1,
    limit: number = 20,
    sortBy: 'date' | 'similarity' | 'candidates' = 'date',
  ): Promise<ManualValidationCasesPageDto> {
    // Validar paginación
    if (page < 1) page = 1;
    if (limit < 1 || limit > 100) limit = 20;

    const offset = (page - 1) * limit;

    let query = this.dataSource
      .getRepository(TransactionBank)
      .createQueryBuilder('tb')
      .leftJoin('transactions_status', 'ts', 'ts.transactions_bank_id = tb.id')
      .where('ts.validation_status = :status', {
        status: ValidationStatus.REQUIRES_MANUAL,
      })
      .select([
        'tb.id',
        'tb.amount',
        'tb.date',
        'tb.time',
        'tb.concept',
        'ts.metadata',
        'ts.created_at',
      ]);

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
      // Los centavos del monto indican la casa
      query = query.andWhere(
        'CAST(FLOOR((tb.amount % 1) * 100) AS INT) = :houseNumber',
        { houseNumber },
      );
    }

    // Contar total
    const totalCount = await query.getCount();

    // Ordenar
    if (sortBy === 'date') {
      query = query.orderBy('ts.created_at', 'DESC');
    } else if (sortBy === 'similarity') {
      query = query.orderBy(
        "CAST(ts.metadata->>'similarity' AS FLOAT)",
        'ASC',
      );
    } else if (sortBy === 'candidates') {
      query = query.orderBy(
        "jsonb_array_length(ts.metadata->'possibleMatches')",
        'DESC',
      );
    }

    // Paginación
    const items = await query.skip(offset).take(limit).getRawMany();

    // Mapear a DTO
    const casesResponse: ManualValidationCaseResponseDto[] = items.map(
      (item) => this.mapToManualValidationCaseResponseDto(item),
    );

    const totalPages = Math.ceil(totalCount / limit);

    return {
      totalCount,
      page,
      limit,
      totalPages,
      items: casesResponse,
    };
  }

  /**
   * Aprueba un caso de validación manual eligiendo un voucher específico
   *
   * @param transactionId ID de la transacción
   * @param voucherId ID del voucher elegido
   * @param userId ID del usuario que aprueba
   * @param approvalNotes Notas opcionales
   * @returns Respuesta de aprobación
   */
  async approveManualCase(
    transactionId: string,
    voucherId: number,
    userId: string,
    approvalNotes?: string,
  ): Promise<ApproveManualCaseResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Obtener caso pendiente (raw query)
      const result = await queryRunner.query(
        `SELECT * FROM transactions_status
         WHERE transactions_bank_id = $1
         AND validation_status = $2`,
        [transactionId, ValidationStatus.REQUIRES_MANUAL],
      );

      if (!result || result.length === 0) {
        throw new NotFoundException(
          `Caso de validación manual no encontrado para transacción ${transactionId}`,
        );
      }

      const transactionStatus = result[0];

      // Validar que el voucherId está en los posibles matches
      const metadata = (transactionStatus.metadata as any) || {};
      const possibleMatches = metadata.possibleMatches || [];
      const isValidVoucher = possibleMatches.some(
        (m: any) => m.voucherId === voucherId,
      );

      if (!isValidVoucher) {
        throw new BadRequestException(
          `Voucher ${voucherId} no es un candidato válido para esta transacción`,
        );
      }

      // Obtener la transacción para realizar la conciliación
      const transaction = await queryRunner.manager.findOne(TransactionBank, {
        where: { id: transactionId },
      });

      if (!transaction) {
        throw new NotFoundException(
          `Transacción ${transactionId} no encontrada`,
        );
      }

      // Obtener el voucher
      const voucher = await queryRunner.manager.findOne('vouchers', {
        where: { id: voucherId },
      });

      if (!voucher) {
        throw new NotFoundException(`Voucher ${voucherId} no encontrado`);
      }

      // Actualizar estado de la transacción (SIN datos de aprobación - ahora en manual_validation_approvals)
      await queryRunner.manager.update(
        'transaction_status',
        { transactions_bank_id: transactionId },
        {
          validation_status: ValidationStatus.CONFIRMED,
          vouchers_id: voucherId,
          processed_at: new Date(),
          metadata: {
            ...metadata,
            approvedVoucherId: voucherId,
            approvalTimestamp: new Date().toISOString(),
          },
        },
      );

      // Crear registro de auditoría en manual_validation_approvals
      // (ÚNICA fuente de verdad para datos de aprobación)
      await queryRunner.manager.save(ManualValidationApproval, {
        transaction_id: Number(transactionId),
        voucher_id: voucherId,
        approved_by_user_id: userId,
        approval_notes: approvalNotes,
        approved_at: new Date(),
      });

      // Actualizar confirmation_status de voucher
      await queryRunner.manager.update(
        'vouchers',
        { id: voucherId },
        { confirmation_status: true },
      );

      // Actualizar confirmation_status de transacción
      await queryRunner.manager.update(
        'transactions_bank',
        { id: transactionId },
        { confirmation_status: true },
      );

      await queryRunner.commitTransaction();

      this.logger.log(
        `✅ Caso manual aprobado: Transaction ${transactionId} → Voucher ${voucherId} por usuario ${userId}`,
      );

      return {
        message: 'Caso aprobado exitosamente',
        reconciliation: {
          transactionBankId: transactionId,
          voucherId,
          status: ValidationStatus.CONFIRMED,
        },
        approvedAt: new Date(),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error al aprobar caso manual: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Rechaza un caso de validación manual
   *
   * @param transactionId ID de la transacción
   * @param userId ID del usuario que rechaza
   * @param rejectionReason Razón del rechazo
   * @param notes Notas opcionales
   * @returns Respuesta de rechazo
   */
  async rejectManualCase(
    transactionId: string,
    userId: string,
    rejectionReason: string,
    notes?: string,
  ): Promise<RejectManualCaseResponseDto> {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Obtener caso pendiente (raw query)
      const result = await queryRunner.query(
        `SELECT * FROM transactions_status
         WHERE transactions_bank_id = $1
         AND validation_status = $2`,
        [transactionId, ValidationStatus.REQUIRES_MANUAL],
      );

      if (!result || result.length === 0) {
        throw new NotFoundException(
          `Caso de validación manual no encontrado para transacción ${transactionId}`,
        );
      }

      const transactionStatus = result[0];
      const metadata = (transactionStatus.metadata as any) || {};

      // Marcar como not-found (sin info suficiente)
      // SIN datos de rechazo en transaction_status - ahora en manual_validation_approvals
      await queryRunner.manager.update(
        'transaction_status',
        { transactions_bank_id: transactionId },
        {
          validation_status: ValidationStatus.NOT_FOUND,
          processed_at: new Date(),
          reason: rejectionReason,
          metadata: {
            ...metadata,
            rejectionReason,
            rejectionTimestamp: new Date().toISOString(),
          },
        },
      );

      // Crear registro de auditoría en manual_validation_approvals
      // (ÚNICA fuente de verdad para datos de rechazo)
      await queryRunner.manager.save(ManualValidationApproval, {
        transaction_id: Number(transactionId),
        voucher_id: null, // NULL porque fue rechazado
        approved_by_user_id: userId,
        approval_notes: notes,
        rejection_reason: rejectionReason,
        approved_at: new Date(),
      });

      await queryRunner.commitTransaction();

      this.logger.log(
        `❌ Caso manual rechazado: Transaction ${transactionId} por usuario ${userId}. Razón: ${rejectionReason}`,
      );

      return {
        message: 'Caso rechazado exitosamente',
        transactionBankId: transactionId,
        newStatus: ValidationStatus.NOT_FOUND,
        rejectedAt: new Date(),
      };
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error al rechazar caso manual: ${error instanceof Error ? error.message : 'Unknown'}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Obtiene estadísticas de validación manual
   *
   * @returns Estadísticas
   */
  async getManualValidationStats(): Promise<ManualValidationStatsDto> {
    // Total pendientes
    const totalPending = await this.dataSource
      .getRepository(TransactionBank)
      .createQueryBuilder('tb')
      .leftJoin('transactions_status', 'ts', 'ts.transactions_bank_id = tb.id')
      .where('ts.validation_status = :status', {
        status: ValidationStatus.REQUIRES_MANUAL,
      })
      .getCount();

    // Total aprobados (CONFIRMED con approvedVoucherId en metadata)
    const totalApproved = await this.dataSource
      .getRepository(TransactionBank)
      .createQueryBuilder('tb')
      .leftJoin('transactions_status', 'ts', 'ts.transactions_bank_id = tb.id')
      .where('ts.validation_status = :status', {
        status: ValidationStatus.CONFIRMED,
      })
      .andWhere("ts.metadata->>'approvedVoucherId' IS NOT NULL")
      .getCount();

    // Total rechazados (NOT_FOUND con rejectionReason en metadata)
    const totalRejected = await this.dataSource
      .getRepository(TransactionBank)
      .createQueryBuilder('tb')
      .leftJoin('transactions_status', 'ts', 'ts.transactions_bank_id = tb.id')
      .where('ts.validation_status = :status', {
        status: ValidationStatus.NOT_FOUND,
      })
      .andWhere("ts.metadata->>'rejectionReason' IS NOT NULL")
      .getCount();

    // Pendientes en últimas 24 horas
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const pendingLast24Hours = await this.dataSource
      .getRepository(TransactionBank)
      .createQueryBuilder('tb')
      .leftJoin('transactions_status', 'ts', 'ts.transactions_bank_id = tb.id')
      .where('ts.validation_status = :status', {
        status: ValidationStatus.REQUIRES_MANUAL,
      })
      .andWhere('ts.created_at >= :last24Hours', { last24Hours })
      .getCount();

    // Tasa de aprobación
    const approvalRate =
      totalApproved + totalRejected > 0
        ? totalApproved / (totalApproved + totalRejected)
        : 0;

    // Tiempo promedio de aprobación (solo los que fueron resueltos)
    const avgResult = await this.dataSource.query(`
      SELECT AVG(EXTRACT(EPOCH FROM (processed_at - created_at)) / 60) as avg_minutes
      FROM transactions_status
      WHERE (validation_status = $1 OR validation_status = $2)
      AND processed_at IS NOT NULL
    `, [ValidationStatus.CONFIRMED, ValidationStatus.NOT_FOUND]);

    const avgApprovalTimeMinutes = avgResult[0]?.avg_minutes || 0;

    // Distribución por rango de casa
    const distributionQuery = `
      SELECT
        CASE
          WHEN CAST(FLOOR((tb.amount % 1) * 100) AS INT) BETWEEN 1 AND 10 THEN '1-10'
          WHEN CAST(FLOOR((tb.amount % 1) * 100) AS INT) BETWEEN 11 AND 20 THEN '11-20'
          WHEN CAST(FLOOR((tb.amount % 1) * 100) AS INT) BETWEEN 21 AND 30 THEN '21-30'
          WHEN CAST(FLOOR((tb.amount % 1) * 100) AS INT) BETWEEN 31 AND 40 THEN '31-40'
          WHEN CAST(FLOOR((tb.amount % 1) * 100) AS INT) BETWEEN 41 AND 66 THEN '41-66'
          ELSE 'unknown'
        END as house_range,
        COUNT(*) as count
      FROM transactions_status ts
      LEFT JOIN transactions_bank tb ON ts.transactions_bank_id = tb.id
      WHERE ts.validation_status = $1
      GROUP BY house_range
      ORDER BY house_range
    `;

    const distributionResults = await this.dataSource.query(distributionQuery, [
      ValidationStatus.REQUIRES_MANUAL,
    ]);

    const distributionByHouseRange: Record<string, number> = {};
    distributionResults.forEach((row: any) => {
      distributionByHouseRange[row.house_range] = parseInt(row.count);
    });

    return {
      totalPending,
      totalApproved,
      totalRejected,
      pendingLast24Hours,
      approvalRate: Number(approvalRate.toFixed(2)),
      avgApprovalTimeMinutes: Math.round(avgApprovalTimeMinutes),
      distributionByHouseRange,
    };
  }

  /**
   * Mapea un resultado de BD a DTO de respuesta
   */
  private mapToManualValidationCaseResponseDto(
    item: any,
  ): ManualValidationCaseResponseDto {
    const metadata = item.ts_metadata || {};
    const possibleMatches = metadata.possibleMatches || [];

    return {
      transactionBankId: item.tb_id,
      transactionAmount: item.tb_amount,
      transactionDate: item.tb_date,
      transactionConcept: item.tb_concept,
      possibleMatches: possibleMatches.map((m: any) => ({
        voucherId: m.voucherId,
        voucherAmount: item.tb_amount, // Mismo monto
        voucherDate: new Date(m.voucherDate || item.tb_date),
        houseNumber:
          Math.round((item.tb_amount % 1) * 100) || m.houseNumber,
        similarity: m.similarity || 0,
        dateDifferenceHours: m.dateDifferenceHours || 0,
      })),
      reason: metadata.reason || 'Múltiples candidatos válidos',
      createdAt: item.ts_created_at,
      status: 'pending',
    };
  }
}
