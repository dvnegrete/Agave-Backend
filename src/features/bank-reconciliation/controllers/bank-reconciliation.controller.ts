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
  GetUnclaimedDepositsFilterDto,
  UnclaimedDepositsPageDto,
  AssignHouseDto,
  AssignHouseResponseDto,
} from '../dto';
import { ApiReconcileTransactions } from '../decorators/swagger.decorators';
import { ManualValidationService } from '../infrastructure/persistence/manual-validation.service';
import { UnclaimedDepositsService } from '../infrastructure/persistence/unclaimed-deposits.service';

@ApiTags('bank-reconciliation')
@Controller('bank-reconciliation')
export class BankReconciliationController {
  private readonly logger = new Logger(BankReconciliationController.name);

  constructor(
    private readonly reconcileUseCase: ReconcileUseCase,
    private readonly manualValidationService: ManualValidationService,
    private readonly unclaimedDepositsService: UnclaimedDepositsService,
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
    description: 'Retorna estadísticas agregadas de casos de validación manual',
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

  // ==================== UNCLAIMED DEPOSITS ENDPOINTS ====================

  @Get('unclaimed-deposits')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener depósitos no reclamados',
    description:
      'Lista depósitos válidos que no pudieron conciliarse automáticamente (estados: conflict, not-found). Estos depósitos permanecerán en reportes financieros hasta que se asignen a una casa.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de depósitos no reclamados',
    type: UnclaimedDepositsPageDto,
  })
  async getUnclaimedDeposits(
    @Query() filters: GetUnclaimedDepositsFilterDto,
  ): Promise<UnclaimedDepositsPageDto> {
    this.logger.log(
      `Obteniendo depósitos no reclamados. Filtros: ${JSON.stringify(filters)}`,
    );

    return this.unclaimedDepositsService.getUnclaimedDeposits(
      filters.startDate ? new Date(filters.startDate) : undefined,
      filters.endDate ? new Date(filters.endDate) : undefined,
      filters.validationStatus,
      filters.houseNumber,
      filters.page,
      filters.limit,
      filters.sortBy,
    );
  }

  @Post('unclaimed-deposits/:transactionId/assign-house')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Asignar casa manualmente a un depósito',
    description:
      'Asigna manualmente una casa a un depósito que no pudo identificarse automáticamente. ' +
      'Completa la conciliación, crea el registro de pago y asigna automáticamente a conceptos. ' +
      'Se registra auditoría de quién realizó la asignación.',
  })
  @ApiResponse({
    status: 200,
    description: 'Depósito asignado exitosamente',
    type: AssignHouseResponseDto,
  })
  async assignHouseToDeposit(
    @Param('transactionId') transactionId: string,
    @Body() dto: AssignHouseDto,
    @Req() req: any,
  ): Promise<AssignHouseResponseDto> {
    const userId = req?.user?.id || 'system';

    this.logger.log(
      `Asignando casa ${dto.houseNumber} a depósito ${transactionId} por usuario ${userId}`,
    );

    return this.unclaimedDepositsService.assignHouseToDeposit(
      transactionId,
      dto.houseNumber,
      userId,
      dto.adminNotes,
    );
  }
}
