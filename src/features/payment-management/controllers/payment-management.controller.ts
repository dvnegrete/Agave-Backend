import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  Inject,
  ParseIntPipe,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from '@/shared/auth/guards/auth.guard';
import { RoleGuard } from '@/shared/auth/guards/roles.guard';
import { HouseOwnershipGuard } from '@/shared/auth/guards/house-ownership.guard';
import { Roles } from '@/shared/auth/decorators/roles.decorator';
import { Role } from '@/shared/database/entities/enums';
import { formatMonthName } from '@/shared/common/utils/date';
import {
  CreatePeriodUseCase,
  EnsurePeriodExistsUseCase,
  GetPeriodsUseCase,
  CreatePeriodConfigUseCase,
  UpdatePeriodConfigUseCase,
  AllocatePaymentUseCase,
  GetPaymentHistoryUseCase,
  GetHouseBalanceUseCase,
  GetHouseTransactionsUseCase,
  GetHouseUnreconciledVouchersUseCase,
  CalculateHouseBalanceStatusUseCase,
  UpdatePeriodConceptsUseCase,
  DistributePaymentWithAIUseCase,
} from '../application';
import {
  CreatePeriodDto,
  CreatePeriodConfigDto,
  UpdatePeriodConfigDto,
  PeriodResponseDto,
  PeriodConfigResponseDto,
  HouseBalanceDTO,
  HouseTransactionsResponseDto,
  EnrichedHouseBalanceDto,
  HousesSummaryDto,
  UpdatePeriodConceptsDto,
  DistributePaymentRequestDto,
  ConfirmDistributionRequestDto,
} from '../dto';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { IPeriodConfigRepository } from '../interfaces';

@ApiTags('Payment Management')
@Controller('payment-management')
export class PaymentManagementController {
  constructor(
    private readonly createPeriodUseCase: CreatePeriodUseCase,
    private readonly ensurePeriodExistsUseCase: EnsurePeriodExistsUseCase,
    private readonly getPeriodsUseCase: GetPeriodsUseCase,
    private readonly createPeriodConfigUseCase: CreatePeriodConfigUseCase,
    private readonly updatePeriodConfigUseCase: UpdatePeriodConfigUseCase,
    private readonly allocatePaymentUseCase: AllocatePaymentUseCase,
    private readonly getPaymentHistoryUseCase: GetPaymentHistoryUseCase,
    private readonly getHouseBalanceUseCase: GetHouseBalanceUseCase,
    private readonly getHouseTransactionsUseCase: GetHouseTransactionsUseCase,
    private readonly getHouseUnreconciledVouchersUseCase: GetHouseUnreconciledVouchersUseCase,
    private readonly houseRepository: HouseRepository,
    @Inject('IPeriodConfigRepository')
    private readonly periodConfigRepository: IPeriodConfigRepository,
    private readonly calculateHouseBalanceStatusUseCase: CalculateHouseBalanceStatusUseCase,
    private readonly updatePeriodConceptsUseCase: UpdatePeriodConceptsUseCase,
    private readonly distributePaymentWithAIUseCase: DistributePaymentWithAIUseCase,
  ) {}

