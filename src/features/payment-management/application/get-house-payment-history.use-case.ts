import { Injectable, NotFoundException } from '@nestjs/common';
import { PaymentReportAnalyzerService } from '../infrastructure/services/payment-report-analyzer.service';
import { HouseRepository } from '@/shared/database/repositories/house.repository';

/**
 * Use case para obtener historial de pagos de una casa en múltiples períodos
 * Muestra evolución de deuda, tendencias de pago, patrones de comportamiento
 */
@Injectable()
export class GetHousePaymentHistoryUseCase {
  constructor(
    private readonly reportAnalyzer: PaymentReportAnalyzerService,
    private readonly houseRepository: HouseRepository,
  ) {}

  /**
   * Obtiene historial de pagos de una casa
   * @param houseId ID de la casa
   * @param limitMonths Número de meses a mostrar (default 12)
   */
  async execute(
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
    // Validar que la casa existe
    const house = await this.houseRepository.findById(houseId);
    if (!house) {
      throw new NotFoundException(`House with ID ${houseId} not found`);
    }

    // Validar límite de meses
    if (limitMonths < 1 || limitMonths > 60) {
      throw new Error('limitMonths must be between 1 and 60');
    }

    // Obtener historial
    return this.reportAnalyzer.getHousePaymentHistory(houseId, limitMonths);
  }

  /**
   * Obtiene historial de últimos 12 meses (default)
   */
  async executeLastYear(houseId: number): Promise<{
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
    return this.execute(houseId, 12);
  }

  /**
   * Obtiene historial de últimos 6 meses
   */
  async executeLastSixMonths(houseId: number): Promise<{
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
    return this.execute(houseId, 6);
  }
}
