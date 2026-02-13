import { Injectable, Inject, Logger } from '@nestjs/common';
import { House, Period, PeriodConfig } from '@/shared/database/entities';
import {
  AllocationConceptType,
  ConceptType,
} from '@/shared/database/entities/enums';
import { BusinessValues } from '@/shared/content/config/business-values.config';
import {
  IRecordAllocationRepository,
  IPeriodRepository,
  IPeriodConfigRepository,
  IHouseBalanceRepository,
  IHousePeriodOverrideRepository,
  IHousePeriodChargeRepository,
} from '../interfaces';
import { GeneratePenaltyUseCase } from './generate-penalty.use-case';
import {
  EnrichedHouseBalance,
  HouseStatus,
  PeriodPaymentDetail,
  PeriodPaymentStatus,
  ConceptBreakdown,
} from '../domain/house-balance-status.types';
import { formatMonthName } from '@/shared/common/utils/date';
import { HOUSE_STATUS_MESSAGES } from '@/shared/common/constants/messages';

@Injectable()
export class CalculateHouseBalanceStatusUseCase {
  private readonly logger = new Logger(CalculateHouseBalanceStatusUseCase.name);

  constructor(
    @Inject('IRecordAllocationRepository')
    private readonly recordAllocationRepository: IRecordAllocationRepository,
    @Inject('IPeriodRepository')
    private readonly periodRepository: IPeriodRepository,
    @Inject('IPeriodConfigRepository')
    private readonly periodConfigRepository: IPeriodConfigRepository,
    @Inject('IHouseBalanceRepository')
    private readonly houseBalanceRepository: IHouseBalanceRepository,
    @Inject('IHousePeriodOverrideRepository')
    private readonly housePeriodOverrideRepository: IHousePeriodOverrideRepository,
    @Inject('IHousePeriodChargeRepository')
    private readonly housePeriodChargeRepository: IHousePeriodChargeRepository,
    private readonly generatePenaltyUseCase: GeneratePenaltyUseCase,
  ) {}

  async execute(houseId: number, house: House): Promise<EnrichedHouseBalance> {
    // Obtener todos los períodos (desde el más antiguo)
    const periods = await this.periodRepository.findAll();
    if (periods.length === 0) {
      return this.buildEmptyBalance(houseId, house.number_house);
    }

    // Ordenar ASC por año/mes
    const sortedPeriods = [...periods].sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month,
    );

    // Obtener balance actual
    const balance = await this.houseBalanceRepository.getOrCreate(houseId);

    // Calcular detalle de cada período
    const periodDetails: PeriodPaymentDetail[] = [];

    for (const period of sortedPeriods) {
      const detail = await this.calculatePeriodDetail(houseId, period);
      periodDetails.push(detail);
    }

    // Clasificar períodos
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const unpaidPeriods = periodDetails.filter(
      (p) => p.status !== PeriodPaymentStatus.PAID,
    );
    const paidPeriods = periodDetails.filter(
      (p) => p.status === PeriodPaymentStatus.PAID,
    );
    const currentPeriod =
      periodDetails.find(
        (p) => p.year === currentYear && p.month === currentMonth,
      ) ?? null;

    // Determinar status
    const status = this.determineHouseStatus(
      unpaidPeriods,
      balance.credit_balance,
    );

    // Calcular totales
    const totalExpected = periodDetails.reduce(
      (sum, p) => sum + p.expected_total,
      0,
    );
    const totalPaid = periodDetails.reduce((sum, p) => sum + p.paid_total, 0);
    const totalPending = periodDetails.reduce(
      (sum, p) => sum + p.pending_total,
      0,
    );
    const totalPenalties = periodDetails.reduce(
      (sum, p) => sum + p.penalty_amount,
      0,
    );

    // Calcular siguiente fecha de vencimiento
    const activeConfig =
      await this.periodConfigRepository.findActiveForDate(now);
    const dueDay = activeConfig?.payment_due_day ?? 15;
    const nextDueDate = this.calculateNextDueDate(dueDay);
    const deadlineMessage = this.buildDeadlineMessage(
      status,
      unpaidPeriods.length,
      nextDueDate,
    );

