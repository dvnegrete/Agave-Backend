import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, SelectQueryBuilder } from 'typeorm';
import { Voucher } from '@/shared/database/entities/voucher.entity';
import { TransactionStatus } from '@/shared/database/entities/transaction-status.entity';
import { Record } from '@/shared/database/entities/record.entity';
import { HouseRecord } from '@/shared/database/entities/house-record.entity';
import { House } from '@/shared/database/entities/house.entity';
import { TransactionBankRepository } from '@/shared/database/repositories/transaction-bank.repository';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { ValidationStatus } from '@/shared/database/entities/enums';
import {
  UnfundedVouchersPageDto,
  UnfundedVoucherItemDto,
  MatchVoucherResponseDto,
} from '../../dto';
import { ReconciliationPersistenceService } from './reconciliation-persistence.service';

/**
 * Servicio para manejar vouchers sin fondos (no conciliados)
 * Permite listarlos y conciliarlos manualmente con un depósito
 */
@Injectable()
export class UnfundedVouchersService {
  private readonly logger = new Logger(UnfundedVouchersService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly voucherRepository: VoucherRepository,
    private readonly transactionBankRepository: TransactionBankRepository,
    private readonly persistenceService: ReconciliationPersistenceService,
  ) {}

  /**
   * Obtiene vouchers sin fondos (confirmation_status=false, sin TransactionStatus confirmado)
   *
   * @param startDate Fecha inicial (opcional)
   * @param endDate Fecha final (opcional)
   * @param page Página (comienza en 1)
   * @param limit Registros por página
   * @param sortBy Campo para ordenar: 'date', 'amount'
   * @returns Página de vouchers sin fondos
   */
  async getUnfundedVouchers(
    startDate?: Date,
    endDate?: Date,
    page: number = 1,
    limit: number = 20,
    sortBy: 'date' | 'amount' = 'date',
  ): Promise<UnfundedVouchersPageDto> {
    if (page < 1) page = 1;
    if (limit < 1 || limit > 100) limit = 20;

    const offset = (page - 1) * limit;

    // Base query reutilizable: vouchers sin confirmar y sin TransactionStatus CONFIRMED
    const baseQuery = this.buildUnfundedVouchersBaseQuery(startDate, endDate);

    // Conteo (reutiliza la misma base)
    const countQuery = this.buildUnfundedVouchersBaseQuery(startDate, endDate);
    const countResult = await countQuery
      .select('COUNT(v.id)', 'cnt')
      .getRawOne();
    const totalCount = countResult?.cnt ? Number(countResult.cnt) : 0;

    // Seleccionar campos
    let query = baseQuery.select([
      'v.id AS v_id',
      'v.amount AS v_amount',
      'v.date AS v_date',
      'v.url AS v_url',
    ]);

    // Ordenar
    if (sortBy === 'amount') {
      query = query.orderBy('v.amount', 'DESC');
    } else {
      query = query.orderBy('v.date', 'DESC');
    }

    // Paginación
    const items = await query.offset(offset).limit(limit).getRawMany();

    // Obtener house numbers de los vouchers (via records -> house_records -> house)
    const voucherIds: number[] = items.map((item) => item.v_id);
    const houseNumbers = await this.getHouseNumbersForVouchers(voucherIds);

    // Mapear a DTOs
    const mappedItems: UnfundedVoucherItemDto[] = items.map((item) => ({
      voucherId: item.v_id,
      amount: item.v_amount,
      date: item.v_date,
      houseNumber: houseNumbers.get(item.v_id) || null,
      url: item.v_url || null,
    }));

    const totalPages = Math.ceil(totalCount / limit);

    return {
      totalCount,
      page,
      limit,
      totalPages,
      items: mappedItems,
    };
  }

