import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { PaymentReportAnalyzerService } from '../infrastructure/services/payment-report-analyzer.service';
import { IPeriodRepository } from '../interfaces';

/**
 * Use case para obtener reporte agregado de un período
 * Muestra: total esperado, total pagado, deuda, distribución por concepto
 */
@Injectable()
export class GetPeriodReportUseCase {
  constructor(
    private readonly reportAnalyzer: PaymentReportAnalyzerService,
    @Inject('IPeriodRepository')
    private readonly periodRepository: IPeriodRepository,
  ) {}

  /**
   * Obtiene reporte de un período específico
   */
  async execute(periodId: number): Promise<{
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
    // Validar que el período existe
    const period = await this.periodRepository.findById(periodId);
    if (!period) {
      throw new NotFoundException(`Period with ID ${periodId} not found`);
    }

    // Obtener reporte
    return this.reportAnalyzer.getPeriodReport(periodId);
  }

  /**
   * Obtiene reporte del período actual (año/mes actual)
   */
  async executeForCurrentPeriod(): Promise<{
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
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const period = await this.periodRepository.findByYearAndMonth(year, month);
    if (!period) {
      throw new NotFoundException(
        `No period found for current month ${year}-${month}`,
      );
    }

    return this.reportAnalyzer.getPeriodReport(period.id);
  }
}
