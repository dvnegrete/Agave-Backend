import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Query,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { ReconcileUseCase } from '../application/reconcile.use-case';
import {
  ReconcileRequestDto,
  ReconciliationResponseDto,
  GetManualValidationCasesFilterDto,
  ApproveManualCaseDto,
  RejectManualCaseDto,
  ManualValidationCasesPageDto,
  ManualValidationStatsDto,
  ApproveManualCaseResponseDto,
  RejectManualCaseResponseDto,
} from '../dto';
import { ApiReconcileTransactions } from '../decorators/swagger.decorators';
import { ManualValidationService } from '../infrastructure/persistence/manual-validation.service';

@ApiTags('bank-reconciliation')
@Controller('bank-reconciliation')
export class BankReconciliationController {
  private readonly logger = new Logger(BankReconciliationController.name);

  constructor(
    private readonly reconcileUseCase: ReconcileUseCase,
    private readonly manualValidationService: ManualValidationService,
  ) {}

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

  // ==================== MANUAL VALIDATION ENDPOINTS ====================

  @Get('manual-validation/pending')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener casos pendientes de validación manual',
    description:
      'Lista los casos de conciliación que requieren revisión manual con filtros y paginación',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de casos pendientes',
    type: ManualValidationCasesPageDto,
  })
  async getPendingManualCases(
    @Query() filters: GetManualValidationCasesFilterDto,
  ): Promise<ManualValidationCasesPageDto> {
    this.logger.log(
      `Obteniendo casos pendientes de validación manual. Filtros: ${JSON.stringify(filters)}`,
    );

    return this.manualValidationService.getPendingManualCases(
      filters.startDate ? new Date(filters.startDate) : undefined,
      filters.endDate ? new Date(filters.endDate) : undefined,
      filters.houseNumber,
      filters.page,
      filters.limit,
      filters.sortBy,
    );
  }

  @Post('manual-validation/:transactionId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aprobar un caso de validación manual',
    description:
      'Aprueba un caso de validación manual eligiendo uno de los vouchers candidatos',
  })
  @ApiResponse({
    status: 200,
    description: 'Caso aprobado exitosamente',
    type: ApproveManualCaseResponseDto,
  })
  async approveManualCase(
    @Param('transactionId') transactionId: string,
    @Body() dto: ApproveManualCaseDto,
    @Req() req: any,
  ): Promise<ApproveManualCaseResponseDto> {
    const userId = req?.user?.id || 'system';

    this.logger.log(
      `Aprobando caso manual: Transaction ${transactionId} → Voucher ${dto.voucherId} por usuario ${userId}`,
    );

    return this.manualValidationService.approveManualCase(
      transactionId,
      dto.voucherId,
      userId,
      dto.approverNotes,
    );
  }

  @Post('manual-validation/:transactionId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Rechazar un caso de validación manual',
    description:
      'Rechaza todos los vouchers candidatos de un caso de validación manual',
  })
  @ApiResponse({
    status: 200,
    description: 'Caso rechazado exitosamente',
    type: RejectManualCaseResponseDto,
  })
  async rejectManualCase(
    @Param('transactionId') transactionId: string,
    @Body() dto: RejectManualCaseDto,
    @Req() req: any,
  ): Promise<RejectManualCaseResponseDto> {
    const userId = req?.user?.id || 'system';

    this.logger.log(
      `Rechazando caso manual: Transaction ${transactionId} por usuario ${userId}. Razón: ${dto.rejectionReason}`,
    );

    return this.manualValidationService.rejectManualCase(
      transactionId,
      userId,
      dto.rejectionReason,
      dto.notes,
    );
  }

  @Get('manual-validation/stats')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener estadísticas de validación manual',
    description:
      'Retorna estadísticas agregadas de casos de validación manual',
  })
  @ApiResponse({
    status: 200,
    description: 'Estadísticas de validación manual',
    type: ManualValidationStatsDto,
  })
  async getManualValidationStats(): Promise<ManualValidationStatsDto> {
    this.logger.log('Obteniendo estadísticas de validación manual');

    return this.manualValidationService.getManualValidationStats();
  }
}