  /**
   * Concilia manualmente un voucher sin fondos con un depósito no reclamado
   *
   * @param voucherId ID del voucher
   * @param transactionBankId ID de la transacción bancaria (depósito)
   * @param houseNumber Número de casa
   * @param userId ID del usuario que realiza la operación
   * @param adminNotes Notas opcionales
   * @returns Resultado de la conciliación
   */
  async matchVoucherToDeposit(
    voucherId: number,
    transactionBankId: string,
    houseNumber: number,
    userId: string,
    adminNotes?: string,
  ): Promise<MatchVoucherResponseDto> {
    // 1. Validar que el voucher existe y no está conciliado
    const voucher = await this.voucherRepository.findById(voucherId);

    if (!voucher) {
      throw new NotFoundException(`Voucher no encontrado: ${voucherId}`);
    }

    if (voucher.confirmation_status === true) {
      throw new BadRequestException(
        `El voucher ${voucherId} ya fue conciliado previamente`,
      );
    }

    // 2. Validar que la transacción bancaria existe y no está conciliada
    const transactionBank =
      await this.transactionBankRepository.findById(transactionBankId);

    if (!transactionBank) {
      throw new NotFoundException(
        `Transacción bancaria no encontrada: ${transactionBankId}`,
      );
    }

    if (transactionBank.confirmation_status === true) {
      throw new BadRequestException(
        `El depósito ${transactionBankId} ya fue conciliado previamente`,
      );
    }

    // 3. Reutilizar persistReconciliation() del servicio existente
    try {
      await this.persistenceService.persistReconciliation(
        transactionBankId,
        voucher,
        houseNumber,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Error al conciliar voucher ${voucherId} con depósito ${transactionBankId}: ${errorMessage}`,
      );
      throw error;
    }

    this.logger.log(
      `Voucher ${voucherId} conciliado manualmente con depósito ${transactionBankId} → Casa ${houseNumber} por usuario ${userId}. Notas: ${adminNotes || 'Sin notas'}`,
    );

    return {
      message: `Voucher ${voucherId} conciliado exitosamente con depósito ${transactionBankId}`,
      reconciliation: {
        voucherId,
        transactionBankId,
        houseNumber,
        status: 'confirmed',
      },
      matchedAt: new Date(),
    };
  }

  /**
   * Construye la query base para vouchers sin fondos (reutilizable para conteo y datos)
   * @private
   */
  private buildUnfundedVouchersBaseQuery(
    startDate?: Date,
    endDate?: Date,
  ): SelectQueryBuilder<Voucher> {
    let query = this.dataSource
      .getRepository(Voucher)
      .createQueryBuilder('v')
      .leftJoin(
        TransactionStatus,
        'ts',
        'ts.vouchers_id = v.id AND ts.validation_status = :confirmedStatus',
        { confirmedStatus: ValidationStatus.CONFIRMED },
      )
      .where('v.confirmation_status = :status', { status: false })
      .andWhere('ts.id IS NULL');

    if (startDate) {
      query = query.andWhere('v.date >= :startDate', { startDate });
    }

    if (endDate) {
      const endOfDay = new Date(endDate);
      endOfDay.setHours(23, 59, 59, 999);
      query = query.andWhere('v.date <= :endDate', { endDate: endOfDay });
    }

    return query;
  }

  /**
   * Obtiene los números de casa asociados a una lista de voucher IDs
   * Usa relaciones TypeORM: Voucher -> Record -> HouseRecord -> House
   * @private
   */
  private async getHouseNumbersForVouchers(
    voucherIds: number[],
  ): Promise<Map<number, number>> {
    const result = new Map<number, number>();

    if (voucherIds.length === 0) return result;

    const rows = await this.dataSource
      .getRepository(Voucher)
      .createQueryBuilder('v')
      .innerJoin(Record, 'r', 'r.vouchers_id = v.id')
      .innerJoin(HouseRecord, 'hr', 'hr.record_id = r.id')
      .innerJoin(House, 'h', 'h.id = hr.house_id')
      .where('v.id IN (:...voucherIds)', { voucherIds })
      .select(['v.id AS voucher_id', 'h.number_house AS number_house'])
      .distinctOn(['v.id'])
      .orderBy('v.id')
      .addOrderBy('r.id', 'DESC')
      .getRawMany();

    for (const row of rows) {
      result.set(row.voucher_id, row.number_house);
    }

    return result;
  }
}
