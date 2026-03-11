import { Injectable, Inject, Logger } from '@nestjs/common';
import { IHousePeriodChargeRepository } from '../../interfaces/house-period-charge.repository.interface';
import { IRecordAllocationRepository } from '../../interfaces/record-allocation.repository.interface';
import { IPeriodRepository } from '../../interfaces/period.repository.interface';
import { HouseRepository } from '@/shared/database/repositories/house.repository';

/**
 * Servicio para análisis de reportes de pagos
 * Genera reportes de estado de pagos, tendencias de deuda, clasificación de casas
 */
@Injectable()
export class PaymentReportAnalyzerService {
  private readonly logger = new Logger(PaymentReportAnalyzerService.name);

  constructor(
    @Inject('IHousePeriodChargeRepository')
    private readonly chargeRepository: IHousePeriodChargeRepository,
    @Inject('IRecordAllocationRepository')
    private readonly allocationRepository: IRecordAllocationRepository,
    @Inject('IPeriodRepository')
    private readonly periodRepository: IPeriodRepository,
    private readonly houseRepository: HouseRepository,
  ) {}

  /**
   * Obtiene reporte agregado de un período
   * Muestra: total esperado, total pagado, deuda, porcentaje de cobranza
   */
  async getPeriodReport(periodId: number): Promise<{
    periodId: number;
    periodYear: number;
    periodMonth: number;
    totalExpected: number;
    totalPaid: number;
    totalDebt: number;
    collectionPercentage: number;
    conceptBreakdown: Array<{
      concept: string;
      expected: number;
      paid: number;
      debt: number;
      percentage: number;
    }>;
    housesWithDebt: number;
    housesFullyPaid: number;
    housesPartiallyPaid: number;
  }> {
    const period = await this.periodRepository.findById(periodId);
    if (!period) {
      throw new Error(`Period with ID ${periodId} not found`);
    }

    const charges = await this.chargeRepository.findByPeriod(periodId);

    // Agrupar por concepto
    const conceptMap = new Map<
      string,
      { expected: number; paid: number }
    >();

    for (const charge of charges) {
      const concept = charge.concept_type;
      if (!conceptMap.has(concept)) {
        conceptMap.set(concept, { expected: 0, paid: 0 });
      }
      const current = conceptMap.get(concept)!;
      current.expected += charge.expected_amount;
    }

    // Obtener pagos por concepto
    const allocations = await this.allocationRepository.findByPeriodId(
      periodId,
    );

    for (const allocation of allocations) {
      const concept = allocation.concept_type;
      if (!conceptMap.has(concept)) {
        conceptMap.set(concept, { expected: 0, paid: 0 });
      }
      const current = conceptMap.get(concept)!;
      current.paid += allocation.allocated_amount;
    }

    // Calcular totales
    const totalExpected = Array.from(conceptMap.values()).reduce(
      (sum, c) => sum + c.expected,
      0,
    );
    const totalPaid = Array.from(conceptMap.values()).reduce(
      (sum, c) => sum + c.paid,
      0,
    );
    const totalDebt = totalExpected - totalPaid;
    const collectionPercentage =
      totalExpected > 0 ? (totalPaid / totalExpected) * 100 : 0;

    // Desglose por concepto
    const conceptBreakdown = Array.from(conceptMap.entries()).map(
      ([concept, values]) => ({
        concept,
        expected: values.expected,
        paid: values.paid,
        debt: values.expected - values.paid,
        percentage:
          values.expected > 0
            ? (values.paid / values.expected) * 100
            : 0,
      }),
    );

    // Contar casas por estado de pago
    const housesData = await this.getHousePaymentStatus(periodId);
    const housesWithDebt = housesData.filter((h) => h.debt > 0).length;
    const housesFullyPaid = housesData.filter((h) => h.debt <= 0).length;
    const housesPartiallyPaid = housesData.filter(
      (h) => h.debt > 0 && h.paid > 0,
    ).length;

    return {
      periodId,
      periodYear: period.year,
      periodMonth: period.month,
      totalExpected,
      totalPaid,
      totalDebt,
      collectionPercentage: Math.round(collectionPercentage * 100) / 100,
      conceptBreakdown,
      housesWithDebt,
      housesFullyPaid,
      housesPartiallyPaid,
    };
  }

