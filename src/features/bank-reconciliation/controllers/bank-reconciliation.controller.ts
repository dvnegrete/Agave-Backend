import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ReconcileUseCase } from '../application/reconcile.use-case';
import { ReconcileRequestDto, ReconciliationResponseDto } from '../dto';
import { ApiReconcileTransactions } from '../decorators/swagger.decorators';

@ApiTags('bank-reconciliation')
@Controller('bank-reconciliation')
export class BankReconciliationController {
  private readonly logger = new Logger(BankReconciliationController.name);

  constructor(private readonly reconcileUseCase: ReconcileUseCase) {}

  @Post('reconcile')
  @HttpCode(HttpStatus.OK)
  @ApiReconcileTransactions()
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