  /**
   * GET /payment-management/periods
   * Obtiene todos los períodos
   */
  @Get('periods')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Obtener todos los períodos',
    description:
      'Retorna una lista de todos los períodos de facturación registrados',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de períodos obtenida exitosamente',
    type: [PeriodResponseDto],
  })
  async getPeriods(): Promise<PeriodResponseDto[]> {
    const periods = await this.getPeriodsUseCase.execute();

    return periods.map((period) => ({
      id: period.id,
      year: period.year,
      month: period.month,
      start_date: this.formatDateToISO(period.startDate),
      end_date: this.formatDateToISO(period.endDate),
      period_config_id: period.periodConfigId,
      display_name: period.getDisplayName(),
      created_at: new Date(),
      updated_at: new Date(),
    }));
  }

  /**
   * POST /payment-management/periods
   * Crea un nuevo período manualmente
   */
  @Post('periods')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Crear nuevo período',
    description:
      'Crea un nuevo período de facturación con configuración especificada',
  })
  @ApiBody({ type: CreatePeriodDto })
  @ApiResponse({
    status: 201,
    description: 'Período creado exitosamente',
    type: PeriodResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Período ya existe o datos inválidos',
  })
  async createPeriod(@Body() dto: CreatePeriodDto): Promise<PeriodResponseDto> {
    const period = await this.createPeriodUseCase.execute(dto);

    return {
      id: period.id,
      year: period.year,
      month: period.month,
      start_date: this.formatDateToISO(period.startDate),
      end_date: this.formatDateToISO(period.endDate),
      period_config_id: period.periodConfigId,
      display_name: period.getDisplayName(),
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  /**
   * POST /payment-management/periods/ensure
   * Asegura que existe un período (crea si no existe)
   * Usado por el sistema de conciliación bancaria
   */
  @Post('periods/ensure')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Asegurar existencia de período',
    description:
      'Obtiene un período existente o lo crea automáticamente con configuración activa',
  })
  @ApiBody({ type: CreatePeriodDto })
  @ApiResponse({
    status: 200,
    description: 'Período obtenido o creado exitosamente',
    type: PeriodResponseDto,
  })
  async ensurePeriod(@Body() dto: CreatePeriodDto): Promise<PeriodResponseDto> {
    const period = await this.ensurePeriodExistsUseCase.execute(
      dto.year,
      dto.month,
    );

    return {
      id: period.id,
      year: period.year,
      month: period.month,
      start_date: this.formatDateToISO(period.startDate),
      end_date: this.formatDateToISO(period.endDate),
      period_config_id: period.periodConfigId,
      display_name: period.getDisplayName(),
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  /**
   * POST /payment-management/config
   * Crea una nueva configuración de período
   */
  @Post('config')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Crear configuración de período',
    description:
      'Crea una nueva configuración de montos default y reglas de pago',
  })
  @ApiBody({ type: CreatePeriodConfigDto })
  @ApiResponse({
    status: 201,
    description: 'Configuración creada exitosamente',
    type: PeriodConfigResponseDto,
  })
  async createConfig(
    @Body() dto: CreatePeriodConfigDto,
  ): Promise<PeriodConfigResponseDto> {
    const config = await this.createPeriodConfigUseCase.execute(dto);

    return {
      id: config.id,
      default_maintenance_amount: config.defaultMaintenanceAmount,
      default_water_amount: config.defaultWaterAmount ?? undefined,
      default_extraordinary_fee_amount:
        config.defaultExtraordinaryFeeAmount ?? undefined,
      payment_due_day: config.paymentDueDay,
      late_payment_penalty_amount: config.latePaymentPenaltyAmount,
      effective_from: config.effectiveFrom,
      effective_until: config.effectiveUntil ?? undefined,
      is_active: config.isActive,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  /**
   * GET /payment-management/config
   * Obtiene todas las configuraciones de período
   */
  @Get('config')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Listar configuraciones de período',
    description: 'Retorna todas las configuraciones de período ordenadas por fecha',
  })
  @ApiResponse({
    status: 200,
    description: 'Lista de configuraciones obtenida',
    type: [PeriodConfigResponseDto],
  })
  async getConfigs(): Promise<PeriodConfigResponseDto[]> {
    const configs = await this.periodConfigRepository.findAll();
    return configs.map((config) => ({
      id: config.id,
      default_maintenance_amount: config.default_maintenance_amount,
      default_water_amount: config.default_water_amount ?? undefined,
      default_extraordinary_fee_amount:
        config.default_extraordinary_fee_amount ?? undefined,
      payment_due_day: config.payment_due_day,
      late_payment_penalty_amount: config.late_payment_penalty_amount,
      effective_from: config.effective_from,
      effective_until: config.effective_until ?? undefined,
      is_active: config.is_active,
      created_at: config.created_at,
      updated_at: config.updated_at,
    }));
  }

  /**
   * GET /payment-management/config/active
   * Obtiene la configuración activa para una fecha dada
   */
  @Get('config/active')
  @UseGuards(AuthGuard)
  @ApiOperation({
    summary: 'Obtener configuración activa',
    description:
      'Retorna la configuración de período activa para la fecha especificada (o hoy si no se indica)',
  })
  @ApiResponse({
    status: 200,
    description: 'Configuración activa obtenida',
    type: PeriodConfigResponseDto,
  })
  @ApiResponse({ status: 404, description: 'No hay configuración activa' })
  async getActiveConfig(
    @Query('date') dateStr?: string,
  ): Promise<PeriodConfigResponseDto> {
    const date = dateStr ? new Date(dateStr) : new Date();
    const config = await this.periodConfigRepository.findActiveForDate(date);

    if (!config) {
      throw new NotFoundException(
        `No hay configuración activa para la fecha ${date.toISOString().split('T')[0]}`,
      );
    }

    return {
      id: config.id,
      default_maintenance_amount: config.default_maintenance_amount,
      default_water_amount: config.default_water_amount ?? undefined,
      default_extraordinary_fee_amount:
        config.default_extraordinary_fee_amount ?? undefined,
      payment_due_day: config.payment_due_day,
      late_payment_penalty_amount: config.late_payment_penalty_amount,
      effective_from: config.effective_from,
      effective_until: config.effective_until ?? undefined,
      is_active: config.is_active,
      created_at: config.created_at,
      updated_at: config.updated_at,
    };
  }

  /**
   * PATCH /payment-management/config/:id
   * Actualiza una configuración de período
   */
  @Patch('config/:id')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Actualizar configuración de período',
    description: 'Actualiza campos de una configuración existente',
  })
  @ApiParam({ name: 'id', description: 'ID de la configuración' })
  @ApiBody({ type: UpdatePeriodConfigDto })
  @ApiResponse({
    status: 200,
    description: 'Configuración actualizada',
    type: PeriodConfigResponseDto,
  })
  async updateConfig(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePeriodConfigDto,
  ): Promise<PeriodConfigResponseDto> {
    const config = await this.updatePeriodConfigUseCase.execute(id, dto);

    return {
      id: config.id,
      default_maintenance_amount: config.defaultMaintenanceAmount,
      default_water_amount: config.defaultWaterAmount ?? undefined,
      default_extraordinary_fee_amount:
        config.defaultExtraordinaryFeeAmount ?? undefined,
      payment_due_day: config.paymentDueDay,
      late_payment_penalty_amount: config.latePaymentPenaltyAmount,
      effective_from: config.effectiveFrom,
      effective_until: config.effectiveUntil ?? undefined,
      is_active: config.isActive,
      created_at: new Date(),
      updated_at: new Date(),
    };
  }

  /**
   * GET /payment-management/houses/:houseId/payments
   * Obtiene todas las transacciones bancarias asociadas a una casa
   * @param houseId número de casa (number_house)
   */
  @Get('houses/:houseId/payments')
  @UseGuards(AuthGuard, RoleGuard, HouseOwnershipGuard)
  @Roles(Role.ADMIN, Role.OWNER, Role.TENANT)
  @ApiOperation({
    summary: 'Obtener transacciones bancarias de una casa',
    description:
      'Retorna todas las transacciones bancarias confirmadas y pendientes asociadas a una casa (identificada por número de casa)',
  })
  @ApiParam({
    name: 'houseId',
    description: 'Número de casa (number_house)',
    example: 42,
  })
  @ApiResponse({
    status: 200,
    description: 'Transacciones bancarias obtenidas',
    type: HouseTransactionsResponseDto,
  })
  @ApiResponse({
    status: 404,
    description: 'Casa no encontrada',
  })
  async getPaymentHistory(
    @Param('houseId', ParseIntPipe) houseId: number,
  ): Promise<HouseTransactionsResponseDto> {
    const house = await this.houseRepository.findByNumberHouse(houseId);

    if (!house) {
      throw new NotFoundException(`Casa con número ${houseId} no encontrada`);
    }

    return this.getHouseTransactionsUseCase.execute(house);
  }

  // TODO: Endpoint para obtener pagos por período necesita ser redefinido
  // Actualmente este endpoint depende de RecordAllocations que tienen lógica incompleta de cta_*
  // Se recomienda:
  // 1. Mantener GET /houses/:houseId/payments para transacciones del banco (ya actualizado)
  // 2. Definir si se necesita filtrar por período y desde qué punto (banco vs allocations)
  // 3. Considerar usar métodos que filtren transacciones por rango de fecha

  /**
   * GET /payment-management/houses/:houseId/balance
   * Obtiene el saldo actual de una casa
   * @param houseId número de casa (number_house)
   */
  @Get('houses/:houseId/balance')
  @UseGuards(AuthGuard, RoleGuard, HouseOwnershipGuard)
  @Roles(Role.ADMIN, Role.OWNER, Role.TENANT)
  @ApiOperation({
    summary: 'Obtener saldo de casa',
    description:
      'Retorna el saldo actual (deuda, crédito, centavos acumulados) de una casa (identificada por número de casa)',
  })
  @ApiParam({
    name: 'houseId',
    description: 'Número de casa (number_house)',
    example: 42,
  })
  @ApiResponse({
    status: 200,
    description: 'Saldo de casa obtenido',
    type: HouseBalanceDTO,
  })
  @ApiResponse({
    status: 404,
    description: 'Casa no encontrada',
  })
  async getHouseBalance(
    @Param('houseId', ParseIntPipe) houseId: number,
  ): Promise<HouseBalanceDTO> {
    const house = await this.houseRepository.findByNumberHouse(houseId);

    if (!house) {
      throw new NotFoundException(`Casa con número ${houseId} no encontrada`);
    }

    return this.getHouseBalanceUseCase.execute(house.id, house);
  }

  /**
   * PATCH /payment-management/periods/:id/concepts
   * Activar/desactivar conceptos opcionales de un período
   */
  @Patch('periods/:id/concepts')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Activar/desactivar conceptos de un período',
    description:
      'Permite activar o desactivar agua y cuota extraordinaria para un período específico',
  })
  @ApiParam({ name: 'id', description: 'ID del período' })
  @ApiBody({ type: UpdatePeriodConceptsDto })
  @ApiResponse({
    status: 200,
    description: 'Conceptos actualizados',
    type: PeriodResponseDto,
  })
  async updatePeriodConcepts(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePeriodConceptsDto,
  ): Promise<PeriodResponseDto> {
    const period = await this.updatePeriodConceptsUseCase.execute(id, dto);

    return {
      id: period.id,
      year: period.year,
      month: period.month,
      start_date: this.formatDateToISO(period.start_date),
      end_date: this.formatDateToISO(period.end_date),
      period_config_id: period.period_config_id,
      display_name: formatMonthName(period.month, period.year),
      created_at: period.created_at,
      updated_at: period.updated_at,
    };
  }

  /**
   * GET /payment-management/houses/:houseId/status
   * Obtiene el estado enriquecido de una casa (balance + periodos + morosidad)
   */
  @Get('houses/:houseId/status')
  @UseGuards(AuthGuard, RoleGuard, HouseOwnershipGuard)
  @Roles(Role.ADMIN, Role.OWNER, Role.TENANT)
  @ApiOperation({
    summary: 'Obtener estado enriquecido de casa',
    description:
      'Retorna estado completo: clasificación (morosa/al_dia/saldo_a_favor), desglose por periodo, deuda total',
  })
  @ApiParam({
    name: 'houseId',
    description: 'Número de casa (number_house)',
    example: 42,
  })
  @ApiResponse({
    status: 200,
    description: 'Estado enriquecido obtenido',
    type: EnrichedHouseBalanceDto,
  })
  @ApiResponse({ status: 404, description: 'Casa no encontrada' })
  async getHouseStatus(
    @Param('houseId', ParseIntPipe) houseId: number,
  ): Promise<EnrichedHouseBalanceDto> {
    const house = await this.houseRepository.findByNumberHouse(houseId);

    if (!house) {
      throw new NotFoundException(`Casa con número ${houseId} no encontrada`);
    }

    return this.calculateHouseBalanceStatusUseCase.execute(
      house.id,
      house,
    ) as Promise<EnrichedHouseBalanceDto>;
  }

  /**
   * GET /payment-management/summary
   * Resumen de todas las casas (ADMIN only)
   */
  @Get('summary')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Resumen de estado de todas las casas',
    description:
      'Retorna resumen general: casas morosas, al día, con saldo a favor, deuda/crédito total',
  })
  @ApiResponse({
    status: 200,
    description: 'Resumen obtenido',
    type: HousesSummaryDto,
  })
  async getSummary(): Promise<HousesSummaryDto> {
    const houses = await this.houseRepository.findAll();
    const results: EnrichedHouseBalanceDto[] = [];

    for (const house of houses) {
      const status = await this.calculateHouseBalanceStatusUseCase.execute(
        house.id,
        house,
      );
      results.push(status as EnrichedHouseBalanceDto);
    }

    const morosas = results.filter((r) => r.status === 'morosa').length;
    const alDia = results.filter((r) => r.status === 'al_dia').length;
    const saldoAFavor = results.filter(
      (r) => r.status === 'saldo_a_favor',
    ).length;

    return {
      total_houses: results.length,
      morosas,
      al_dia: alDia,
      saldo_a_favor: saldoAFavor,
      total_debt: results.reduce((sum, r) => sum + r.total_debt, 0),
      total_credit: results.reduce((sum, r) => sum + r.credit_balance, 0),
      houses: results,
    };
  }

  /**
   * POST /payment-management/houses/:houseId/distribute-payment
   * Analiza y sugiere distribución de un pago (determinístico o AI)
   */
  @Post('houses/:houseId/distribute-payment')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Distribuir pago con AI',
    description:
      'Analiza un pago y sugiere cómo distribuirlo entre periodos impagos. Usa lógica determinística primero, luego AI.',
  })
  @ApiParam({
    name: 'houseId',
    description: 'Número de casa (number_house)',
    example: 42,
  })
  @ApiBody({ type: DistributePaymentRequestDto })
  async distributePayment(
    @Param('houseId', ParseIntPipe) houseId: number,
    @Body() dto: DistributePaymentRequestDto,
  ) {
    const house = await this.houseRepository.findByNumberHouse(houseId);
    if (!house) {
      throw new NotFoundException(`Casa con número ${houseId} no encontrada`);
    }

    return this.distributePaymentWithAIUseCase.execute(
      house.id,
      house,
      dto.amount,
    );
  }

  /**
   * POST /payment-management/houses/:houseId/confirm-distribution
   * Confirma y aplica una distribución sugerida
   */
  @Post('houses/:houseId/confirm-distribution')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Confirmar distribución de pago',
    description:
      'Aplica una distribución de pago previamente sugerida por el sistema AI',
  })
  @ApiParam({
    name: 'houseId',
    description: 'Número de casa (number_house)',
    example: 42,
  })
  @ApiBody({ type: ConfirmDistributionRequestDto })
  async confirmDistribution(
    @Param('houseId', ParseIntPipe) houseId: number,
    @Body() dto: ConfirmDistributionRequestDto,
  ) {
    const house = await this.houseRepository.findByNumberHouse(houseId);
    if (!house) {
      throw new NotFoundException(`Casa con número ${houseId} no encontrada`);
    }

    // Aplicar cada allocation confirmada
    const results: any[] = [];
    for (const allocation of dto.allocations) {
      const result = await this.allocatePaymentUseCase.execute({
        record_id: dto.record_id ?? 0,
        house_id: house.id,
        amount_to_distribute: allocation.amount,
        period_id: allocation.period_id,
      });
      results.push(result);
    }

    return {
      house_id: house.id,
      house_number: house.number_house,
      allocations_applied: results.length,
      results,
    };
  }

  /**
   * Formatea una fecha (Date o string) a ISO 8601 format
   * Si recibe un string tipo 'YYYY-MM-DD', lo convierte a 'YYYY-MM-DDTHH:MM:SS.000Z'
   * Si recibe un Date, usa toISOString()
   */
  private formatDateToISO(date: Date | string): string {
    if (typeof date === 'string') {
      // Si es un string 'YYYY-MM-DD', convertir a ISO completo
      return new Date(date + 'T00:00:00Z').toISOString();
    }
    // Si es un Date object, usar toISOString directamente
    return date.toISOString();
  }
}
