import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { DataSource } from 'typeorm';
import { TransactionBank } from '@/shared/database/entities/transaction-bank.entity';
import { TransactionStatus } from '@/shared/database/entities/transaction-status.entity';
import { Voucher } from '@/shared/database/entities/voucher.entity';
import { Record } from '@/shared/database/entities/record.entity';
import { HouseRecord } from '@/shared/database/entities/house-record.entity';
import { House } from '@/shared/database/entities/house.entity';
import { ManualValidationApproval } from '@/shared/database/entities/manual-validation-approval.entity';
import { ValidationStatus } from '@/shared/database/entities/enums';
import { TransactionStatusRepository } from '@/shared/database/repositories/transaction-status.repository';
import { TransactionBankRepository } from '@/shared/database/repositories/transaction-bank.repository';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { RecordRepository } from '@/shared/database/repositories/record.repository';
import { HouseRecordRepository } from '@/shared/database/repositories/house-record.repository';
import {
  MIN_HOUSE_NUMBER,
  MAX_HOUSE_NUMBER,
  SYSTEM_USER_ID,
} from '@/shared/config/business-rules.config';
import {
  MatchSuggestionItemDto,
  MatchSuggestionsResponseDto,
  ApplyMatchSuggestionResponseDto,
} from '../../dto';
import { AllocatePaymentUseCase } from '@/features/payment-management/application';
import { PeriodRepository } from '@/features/payment-management/infrastructure/repositories/period.repository';
import { EnsurePeriodExistsUseCase } from '@/features/payment-management/application';

interface DepositRow {
  tb_id: string;
  tb_amount: number;
  tb_date: Date;
  tb_time: string | null;
  ts_id: number;
  ts_validation_status: string;
}

interface VoucherRow {
  v_id: number;
  v_amount: number;
  v_date: Date;
  house_number: number | null;
}

/**
 * Servicio para analizar y aplicar cross-matching entre
 * depósitos no reclamados (unclaimed deposits) y vouchers sin fondos (unfunded vouchers).
 */
@Injectable()
export class MatchSuggestionsService {
  private readonly logger = new Logger(MatchSuggestionsService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly transactionStatusRepository: TransactionStatusRepository,
    private readonly transactionBankRepository: TransactionBankRepository,
    private readonly voucherRepository: VoucherRepository,
    private readonly houseRepository: HouseRepository,
    private readonly recordRepository: RecordRepository,
    private readonly houseRecordRepository: HouseRecordRepository,
    private readonly allocatePaymentUseCase: AllocatePaymentUseCase,
    private readonly periodRepository: PeriodRepository,
    private readonly ensurePeriodExistsUseCase: EnsurePeriodExistsUseCase,
  ) {}

  /**
   * Busca sugerencias de cross-matching entre unclaimed deposits y unfunded vouchers.
   *
   * Algoritmo:
   * 1. Obtener unclaimed deposits (TransactionStatus con validation_status IN ('not-found', 'conflict'))
   * 2. Obtener unfunded vouchers (confirmation_status=false, sin TransactionStatus CONFIRMED)
   * 3. Agrupar ambos por (fecha_día, monto)
   * 4. Para cada grupo con deposits Y vouchers: emparejar por tiempo más cercano
   * 5. Determinar confianza basándose en cantidades y disponibilidad de houseNumber
   */
  async findMatchSuggestions(): Promise<MatchSuggestionsResponseDto> {
    // 1. Query unclaimed deposits
    const deposits = await this.getUnclaimedDepositsRaw();

    // 2. Query unfunded vouchers
    const vouchers = await this.getUnfundedVouchersRaw();

    if (deposits.length === 0 || vouchers.length === 0) {
      return {
        totalSuggestions: 0,
        highConfidence: 0,
        mediumConfidence: 0,
        suggestions: [],
      };
    }

    // 3. Obtener house numbers para vouchers
    const voucherIds = vouchers.map((v) => v.v_id);
    const houseNumbers = await this.getHouseNumbersForVouchers(voucherIds);

    // Enriquecer vouchers con house numbers
    const enrichedVouchers = vouchers.map((v) => ({
      ...v,
      house_number: houseNumbers.get(v.v_id) || null,
    }));

    // 4. Agrupar por (fecha_día, monto)
    const depositGroups = this.groupByDateAndAmount(
      deposits.map((d) => ({
        id: d.tb_id,
        amount: d.tb_amount,
        date: d.tb_date,
        time: d.tb_time,
      })),
    );

    const voucherGroups = this.groupByDateAndAmount(
      enrichedVouchers.map((v) => ({
        id: String(v.v_id),
        amount: v.v_amount,
        date: v.v_date,
        time: null, // vouchers no tienen campo time separado
        houseNumber: v.house_number,
      })),
    );

    // 5. Cross-match por grupos
    const suggestions: MatchSuggestionItemDto[] = [];

    for (const [key, depositGroup] of depositGroups.entries()) {
      const voucherGroup = voucherGroups.get(key);
      if (!voucherGroup) continue;

      // Ordenar por time/date
      depositGroup.sort((a, b) => (a.time || '').localeCompare(b.time || ''));
      voucherGroup.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return dateA - dateB;
      });