  /**
   * Obtiene historial de pagos de una casa en múltiples períodos
   * Muestra evolución de deuda, tendencias de pago
   */
  async getHousePaymentHistory(
    houseId: number,
    limitMonths: number = 12,
  ): Promise<{
    houseId: number;
    houseNumber: number;
    periods: Array<{
      periodId: number;
      year: number;
      month: number;
      expected: number;
      paid: number;
      debt: number;
      isPaid: boolean;
      paymentPercentage: number;
    }>;
    totalExpectedAllTime: number;
    totalPaidAllTime: number;
    totalDebtAllTime: number;
    averagePaymentPercentage: number;
    debtTrend: 'improving' | 'stable' | 'worsening';
  }> {
    const house = await this.houseRepository.findById(houseId);
    if (!house) {
      throw new Error(`House with ID ${houseId} not found`);
    }

    // Obtener períodos (limitados a últimos X meses)
    const allPeriods = await this.periodRepository.findAll();
    const recentPeriods = allPeriods
      .sort((a, b) => {
        const aKey = a.year * 12 + a.month;
        const bKey = b.year * 12 + b.month;
        return bKey - aKey; // Orden descendente (más recientes primero)
      })
      .slice(0, limitMonths)
      .reverse(); // Invertir a orden ascendente

    const periodData: Array<{
      periodId: number;
      year: number;
      month: number;
      expected: number;
      paid: number;
      debt: number;
      isPaid: boolean;
      paymentPercentage: number;
    }> = [];

    let totalExpectedAllTime = 0;
    let totalPaidAllTime = 0;

    for (const period of recentPeriods) {
      const charges = await this.chargeRepository.findByHouseAndPeriod(
        houseId,
        period.id,
      );
      const allocations = await this.allocationRepository.findByHouseAndPeriod(
        houseId,
        period.id,
      );

      const expected = charges.reduce((sum, c) => sum + c.expected_amount, 0);
      const paid = allocations.reduce(
        (sum, a) => sum + a.allocated_amount,
        0,
      );
      const debt = expected - paid;

      const paymentPercentage =
        expected > 0 ? (paid / expected) * 100 : 0;

      periodData.push({
        periodId: period.id,
        year: period.year,
        month: period.month,
        expected,
        paid,
        debt,
        isPaid: debt <= 0,
        paymentPercentage: Math.round(paymentPercentage * 100) / 100,
      });

      totalExpectedAllTime += expected;
      totalPaidAllTime += paid;
    }

    const totalDebtAllTime = totalExpectedAllTime - totalPaidAllTime;
    const averagePaymentPercentage =
      totalExpectedAllTime > 0
        ? (totalPaidAllTime / totalExpectedAllTime) * 100
        : 0;

    // Determinar tendencia de deuda
    let debtTrend: 'improving' | 'stable' | 'worsening' = 'stable';
    if (periodData.length >= 2) {
      const oldestDebt = periodData[0].debt;
      const newestDebt = periodData[periodData.length - 1].debt;
      if (newestDebt < oldestDebt * 0.9) {
        debtTrend = 'improving';
      } else if (newestDebt > oldestDebt * 1.1) {
        debtTrend = 'worsening';
      }
    }

    return {
      houseId,
      houseNumber: house.number_house,
      periods: periodData,
      totalExpectedAllTime,
      totalPaidAllTime,
      totalDebtAllTime,
      averagePaymentPercentage: Math.round(averagePaymentPercentage * 100) / 100,
      debtTrend,
    };
  }

