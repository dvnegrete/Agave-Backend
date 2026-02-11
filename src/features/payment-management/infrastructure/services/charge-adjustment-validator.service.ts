import { Injectable, BadRequestException, Logger } from '@nestjs/common';

/**
 * Servicio para validar que los ajustes de cargos sean permitidos
 * Implementa reglas de negocio para modificaciones
 */
@Injectable()
export class ChargeAdjustmentValidatorService {
  private readonly logger = new Logger(ChargeAdjustmentValidatorService.name);

  /**
   * Valida si es permitido ajustar un cargo
   * Reglas:
   * - No permite ajustes a períodos más de 3 meses atrás (prevenir cambios históricos)
   * - No permite montos negativos
   * - Monto nuevo debe ser diferente al actual
   */
  validateAdjustment(
    currentAmount: number,
    newAmount: number,
    periodMonth: number,
    periodYear: number,
  ): void {
    // No permitir montos negativos
    if (newAmount < 0) {
      throw new BadRequestException('El nuevo monto no puede ser negativo');
    }

    // No permitir el mismo monto
    if (Math.abs(newAmount - currentAmount) < 0.01) {
      throw new BadRequestException(
        'El nuevo monto es igual al actual. No se requiere ajuste',
      );
    }

    // Verificar que no sea período muy antiguo (más de 3 meses atrás)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth() + 1;

    const periodDate = new Date(periodYear, periodMonth - 1, 1);
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    if (periodDate < threeMonthsAgo) {
      throw new BadRequestException(
        `No se pueden ajustar cargos de períodos anteriores a más de 3 meses atrás. Período: ${periodYear}-${periodMonth}`,
      );
    }

    this.logger.log(
      `Validación exitosa: ajuste de $${currentAmount} a $${newAmount} para período ${periodYear}-${periodMonth}`,
    );
  }

  /**
   * Valida si es permitido reversionar un cargo
   * Reglas:
   * - No permite reversionar períodos muy antiguos
   * - No permite reversionar si el cargo ya fue parcialmente pagado
   */
  validateReversal(
    chargeAmount: number,
    paidAmount: number,
    periodMonth: number,
    periodYear: number,
  ): void {
    // Verificar que no sea período muy antiguo
    const now = new Date();
    const periodDate = new Date(periodYear, periodMonth - 1, 1);
    const threeMonthsAgo = new Date(now);
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    if (periodDate < threeMonthsAgo) {
      throw new BadRequestException(
        `No se pueden reversionar cargos de períodos anteriores a más de 3 meses atrás. Período: ${periodYear}-${periodMonth}`,
      );
    }

    // No permitir reversionar si ya hay pagos parciales
    if (paidAmount > 0) {
      throw new BadRequestException(
        `No se puede reversionar un cargo que ya tiene pagos asignados (pagado: $${paidAmount}). Ajuste manualmente si es necesario`,
      );
    }

    this.logger.log(
      `Validación exitosa: reversión de cargo $${chargeAmount} para período ${periodYear}-${periodMonth}`,
    );
  }

  /**
   * Valida si es permitido condonar una penalidad
   * Reglas:
   * - Solo se pueden condonar penalidades, no otros conceptos
   * - No permite condonar si ya fue pagada
   */
  validatePenaltyCondonation(
    conceptType: string,
    paidAmount: number,
  ): void {
    // Solo permitir condonación de penalidades
    if (conceptType !== 'penalties') {
      throw new BadRequestException(
        `No se pueden condonar ${conceptType}. Solo se permiten condonaciones de penalidades`,
      );
    }

    // No permitir si ya fue pagada
    if (paidAmount > 0) {
      throw new BadRequestException(
        `No se puede condonar una penalidad que ya ha sido pagada (pagado: $${paidAmount})`,
      );
    }

    this.logger.log('Validación exitosa: condonación de penalidad');
  }

  /**
   * Calcula el ajuste (diferencia) entre monto anterior y nuevo
   * Positivo = aumento, Negativo = disminución
   */
  calculateAdjustmentDifference(
    currentAmount: number,
    newAmount: number,
  ): number {
    return newAmount - currentAmount;
  }
}
