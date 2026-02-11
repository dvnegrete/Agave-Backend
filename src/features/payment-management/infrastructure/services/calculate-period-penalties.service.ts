import { Injectable, Inject, Logger } from '@nestjs/common';
import { IRecordAllocationRepository } from '../../interfaces/record-allocation.repository.interface';
import { IPeriodRepository } from '../../interfaces/period.repository.interface';
import { IPeriodConfigRepository } from '../../interfaces/period-config.repository.interface';

/**
 * Servicio para calcular penalidades automáticas basadas en deuda de períodos anteriores
 * Las penalidades se crean en house_period_charges como source: 'auto_penalty'
 * Esto permite que se incluyan automáticamente en la distribución FIFO
 */
@Injectable()
export class CalculatePeriodPenaltiesService {
  private readonly logger = new Logger(CalculatePeriodPenaltiesService.name);

  constructor(
    @Inject('IRecordAllocationRepository')
    private readonly allocationRepository: IRecordAllocationRepository,
    @Inject('IPeriodRepository')
    private readonly periodRepository: IPeriodRepository,
    @Inject('IPeriodConfigRepository')
    private readonly configRepository: IPeriodConfigRepository,
  ) {}

  /**
   * Calcula penalidades para una casa en un nuevo período
   * Busca deuda en períodos anteriores no pagados
   * Retorna monto de penalidad a aplicar (0 si no hay deuda)
   */
  async calculatePenaltyForHouse(
    houseId: number,
    newPeriodId: number,
  ): Promise<number> {
    // Obtener el período nuevo para saber cuándo comienza
    const newPeriod = await this.periodRepository.findById(newPeriodId);
    if (!newPeriod) {
      throw new Error(`Period with ID ${newPeriodId} not found`);
    }

    // Obtener configuración activa para la fecha del nuevo período
    const config = await this.configRepository.findActiveForDate(
      new Date(newPeriod.year, newPeriod.month - 1, 1),
    );

    if (!config) {
      this.logger.warn(
        `No PeriodConfig found for period ${newPeriodId}. No penalties.`,
      );
      return 0;
    }

    // Buscar deuda en períodos anteriores
    const hasDebt = await this.hasUnpaidDebtInPreviousPeriods(
      houseId,
      newPeriod.id,
    );

    // Si hay deuda, retornar monto de penalidad
    if (hasDebt) {
      return config.late_payment_penalty_amount;
    }

    return 0;
  }

  /**
   * Verifica si una casa tiene deuda sin pagar en períodos anteriores al nuevo período
   * @private
   */
  private async hasUnpaidDebtInPreviousPeriods(
    houseId: number,
    newPeriodId: number,
  ): Promise<boolean> {
    // Obtener el período nuevo
    const newPeriod = await this.periodRepository.findById(newPeriodId);
    if (!newPeriod) {
      return false;
    }

    // Buscar todos los períodos anteriores (year * 12 + month < newPeriodYearMonth)
    const newPeriodKey = newPeriod.year * 12 + newPeriod.month;

    // Obtener todos los períodos
    const allPeriods = await this.periodRepository.findAll();

    // Filtrar períodos anteriores
    const previousPeriods = allPeriods.filter((p) => {
      const periodKey = p.year * 12 + p.month;
      return periodKey < newPeriodKey;
    });

    // Para cada período anterior, verificar si hay deuda
    for (const period of previousPeriods) {
      const hasPeriodDebt = await this.checkPeriodDebt(houseId, period.id);
      if (hasPeriodDebt) {
        return true;
      }
    }

    return false;
  }

  /**
   * Verifica si una casa tiene deuda en un período específico
   * Deuda = expected - paid > 0
   * @private
   */
  private async checkPeriodDebt(
    houseId: number,
    periodId: number,
  ): Promise<boolean> {
    // Obtener total pagado en este período
    const totalPaid =
      await this.allocationRepository.getTotalPaidByHousePeriod(
        houseId,
        periodId,
      );

    // Obtener total esperado (desde record_allocations, que registra expected_amount)
    // Nota: Si el período fue creado antes de Fase 2, usamos expected_amount de allocations
    const allocations =
      await this.allocationRepository.findByHouseAndPeriod(houseId, periodId);

    const totalExpected = allocations.reduce(
      (sum, a) => sum + a.expected_amount,
      0,
    );

    // Si expected > paid, hay deuda
    return totalExpected > totalPaid;
  }

  /**
   * Obtiene la descripción de la penalidad para una casa
   */
  getDescription(periodId: number): string {
    return `Penalidad por deuda en períodos anteriores al período ${periodId}`;
  }
}
