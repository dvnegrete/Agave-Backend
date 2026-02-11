import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { HousePeriodChargeCalculatorService } from '../infrastructure/services/house-period-charge-calculator.service';
import { IPeriodRepository } from '../interfaces';

/**
 * Use case para obtener el balance de una casa en un período específico
 * Compara montos esperados (immutables) vs pagados
 * Utiliza la tabla house_period_charges para garantizar consistencia
 */
@Injectable()
export class GetHousePeriodBalanceUseCase {
  constructor(
    private readonly chargeCalculator: HousePeriodChargeCalculatorService,
    @Inject('IPeriodRepository')
    private readonly periodRepository: IPeriodRepository,
  ) {}

  /**
   * Obtiene el balance de una casa en un período
   */
  async execute(
    houseId: number,
    periodId: number,
  ): Promise<{
    houseId: number;
    periodId: number;
    totalExpected: number;
    totalPaid: number;
    balance: number;
    isPaid: boolean;
    details: Array<{
      conceptType: string;
      expectedAmount: number;
      paidAmount: number;
      balance: number;
      isPaid: boolean;
    }>;
  }> {
    // Validar que el período existe
    const period = await this.periodRepository.findById(periodId);
    if (!period) {
      throw new NotFoundException(`Period with ID ${periodId} not found`);
    }

    // Validar que el período tiene cargos (Fase 2)
    const isFullyCharged =
      await this.chargeCalculator.isPeriodFullyCharged(periodId);
    if (!isFullyCharged) {
      throw new NotFoundException(
        `Period ${periodId} does not have charges loaded. Run Seed first.`,
      );
    }

    // Obtener totales
    const totalExpected =
      await this.chargeCalculator.getTotalExpectedByHousePeriod(
        houseId,
        periodId,
      );
    const totalPaid = await this.chargeCalculator.getTotalPaidByHousePeriod(
      houseId,
      periodId,
    );
    const balance = await this.chargeCalculator.calculateBalance(
      houseId,
      periodId,
    );

    // Obtener detalles por concepto
    const details = await this.chargeCalculator.getPaymentDetails(
      houseId,
      periodId,
    );

    return {
      houseId,
      periodId,
      totalExpected,
      totalPaid,
      balance,
      isPaid: balance <= 0, // balance <= 0 significa que está pagado o sobrepagado
      details,
    };
  }
}
