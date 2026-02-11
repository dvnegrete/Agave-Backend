import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PaymentReportAnalyzerService } from '../infrastructure/services/payment-report-analyzer.service';
import { IPeriodRepository } from '../interfaces';

/**
 * Use case para clasificar casas según su comportamiento de pago
 * Retorna: pagadores consistentes, en riesgo, morosos
 */
@Injectable()
export class ClassifyHousesByPaymentUseCase {
  constructor(
    private readonly reportAnalyzer: PaymentReportAnalyzerService,
    @Inject('IPeriodRepository')
    private readonly periodRepository: IPeriodRepository,
  ) {}

  /**
   * Clasifica casas basado en un período específico
   * Analiza los últimos 6 períodos para determinar el patrón
   */
  async execute(periodId: number): Promise<{
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
    // Validar que el período existe
    const period = await this.periodRepository.findById(periodId);
    if (!period) {
      throw new NotFoundException(`Period with ID ${periodId} not found`);
    }

    // Obtener clasificación
    return this.reportAnalyzer.classifyHousesByPaymentBehavior(periodId);
  }

  /**
   * Clasifica casas basado en el período actual
   */
  async executeForCurrentPeriod(): Promise<{
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
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const period = await this.periodRepository.findByYearAndMonth(year, month);
    if (!period) {
      throw new NotFoundException(
        `No period found for current month ${year}-${month}`,
      );
    }

    return this.reportAnalyzer.classifyHousesByPaymentBehavior(period.id);
  }

  /**
   * Obtiene solo las casas en riesgo (para acción inmediata)
   */
  async executeGetAtRiskOnly(periodId: number): Promise<
    Array<{
      houseId: number;
      houseNumber: number;
      debt: number;
      monthsBehind: number;
      lastPaymentDate: Date | null;
    }>
  > {
    const classification = await this.execute(periodId);
    return classification.atRisk;
  }

  /**
   * Obtiene solo las casas morosas (para escalación)
   */
  async executeGetDelinquentOnly(periodId: number): Promise<
    Array<{
      houseId: number;
      houseNumber: number;
      totalDebt: number;
      monthsDelinquent: number;
    }>
  > {
    const classification = await this.execute(periodId);
    return classification.delinquent;
  }
}