  /**
   * Clasifica casas según su comportamiento de pago
   * Retorna: pagadores consistentes, morosos, en riesgo
   */
  async classifyHousesByPaymentBehavior(periodId: number): Promise<{
    goodPayers: Array<{
      houseId: number;
      houseNumber: number;
      lastPeriods: number;
      fullyPaidPercentage: number;
    }>;
    atRisk: Array<{
      houseId: number;
      houseNumber: number;
      debt: number;
      monthsBehind: number;
      lastPaymentDate: Date | null;
    }>;
    delinquent: Array<{
      houseId: number;
      houseNumber: number;
      totalDebt: number;
      monthsDelinquent: number;
    }>;
  }> {
    const houses = await this.houseRepository.findAll();
    const allPeriods = await this.periodRepository.findAll();

    // Obtener últimos 6 períodos para análisis
    const recentPeriods = allPeriods
      .sort((a, b) => {
        const aKey = a.year * 12 + a.month;
        const bKey = b.year * 12 + b.month;
        return bKey - aKey;
      })
      .slice(0, 6)
      .reverse();

    const goodPayers: Array<{
      houseId: number;
      houseNumber: number;
      lastPeriods: number;
      fullyPaidPercentage: number;
    }> = [];

    const atRisk: Array<{
      houseId: number;
      houseNumber: number;
      debt: number;
      monthsBehind: number;
      lastPaymentDate: Date | null;
    }> = [];

    const delinquent: Array<{
      houseId: number;
      houseNumber: number;
      totalDebt: number;
      monthsDelinquent: number;
    }> = [];

    for (const house of houses) {
      let fullyPaidCount = 0;
      let totalDebt = 0;
      let monthsBehind = 0;
      let lastPaymentDate: Date | null = null;

      for (const period of recentPeriods) {
        const charges = await this.chargeRepository.findByHouseAndPeriod(
          house.id,
          period.id,
        );
        const allocations = await this.allocationRepository.findByHouseAndPeriod(
          house.id,
          period.id,
        );

        const expected = charges.reduce(
          (sum, c) => sum + c.expected_amount,
          0,
        );
        const paid = allocations.reduce(
          (sum, a) => sum + a.allocated_amount,
          0,
        );
        const debt = expected - paid;

        if (debt <= 0) {
          fullyPaidCount++;
        } else {
          totalDebt += debt;
          monthsBehind++;
        }

        if (paid > 0 && allocations.length > 0) {
          const maxDate = allocations.reduce((max, a) => {
            return a.created_at > max ? a.created_at : max;
          }, new Date(0));
          if (!lastPaymentDate || maxDate > lastPaymentDate) {
            lastPaymentDate = maxDate;
          }
        }
      }

      const fullyPaidPercentage =
        recentPeriods.length > 0
          ? (fullyPaidCount / recentPeriods.length) * 100
          : 0;

      // Clasificar
      if (fullyPaidPercentage >= 80) {
        goodPayers.push({
          houseId: house.id,
          houseNumber: house.number_house,
          lastPeriods: recentPeriods.length,
          fullyPaidPercentage: Math.round(fullyPaidPercentage * 100) / 100,
        });
      } else if (monthsBehind >= 3) {
        delinquent.push({
          houseId: house.id,
          houseNumber: house.number_house,
          totalDebt,
          monthsDelinquent: monthsBehind,
        });
      } else if (monthsBehind > 0) {
        atRisk.push({
          houseId: house.id,
          houseNumber: house.number_house,
          debt: totalDebt,
          monthsBehind,
          lastPaymentDate,
        });
      }
    }

    return {
      goodPayers: goodPayers.sort((a, b) => b.fullyPaidPercentage - a.fullyPaidPercentage),
      atRisk: atRisk.sort((a, b) => b.monthsBehind - a.monthsBehind),
      delinquent: delinquent.sort((a, b) => b.totalDebt - a.totalDebt),
    };
  }

  /**
   * Obtiene estado de pago de todas las casas en un período
   * @private
   */
  private async getHousePaymentStatus(
    periodId: number,
  ): Promise<
    Array<{
      houseId: number;
      houseNumber: number;
      expected: number;
      paid: number;
      debt: number;
    }>
  > {
    const houses = await this.houseRepository.findAll();
    const result: Array<{
      houseId: number;
      houseNumber: number;
      expected: number;
      paid: number;
      debt: number;
    }> = [];

    for (const house of houses) {
      const charges = await this.chargeRepository.findByHouseAndPeriod(
        house.id,
        periodId,
      );
      const allocations = await this.allocationRepository.findByHouseAndPeriod(
        house.id,
        periodId,
      );

      const expected = charges.reduce((sum, c) => sum + c.expected_amount, 0);
      const paid = allocations.reduce(
        (sum, a) => sum + a.allocated_amount,
        0,
      );
      const debt = expected - paid;

      result.push({
        houseId: house.id,
        houseNumber: house.number_house,
        expected,
        paid,
        debt,
      });
    }

    return result;
  }
}