      const pairCount = Math.min(depositGroup.length, voucherGroup.length);
      const sameCount = depositGroup.length === voucherGroup.length;

      for (let i = 0; i < pairCount; i++) {
        const deposit = depositGroup[i];
        const voucher = voucherGroup[i];
        const hasHouse =
          voucher.houseNumber !== null &&
          voucher.houseNumber !== undefined &&
          voucher.houseNumber >= MIN_HOUSE_NUMBER &&
          voucher.houseNumber <= MAX_HOUSE_NUMBER;

        const confidence: 'high' | 'medium' =
          sameCount && hasHouse ? 'high' : 'medium';

        const reasons: string[] = [];
        reasons.push(`Mismo monto ($${deposit.amount}) y misma fecha`);
        if (sameCount) {
          reasons.push(
            `${depositGroup.length} depósito(s) = ${voucherGroup.length} voucher(s)`,
          );
        } else {
          reasons.push(
            `${depositGroup.length} depósito(s) vs ${voucherGroup.length} voucher(s) (parcial)`,
          );
        }
        if (hasHouse) {
          reasons.push(`Casa ${voucher.houseNumber} identificada`);
        } else {
          reasons.push('Sin casa identificada');
        }

        suggestions.push({
          transactionBankId: deposit.id,
          voucherId: Number(voucher.id),
          amount: deposit.amount,
          depositDate: this.formatDate(deposit.date),
          depositTime: deposit.time || null,
          voucherDate: this.formatDate(voucher.date),
          houseNumber: voucher.houseNumber || null,
          confidence,
          reason: reasons.join('. '),
        });
      }
    }

    const highConfidence = suggestions.filter(
      (s) => s.confidence === 'high',
    ).length;
    const mediumConfidence = suggestions.filter(
      (s) => s.confidence === 'medium',
    ).length;

    this.logger.log(
      `Cross-matching: ${suggestions.length} sugerencias (${highConfidence} alta, ${mediumConfidence} media)`,
    );

    return {
      totalSuggestions: suggestions.length,
      highConfidence,
      mediumConfidence,
      suggestions,
    };
  }

  /**
   * Aplica una sugerencia de cross-matching: vincula un depósito no reclamado con un voucher.
   *
   * Flujo:
   * 1. Validar deposit tiene TransactionStatus con validation_status IN ('not-found', 'conflict')
   * 2. Validar voucher existe y confirmation_status=false
   * 3. Validar houseNumber en rango válido
   * 4. En transacción atómica: actualizar TransactionStatus, crear Record, HouseRecord, actualizar voucher
   * 5. Fuera de transacción: asignar pago
   */
  async applyMatchSuggestion(
    transactionBankId: string,
    voucherId: number,
    houseNumber: number,
    userId: string,
    adminNotes?: string,
  ): Promise<ApplyMatchSuggestionResponseDto> {
    // Validaciones
    if (houseNumber < MIN_HOUSE_NUMBER || houseNumber > MAX_HOUSE_NUMBER) {
      throw new BadRequestException(
        `Número de casa inválido: ${houseNumber}. Debe estar entre ${MIN_HOUSE_NUMBER} y ${MAX_HOUSE_NUMBER}`,
      );
    }

    // Validar que el depósito existe
    const transactionBank =
      await this.transactionBankRepository.findById(transactionBankId);
    if (!transactionBank) {
      throw new NotFoundException(
        `Transacción bancaria no encontrada: ${transactionBankId}`,
      );
    }
    // NOTA: No validamos confirmation_status porque persistSurplus() lo pone en true
    // para evitar reprocesamiento. El guard real es el validation_status del TransactionStatus.

    // Validar TransactionStatus existente con status unclaimed
    const transactionStatuses =
      await this.transactionStatusRepository.findByTransactionBankId(
        transactionBankId,
      );
    const transactionStatus = transactionStatuses?.find(
      (ts) =>
        ts.validation_status === ValidationStatus.CONFLICT ||
        ts.validation_status === ValidationStatus.NOT_FOUND,
    );
    if (!transactionStatus) {
      throw new NotFoundException(
        `No se encontró TransactionStatus no reclamado para depósito: ${transactionBankId}`,
      );
    }

    // Validar voucher
    const voucher = await this.voucherRepository.findById(voucherId);
    if (!voucher) {
      throw new NotFoundException(`Voucher no encontrado: ${voucherId}`);
    }
    if (voucher.confirmation_status === true) {
      throw new BadRequestException(
        `El voucher ${voucherId} ya fue conciliado previamente`,
      );
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    let recordId: number;

    try {
      // 1. Validar o crear casa
      let house = await this.houseRepository.findByNumberHouse(
        houseNumber,
        queryRunner,
      );
      if (!house) {
        house = await this.houseRepository.create(
          { number_house: houseNumber, user_id: SYSTEM_USER_ID },
          queryRunner,
        );
        this.logger.log(
          `Casa ${houseNumber} creada automáticamente para cross-match`,
        );
      }

      // 2. Actualizar TODOS los TransactionStatus de este depósito que estén como unclaimed
      //    Usa QueryBuilder para garantizar SQL correcto con IN(...)
      //    Maneja duplicados (la migración de limpieza puede no haberse ejecutado)
      const crossMatchReason = `Cross-match: ${adminNotes || 'Conciliado por sugerencia de cross-matching'}`;
      const updateResult = await queryRunner.manager
        .createQueryBuilder()
        .update(TransactionStatus)
        .set({
          validation_status: ValidationStatus.CONFIRMED,
          vouchers_id: voucherId,
          identified_house_number: houseNumber,
          reason: crossMatchReason,
          processed_at: new Date(),
        })
        .where('transactions_bank_id = :tbId', {
          tbId: Number(transactionBankId),
        })
        .andWhere('validation_status IN (:...statuses)', {
          statuses: [ValidationStatus.CONFLICT, ValidationStatus.NOT_FOUND],
        })
        .execute();

      this.logger.log(
        `TransactionStatus actualizados para depósito ${transactionBankId}: ${updateResult.affected} filas`,
      );

      // 3. Actualizar transactions_bank.confirmation_status = true
      await queryRunner.manager
        .createQueryBuilder()
        .update(TransactionBank)
        .set({ confirmation_status: true })
        .where('id = :id', { id: transactionBankId })
        .execute();

      // 4. Actualizar voucher.confirmation_status = true
      await queryRunner.manager
        .createQueryBuilder()
        .update(Voucher)
        .set({ confirmation_status: true })
        .where('id = :id', { id: voucherId })
        .execute();

      // 5. Crear Record con voucher_id y transaction_status_id
      const record = await this.recordRepository.create(
        {
          transaction_status_id: transactionStatus.id,
          vouchers_id: voucherId,
        },
        queryRunner,
      );
      recordId = record.id;

      // 6. Crear HouseRecord
      await this.houseRecordRepository.create(
        { house_id: house.id, record_id: recordId },
        queryRunner,
      );

      // 7. Auditoría
      const approval = queryRunner.manager.create(ManualValidationApproval, {
        transaction_id: Number(transactionBankId),
        voucher_id: voucherId,
        approved_by_user_id: userId,
        approval_notes: `Cross-match aplicado: Depósito ${transactionBankId} → Voucher ${voucherId} → Casa ${houseNumber}. ${adminNotes || ''}`,
        approved_at: new Date(),
      });
      await queryRunner.manager.save(approval);

      await queryRunner.commitTransaction();

      this.logger.log(
        `Cross-match aplicado: Depósito ${transactionBankId} → Voucher ${voucherId} → Casa ${houseNumber} por ${userId}`,
      );
    } catch (error) {
      await queryRunner.rollbackTransaction();
      this.logger.error(
        `Error aplicando cross-match: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
      throw error;
    } finally {
      await queryRunner.release();
    }

    // Fuera de transacción: asignar pago
    try {
      const period = await this.getOrCreateCurrentPeriod();
      const house = await this.houseRepository.findByNumberHouse(houseNumber);

      if (house) {
        await this.allocatePaymentUseCase.execute({
          record_id: recordId,
          house_id: house.id,
          amount_to_distribute: transactionBank.amount,
          period_id: period.id,
        });
        this.logger.log(
          `Pago asignado para cross-match: Depósito ${transactionBankId}`,
        );
      }
    } catch (allocationError) {
      this.logger.error(
        `Error asignando pago después de cross-match: ${allocationError instanceof Error ? allocationError.message : 'Unknown'}. La conciliación se completó pero la asignación falló.`,
      );
    }

    return {
      message: `Cross-match aplicado: Depósito ${transactionBankId} conciliado con Voucher ${voucherId} → Casa ${houseNumber}`,
      reconciliation: {
        transactionBankId,
        voucherId,
        houseNumber,
        status: 'confirmed',
      },
      appliedAt: new Date(),
    };
  }

  // ==================== MÉTODOS PRIVADOS ====================

  /**
   * Obtiene depósitos no reclamados (con TransactionStatus conflict o not-found)
   */
  /**
   * Obtiene depósitos no reclamados (con TransactionStatus conflict o not-found).
   *
   * NOTA: No filtramos por confirmation_status porque persistSurplus() marca
   * confirmation_status=true para evitar reprocesamiento en getPendingTransactions().
   * El filtro correcto es por validation_status del TransactionStatus.
   */
  private async getUnclaimedDepositsRaw(): Promise<DepositRow[]> {
    return this.dataSource
      .getRepository(TransactionBank)
      .createQueryBuilder('tb')
      .innerJoin(TransactionStatus, 'ts', 'ts.transactions_bank_id = tb.id')
      .where('tb.is_deposit = :isDeposit', { isDeposit: true })
      .andWhere('ts.validation_status IN (:...statuses)', {
        statuses: [ValidationStatus.CONFLICT, ValidationStatus.NOT_FOUND],
      })
      .select([
        'tb.id AS tb_id',
        'tb.amount AS tb_amount',
        'tb.date AS tb_date',
        'tb.time AS tb_time',
        'ts.id AS ts_id',
        'ts.validation_status AS ts_validation_status',
      ])
      .distinctOn(['tb.id'])
      .orderBy('tb.id')
      .getRawMany();
  }

  /**
   * Obtiene vouchers sin fondos (no conciliados, sin TransactionStatus CONFIRMED)
   */
  private async getUnfundedVouchersRaw(): Promise<VoucherRow[]> {
    return this.dataSource
      .getRepository(Voucher)
      .createQueryBuilder('v')
      .leftJoin(
        TransactionStatus,
        'ts',
        'ts.vouchers_id = v.id AND ts.validation_status = :confirmedStatus',
        { confirmedStatus: ValidationStatus.CONFIRMED },
      )
      .where('v.confirmation_status = :status', { status: false })
      .andWhere('ts.id IS NULL')
      .select([
        'v.id AS v_id',
        'v.amount AS v_amount',
        'v.date AS v_date',
      ])
      .orderBy('v.date', 'ASC')
      .getRawMany();
  }

  /**
   * Obtiene house numbers para vouchers via records -> house_records -> house
   * (reutiliza misma lógica que UnfundedVouchersService)
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

  /**
   * Agrupa items por (fecha_día, monto) para cross-matching
   */
  private groupByDateAndAmount<
    T extends { id: string; amount: number; date: Date },
  >(items: T[]): Map<string, T[]> {
    const groups = new Map<string, T[]>();

    for (const item of items) {
      const dateDay = this.formatDate(item.date);
      const key = `${dateDay}_${item.amount}`;

      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(item);
    }

    return groups;
  }

  /**
   * Formatea Date a string YYYY-MM-DD
   */
  private formatDate(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Obtiene o crea el período actual
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
}
