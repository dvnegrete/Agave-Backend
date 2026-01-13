import {
  Controller,
  Get,
  Post,
  Body,
  Param,
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
import {
  CreatePeriodUseCase,
  EnsurePeriodExistsUseCase,
  GetPeriodsUseCase,
  CreatePeriodConfigUseCase,
  AllocatePaymentUseCase,
  GetPaymentHistoryUseCase,
  GetHouseBalanceUseCase,
  GetHouseTransactionsUseCase,
  GetHouseUnreconciledVouchersUseCase,
} from '../application';
import {
  CreatePeriodDto,
  CreatePeriodConfigDto,
  PeriodResponseDto,
  PeriodConfigResponseDto,
  HouseBalanceDTO,
  HouseTransactionsResponseDto,
} from '../dto';
import { HouseRepository } from '@/shared/database/repositories/house.repository';

@ApiTags('Payment Management')
@Controller('payment-management')
export class PaymentManagementController {
  constructor(
    private readonly createPeriodUseCase: CreatePeriodUseCase,
    private readonly ensurePeriodExistsUseCase: EnsurePeriodExistsUseCase,
    private readonly getPeriodsUseCase: GetPeriodsUseCase,
    private readonly createPeriodConfigUseCase: CreatePeriodConfigUseCase,
    private readonly allocatePaymentUseCase: AllocatePaymentUseCase,
    private readonly getPaymentHistoryUseCase: GetPaymentHistoryUseCase,
    private readonly getHouseBalanceUseCase: GetHouseBalanceUseCase,
    private readonly getHouseTransactionsUseCase: GetHouseTransactionsUseCase,
    private readonly getHouseUnreconciledVouchersUseCase: GetHouseUnreconciledVouchersUseCase,
    private readonly houseRepository: HouseRepository,
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

  // TODO: Implementar endpoint para actualizar montos de un período específico
  // PATCH /payment-management/periods/:id/amounts
  // Body: UpdatePeriodAmountsDto

  // TODO: Implementar endpoint para obtener configuración activa
  // GET /payment-management/config/active?date=YYYY-MM-DD

  // TODO: Implementar endpoint para actualizar configuración
  // PATCH /payment-management/config/:id

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
