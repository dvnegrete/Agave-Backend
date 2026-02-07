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
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { AuthGuard } from '@/shared/auth/guards/auth.guard';
import { RoleGuard } from '@/shared/auth/guards/roles.guard';
import { Roles } from '@/shared/auth/decorators/roles.decorator';
import { Role } from '@/shared/database/entities/enums';
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
  GetUnfundedVouchersFilterDto,
  UnfundedVouchersPageDto,
  MatchVoucherToDepositDto,
  MatchVoucherResponseDto,
  MatchSuggestionsResponseDto,
  ApplyMatchSuggestionDto,
  ApplyMatchSuggestionResponseDto,
  ApplyBatchMatchSuggestionsDto,
  ApplyBatchResponseDto,
} from '../dto';
import { ApiReconcileTransactions } from '../decorators/swagger.decorators';
import { ManualValidationService } from '../infrastructure/persistence/manual-validation.service';
import { UnclaimedDepositsService } from '../infrastructure/persistence/unclaimed-deposits.service';
import { UnfundedVouchersService } from '../infrastructure/persistence/unfunded-vouchers.service';
import { MatchSuggestionsService } from '../infrastructure/persistence/match-suggestions.service';

@ApiTags('bank-reconciliation')
@Controller('bank-reconciliation')
export class BankReconciliationController {
  private readonly logger = new Logger(BankReconciliationController.name);

  constructor(
    private readonly reconcileUseCase: ReconcileUseCase,
    private readonly manualValidationService: ManualValidationService,
    private readonly unclaimedDepositsService: UnclaimedDepositsService,
    private readonly unfundedVouchersService: UnfundedVouchersService,
    private readonly matchSuggestionsService: MatchSuggestionsService,
  ) {}

  @Post('reconcile')
  @UseGuards(AuthGuard)
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
  @UseGuards(AuthGuard)
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
  @UseGuards(AuthGuard)
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
    const userId = req.user.id;

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
  @UseGuards(AuthGuard)
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
    const userId = req.user.id;

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
  @UseGuards(AuthGuard)
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
  @UseGuards(AuthGuard)
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
  @UseGuards(AuthGuard)
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
    const userId = req.user.id;

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

  // ==================== UNFUNDED VOUCHERS ENDPOINTS ====================

