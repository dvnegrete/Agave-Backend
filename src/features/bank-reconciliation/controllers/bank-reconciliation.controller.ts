import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ReconcileUseCase } from '../application/reconcile.use-case';
import { ReconcileRequestDto, ReconciliationResponseDto } from '../dto';

@Controller('bank-reconciliation')
export class BankReconciliationController {
  private readonly logger = new Logger(BankReconciliationController.name);

  constructor(private readonly reconcileUseCase: ReconcileUseCase) {}

  /**
   * Endpoint para ejecutar el proceso de conciliación bancaria
   *
   * POST /bank-reconciliation/reconcile
   *
   * @param dto Parámetros opcionales de fecha
   * @returns Resultado de la conciliación con grupos: conciliados, pendientes, sobrantes
   *
   * @example
   * // Conciliar TODOS los registros pendientes
   * POST /bank-reconciliation/reconcile
   * Body: {}
   *
   * @example
   * // Conciliar solo registros de un rango de fechas
   * POST /bank-reconciliation/reconcile
   * Body: {
   *   "startDate": "2025-01-01",
   *   "endDate": "2025-01-31"
   * }
   */
  @Post('reconcile')
  @HttpCode(HttpStatus.OK)
  async reconcile(
    @Body() dto: ReconcileRequestDto,
  ): Promise<ReconciliationResponseDto> {
    this.logger.log(
      `Iniciando conciliación bancaria${dto.startDate && dto.endDate ? ` desde ${dto.startDate} hasta ${dto.endDate}` : ' de TODOS los registros pendientes'}`,
    );

    const startDate = dto.startDate ? new Date(dto.startDate) : undefined;
    const endDate = dto.endDate ? new Date(dto.endDate) : undefined;

    const result = await this.reconcileUseCase.execute({
      startDate,
      endDate,
    });

    this.logger.log(
      `Conciliación completada. Resumen: ${JSON.stringify(result.summary)}`,
    );

    return result;
  }
}
