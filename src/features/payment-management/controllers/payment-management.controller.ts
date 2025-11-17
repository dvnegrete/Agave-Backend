import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { House } from '@/shared/database/entities';
import {
  CreatePeriodUseCase,
  EnsurePeriodExistsUseCase,
  GetPeriodsUseCase,
  CreatePeriodConfigUseCase,
  AllocatePaymentUseCase,
  GetPaymentHistoryUseCase,
  GetHouseBalanceUseCase,
} from '../application';
import {
  CreatePeriodDto,
  CreatePeriodConfigDto,
  PeriodResponseDto,
  PeriodConfigResponseDto,
  PaymentHistoryResponseDTO,
  HouseBalanceDTO,
} from '../dto';

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
    @InjectRepository(House)
    private readonly houseRepository: Repository<House>,
  ) {}

  /**
   * GET /payment-management/periods
   * Obtiene todos los períodos
   */
  @Get('periods')
  async getPeriods(): Promise<PeriodResponseDto[]> {
    const periods = await this.getPeriodsUseCase.execute();

    return periods.map((period) => ({
      id: period.id,
      year: period.year,
      month: period.month,
      start_date: period.startDate,
      end_date: period.endDate,
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
  async createPeriod(
    @Body() dto: CreatePeriodDto,
  ): Promise<PeriodResponseDto> {
    const period = await this.createPeriodUseCase.execute(dto);

    return {
      id: period.id,
      year: period.year,
      month: period.month,
      start_date: period.startDate,
      end_date: period.endDate,
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
  async ensurePeriod(
    @Body() dto: CreatePeriodDto,
  ): Promise<PeriodResponseDto> {
    const period = await this.ensurePeriodExistsUseCase.execute(
      dto.year,
      dto.month,
    );

    return {
      id: period.id,
      year: period.year,
      month: period.month,
      start_date: period.startDate,
      end_date: period.endDate,
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
  async createConfig(
    @Body() dto: CreatePeriodConfigDto,
  ): Promise<PeriodConfigResponseDto> {
    const config = await this.createPeriodConfigUseCase.execute(dto);

    return {
      id: config.id,
      default_maintenance_amount: config.defaultMaintenanceAmount,
      default_water_amount: config.defaultWaterAmount ?? undefined,
      default_extraordinary_fee_amount: config.defaultExtraordinaryFeeAmount ?? undefined,
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
   * Obtiene el historial completo de pagos de una casa
   */
  @Get('houses/:houseId/payments')
  async getPaymentHistory(
    @Param('houseId', ParseIntPipe) houseId: number,
  ): Promise<PaymentHistoryResponseDTO> {
    const house = await this.houseRepository.findOne({
      where: { id: houseId },
    });

    if (!house) {
      throw new NotFoundException(`Casa con ID ${houseId} no encontrada`);
    }

    return this.getPaymentHistoryUseCase.execute(houseId, house);
  }

  /**
   * GET /payment-management/houses/:houseId/payments/:periodId
   * Obtiene pagos de una casa en un período específico
   */
  @Get('houses/:houseId/payments/:periodId')
  async getPaymentHistoryByPeriod(
    @Param('houseId', ParseIntPipe) houseId: number,
    @Param('periodId', ParseIntPipe) periodId: number,
  ): Promise<PaymentHistoryResponseDTO> {
    const house = await this.houseRepository.findOne({
      where: { id: houseId },
    });

    if (!house) {
      throw new NotFoundException(`Casa con ID ${houseId} no encontrada`);
    }

    return this.getPaymentHistoryUseCase.executeByPeriod(houseId, periodId, house);
  }

  /**
   * GET /payment-management/houses/:houseId/balance
   * Obtiene el saldo actual de una casa
   */
  @Get('houses/:houseId/balance')
  async getHouseBalance(
    @Param('houseId', ParseIntPipe) houseId: number,
  ): Promise<HouseBalanceDTO> {
    const house = await this.houseRepository.findOne({
      where: { id: houseId },
    });

    if (!house) {
      throw new NotFoundException(`Casa con ID ${houseId} no encontrada`);
    }

    return this.getHouseBalanceUseCase.execute(houseId, house);
  }
}