    return {
      house_id: houseId,
      house_number: house.number_house,
      status,
      total_debt: Math.round(totalPending * 100) / 100,
      credit_balance: Math.round(balance.credit_balance * 100) / 100,
      accumulated_cents: Math.round(balance.accumulated_cents * 100) / 100,
      unpaid_periods: unpaidPeriods,
      paid_periods: paidPeriods,
      current_period: currentPeriod,
      next_due_date: nextDueDate,
      deadline_message: deadlineMessage,
      total_unpaid_periods: unpaidPeriods.length,
      summary: {
        total_expected: Math.round(totalExpected * 100) / 100,
        total_paid: Math.round(totalPaid * 100) / 100,
        total_pending: Math.round(totalPending * 100) / 100,
        total_penalties: Math.round(totalPenalties * 100) / 100,
      },
    };
  }

  private async calculatePeriodDetail(
    houseId: number,
    period: Period,
    generatePenalties = true,
  ): Promise<PeriodPaymentDetail> {
    // Obtener config activa para la fecha del período
    const periodStartDate =
      period.start_date instanceof Date
        ? period.start_date
        : new Date(period.start_date);
    const config =
      await this.periodConfigRepository.findActiveForDate(periodStartDate);

    if (!config) {
      this.logger.warn(
        `No se encontró PeriodConfig para período ${period.year}-${period.month}, usando config actual`,
      );
    }

    // Calcular montos esperados por concepto
    // Fuente de verdad: house_period_charges (por casa/período/concepto)
    // Fallback: PeriodConfig defaults (solo si no existen charges)
    const concepts: ConceptBreakdown[] = [];
    let expectedTotal = 0;

    const charges =
      await this.housePeriodChargeRepository.findByHouseAndPeriod(
        houseId,
        period.id,
      );

    if (charges.length > 0) {
      // Usar montos de house_period_charges (fuente de verdad)
      for (const charge of charges) {
        concepts.push({
          concept_type: charge.concept_type as AllocationConceptType,
          expected_amount: charge.expected_amount,
          paid_amount: 0,
          pending_amount: charge.expected_amount,
        });
        expectedTotal += charge.expected_amount;
      }
    } else {
      // Fallback: PeriodConfig defaults (períodos legacy sin charges)
      const maintenanceExpected = config
        ? await this.housePeriodOverrideRepository.getApplicableAmount(
            houseId,
            period.id,
            ConceptType.MAINTENANCE,
            config.default_maintenance_amount,
          )
        : BusinessValues.payments.defaultMaintenanceAmount;
      concepts.push({
        concept_type: AllocationConceptType.MAINTENANCE,
        expected_amount: maintenanceExpected,
        paid_amount: 0,
        pending_amount: maintenanceExpected,
      });
      expectedTotal += maintenanceExpected;

      if (period.water_active && config?.default_water_amount) {
        const waterExpected =
          await this.housePeriodOverrideRepository.getApplicableAmount(
            houseId,
            period.id,
            ConceptType.WATER,
            config.default_water_amount,
          );
        concepts.push({
          concept_type: AllocationConceptType.WATER,
          expected_amount: waterExpected,
          paid_amount: 0,
          pending_amount: waterExpected,
        });
        expectedTotal += waterExpected;
      }

      if (
        period.extraordinary_fee_active &&
        config?.default_extraordinary_fee_amount
      ) {
        const feeExpected =
          await this.housePeriodOverrideRepository.getApplicableAmount(
            houseId,
            period.id,
            ConceptType.EXTRAORDINARY_FEE,
            config.default_extraordinary_fee_amount,
          );
        concepts.push({
          concept_type: AllocationConceptType.EXTRAORDINARY_FEE,
          expected_amount: feeExpected,
          paid_amount: 0,
          pending_amount: feeExpected,
        });
        expectedTotal += feeExpected;
      }
    }

    // Obtener allocations reales
    const allocations =
      await this.recordAllocationRepository.findByHouseAndPeriod(
        houseId,
        period.id,
      );

    let paidTotal = 0;
    for (const allocation of allocations) {
      const concept = concepts.find(
        (c) => c.concept_type === allocation.concept_type,
      );
      if (concept) {
        concept.paid_amount += allocation.allocated_amount;
        concept.pending_amount = Math.max(
          0,
          concept.expected_amount - concept.paid_amount,
        );
      }
      paidTotal += allocation.allocated_amount;
    }

    const pendingTotal = Math.max(0, expectedTotal - paidTotal);

    // Determinar si está vencido
    const now = new Date();
    const dueDay = config?.payment_due_day ?? 15;
    const periodEndForDue = new Date(period.year, period.month - 1, dueDay);
    const isOverdue = now > periodEndForDue && pendingTotal > 0;

    // Generar penalidad si periodo vencido e impago (solo para periodos pasados)
    let penaltyAmount = 0;
    if (isOverdue && generatePenalties) {
      const penalty = await this.generatePenaltyUseCase.execute(
        houseId,
        period.id,
        periodStartDate,
      );
      penaltyAmount =
        penalty?.amount ?? config?.late_payment_penalty_amount ?? 0;
      // Si ya existía una penalidad, obtener su monto
      if (!penalty) {
        // Penalty ya existe, check its amount (from the penalty_amount of config)
        penaltyAmount = config?.late_payment_penalty_amount ?? 0;
      }
    }

    // Determinar status del período
    let status: PeriodPaymentStatus;
    if (Math.round(pendingTotal * 100) / 100 <= 0) {
      status = PeriodPaymentStatus.PAID;
    } else if (paidTotal > 0) {
      status = PeriodPaymentStatus.PARTIAL;
    } else {
      status = PeriodPaymentStatus.UNPAID;
    }

    return {
      period_id: period.id,
      year: period.year,
      month: period.month,
      display_name: formatMonthName(period.month, period.year),
      expected_total: Math.round(expectedTotal * 100) / 100,
      paid_total: Math.round(paidTotal * 100) / 100,
      pending_total: Math.round(pendingTotal * 100) / 100,
      penalty_amount: Math.round(penaltyAmount * 100) / 100,
      status,
      concepts: concepts.map((c) => ({
        ...c,
        paid_amount: Math.round(c.paid_amount * 100) / 100,
        pending_amount: Math.round(c.pending_amount * 100) / 100,
      })),
      is_overdue: isOverdue,
    };
  }

  private determineHouseStatus(
    unpaidPeriods: PeriodPaymentDetail[],
    creditBalance: number,
  ): HouseStatus {
    if (creditBalance > 0 && unpaidPeriods.length === 0) {
      return HouseStatus.SALDO_A_FAVOR;
    }
    if (unpaidPeriods.some((p) => p.is_overdue)) {
      return HouseStatus.MOROSA;
    }
    if (unpaidPeriods.length === 0) {
      return HouseStatus.AL_DIA;
    }
    // Tiene períodos impagos pero no vencidos todavía
    return HouseStatus.AL_DIA;
  }

  private calculateNextDueDate(dueDay: number): string {
    const now = new Date();
    let year = now.getFullYear();
    let month = now.getMonth() + 1;
    const day = now.getDate();

    if (day > dueDay) {
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }

    const monthStr = String(month).padStart(2, '0');
    const dayStr = String(dueDay).padStart(2, '0');
    return `${year}-${monthStr}-${dayStr}`;
  }

  private buildDeadlineMessage(
    status: HouseStatus,
    unpaidCount: number,
    nextDueDate: string,
  ): string | null {
    if (status === HouseStatus.MOROSA) {
      return HOUSE_STATUS_MESSAGES.MOROSA(unpaidCount, nextDueDate);
    }
    if (status === HouseStatus.AL_DIA) {
      return HOUSE_STATUS_MESSAGES.AL_DIA(nextDueDate);
    }
    if (status === HouseStatus.SALDO_A_FAVOR) {
      return HOUSE_STATUS_MESSAGES.SALDO_A_FAVOR(nextDueDate);
    }
    return null;
  }

  private buildEmptyBalance(
    houseId: number,
    houseNumber: number,
  ): EnrichedHouseBalance {
    return {
      house_id: houseId,
      house_number: houseNumber,
      status: HouseStatus.AL_DIA,
      total_debt: 0,
      credit_balance: 0,
      accumulated_cents: 0,
      unpaid_periods: [],
      paid_periods: [],
      current_period: null,
      next_due_date: null,
      deadline_message: 'Sin periodos registrados',
      total_unpaid_periods: 0,
      summary: {
        total_expected: 0,
        total_paid: 0,
        total_pending: 0,
        total_penalties: 0,
      },
    };
  }
}