  @Get('unfunded-vouchers')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener vouchers sin fondos',
    description:
      'Lista vouchers con confirmation_status=false que no tienen un TransactionStatus confirmado. ' +
      'Estos son vouchers que fueron subidos pero no se encontró un depósito bancario correspondiente.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista paginada de vouchers sin fondos',
    type: UnfundedVouchersPageDto,
  })
  async getUnfundedVouchers(
    @Query() filters: GetUnfundedVouchersFilterDto,
  ): Promise<UnfundedVouchersPageDto> {
    this.logger.log(
      `Obteniendo vouchers sin fondos. Filtros: ${JSON.stringify(filters)}`,
    );

    return this.unfundedVouchersService.getUnfundedVouchers(
      filters.startDate ? new Date(filters.startDate) : undefined,
      filters.endDate ? new Date(filters.endDate) : undefined,
      filters.page,
      filters.limit,
      filters.sortBy,
    );
  }

  @Post('unfunded-vouchers/:voucherId/match-deposit')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Conciliar manualmente un voucher sin fondos con un depósito',
    description:
      'Vincula un voucher sin fondos con un depósito bancario existente. ' +
      'Crea la conciliación completa: TransactionStatus, Record, HouseRecord y asignación de pagos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Voucher conciliado exitosamente',
    type: MatchVoucherResponseDto,
  })
  async matchVoucherToDeposit(
    @Param('voucherId') voucherId: string,
    @Body() dto: MatchVoucherToDepositDto,
    @Req() req: any,
  ): Promise<MatchVoucherResponseDto> {
    const userId = req.user.id;

    this.logger.log(
      `Conciliando voucher ${voucherId} con depósito ${dto.transactionBankId} → Casa ${dto.houseNumber} por usuario ${userId}`,
    );

    return this.unfundedVouchersService.matchVoucherToDeposit(
      Number(voucherId),
      dto.transactionBankId,
      dto.houseNumber,
      userId,
      dto.adminNotes,
    );
  }

  // ==================== MATCH SUGGESTIONS (CROSS-MATCHING) ENDPOINTS ====================

  @Get('match-suggestions')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener sugerencias de cross-matching',
    description:
      'Analiza depósitos no reclamados y vouchers sin fondos para encontrar posibles coincidencias ' +
      'basándose en monto y fecha. Retorna sugerencias con nivel de confianza.',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de sugerencias de cross-matching',
    type: MatchSuggestionsResponseDto,
  })
  async getMatchSuggestions(): Promise<MatchSuggestionsResponseDto> {
    this.logger.log('Obteniendo sugerencias de cross-matching');

    return this.matchSuggestionsService.findMatchSuggestions();
  }

  @Post('match-suggestions/apply')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aplicar una sugerencia de cross-matching',
    description:
      'Concilia un depósito no reclamado con un voucher sin fondos. ' +
      'Actualiza TransactionStatus, crea Record/HouseRecord, y asigna pagos.',
  })
  @ApiResponse({
    status: 200,
    description: 'Sugerencia aplicada exitosamente',
    type: ApplyMatchSuggestionResponseDto,
  })
  async applyMatchSuggestion(
    @Body() dto: ApplyMatchSuggestionDto,
    @Req() req: any,
  ): Promise<ApplyMatchSuggestionResponseDto> {
    const userId = req.user.id;

    this.logger.log(
      `Aplicando cross-match: Depósito ${dto.transactionBankId} → Voucher ${dto.voucherId} → Casa ${dto.houseNumber} por usuario ${userId}`,
    );

    return this.matchSuggestionsService.applyMatchSuggestion(
      dto.transactionBankId,
      dto.voucherId,
      dto.houseNumber,
      userId,
      dto.adminNotes,
    );
  }

  @Post('match-suggestions/apply-batch')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Aplicar múltiples sugerencias de cross-matching',
    description:
      'Aplica un lote de sugerencias de cross-matching. Cada sugerencia se procesa individualmente ' +
      'para evitar que un error afecte a las demás.',
  })
  @ApiResponse({
    status: 200,
    description: 'Resultado del procesamiento batch',
    type: ApplyBatchResponseDto,
  })
  async applyBatchMatchSuggestions(
    @Body() dto: ApplyBatchMatchSuggestionsDto,
    @Req() req: any,
  ): Promise<ApplyBatchResponseDto> {
    const userId = req.user.id;

    this.logger.log(
      `Aplicando batch de ${dto.suggestions.length} cross-matches por usuario ${userId}`,
    );

    const results: { transactionBankId: string; voucherId: number; success: boolean; error?: string }[] = [];
    let totalApplied = 0;
    let totalFailed = 0;

    for (const suggestion of dto.suggestions) {
      try {
        await this.matchSuggestionsService.applyMatchSuggestion(
          suggestion.transactionBankId,
          suggestion.voucherId,
          suggestion.houseNumber,
          userId,
          suggestion.adminNotes,
        );
        results.push({
          transactionBankId: suggestion.transactionBankId,
          voucherId: suggestion.voucherId,
          success: true,
        });
        totalApplied++;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        this.logger.warn(
          `Batch cross-match falló para depósito ${suggestion.transactionBankId}: ${errorMessage}`,
        );
        results.push({
          transactionBankId: suggestion.transactionBankId,
          voucherId: suggestion.voucherId,
          success: false,
          error: errorMessage,
        });
        totalFailed++;
      }
    }

    this.logger.log(
      `Batch cross-match completado: ${totalApplied} aplicados, ${totalFailed} fallidos`,
    );

    return { totalApplied, totalFailed, results };
  }
}
