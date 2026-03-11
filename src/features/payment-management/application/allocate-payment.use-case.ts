import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
  Logger,
} from '@nestjs/common';
import { RecordAllocation } from '@/shared/database/entities';
import {
  AllocationConceptType,
  ConceptType,
  PaymentStatus,
} from '@/shared/database/entities/enums';
import {
  PaymentDistributionRequestDTO,
  PaymentDistributionResponseDTO,
  PaymentAllocationDTO,
} from '../dto';
import {
  IRecordAllocationRepository,
  IHouseBalanceRepository,
  IHousePeriodOverrideRepository,
  IPeriodRepository,
  IHousePeriodChargeRepository,
} from '../interfaces';
import { PeriodConfigRepository } from '../infrastructure/repositories/period-config.repository';
import { ApplyCreditToPeriodsUseCase } from './apply-credit-to-periods.use-case';
import { HouseStatusSnapshotService } from '../infrastructure/services/house-status-snapshot.service';

/**
 * Use case para asignar pagos a conceptos con distribución FIFO.
 *
 * Modos de operación:
 * - Sin period_id: distribución FIFO automática (periodos más antiguos primero)
 * - Con period_id: distribución manual a un periodo específico
 *
 * En ambos casos verifica allocaciones existentes para evitar sobre-asignación.
 */
@Injectable()
export class AllocatePaymentUseCase {
  private readonly logger = new Logger(AllocatePaymentUseCase.name);

  constructor(
    @Inject('IRecordAllocationRepository')
    private readonly recordAllocationRepository: IRecordAllocationRepository,
    @Inject('IHouseBalanceRepository')
    private readonly houseBalanceRepository: IHouseBalanceRepository,
    @Inject('IHousePeriodOverrideRepository')
    private readonly housePeriodOverrideRepository: IHousePeriodOverrideRepository,
    @Inject('IPeriodRepository')
    private readonly periodRepository: IPeriodRepository,
    @Inject('IHousePeriodChargeRepository')
    private readonly housePeriodChargeRepository: IHousePeriodChargeRepository,
    private readonly periodConfigRepository: PeriodConfigRepository,
    private readonly applyCreditToPeriodsUseCase: ApplyCreditToPeriodsUseCase,
    private readonly snapshotService: HouseStatusSnapshotService,
  ) {}

  /**
   * Ejecuta la distribución de pagos
   */
  async execute(
    request: PaymentDistributionRequestDTO,
  ): Promise<PaymentDistributionResponseDTO> {
    if (request.amount_to_distribute <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0');
    }

    const currentBalance = await this.houseBalanceRepository.getOrCreate(
      request.house_id,
    );

    const periodConfig = await this.periodConfigRepository.findActiveForDate(
      new Date(),
    );

    if (!periodConfig) {
      throw new NotFoundException(
        'No hay configuración de período activa para hoy',
      );
    }

    // Separar centavos de la parte entera
    const totalAmount = request.amount_to_distribute;
    const cents = Math.round((totalAmount - Math.floor(totalAmount)) * 100) / 100;
    const integerAmount = Math.floor(totalAmount);

    let allocations: RecordAllocation[];
    let integerRemaining: number;

    if (request.period_id) {
      // Modo manual: asignar a un periodo específico
      const result = await this.allocateToSinglePeriod(
        request.record_id,
        request.house_id,
        request.period_id,
        integerAmount,
        periodConfig,
      );
      allocations = result.allocations;
      integerRemaining = result.amountRemaining;
    } else if (request.transaction_date) {
      // Modo period-aware: primero cubre el periodo de la fecha, luego FIFO hacia atrás
      const result = await this.allocatePeriodAware(
        request.record_id,
        request.house_id,
        integerAmount,
        periodConfig,
        request.transaction_date,
      );
      allocations = result.allocations;
      integerRemaining = result.amountRemaining;
    } else {
      // Modo FIFO: distribuir automáticamente
      const result = await this.allocateFIFO(
        request.record_id,
        request.house_id,
        integerAmount,
        periodConfig,
      );
      allocations = result.allocations;
      integerRemaining = result.amountRemaining;
    }

    // Actualizar saldo de la casa
    const updatedBalance = await this.updateHouseBalance(
      request.house_id,
      currentBalance,
      integerRemaining,
      cents,
      periodConfig.cents_credit_threshold,
    );

    const allocationDTOs = allocations.map((a) => this.toAllocationDTO(a));

    const result = {
      record_id: request.record_id,
      house_id: request.house_id,
      total_distributed: totalAmount - integerRemaining - cents,
      allocations: allocationDTOs,
      remaining_amount: integerRemaining,
      balance_after: {
        accumulated_cents: updatedBalance.accumulated_cents,
        credit_balance: updatedBalance.credit_balance,
        debit_balance: updatedBalance.debit_balance,
      },
    };

    // Invalidar snapshot de la casa
    await this.snapshotService.invalidateByHouseId(request.house_id);

    return result;
  }

  /**
   * Distribución FIFO: asigna pagos a periodos en orden cronológico (más antiguos primero).
   * Para cada periodo verifica allocaciones existentes antes de asignar.
   */
  private async allocateFIFO(
    recordId: number,
    houseId: number,
    amount: number,
    periodConfig: any,
  ): Promise<{
    allocations: RecordAllocation[];
    amountRemaining: number;
  }> {
    const allPeriods = await this.periodRepository.findAll();
    const sortedPeriods = [...allPeriods].sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month,
    );

    const allocations: RecordAllocation[] = [];
    let amountRemaining = amount;

    for (const period of sortedPeriods) {
      if (amountRemaining <= 0) break;

      const periodAllocations = await this.allocateToCharges(
        recordId,
        houseId,
        period.id,
        amountRemaining,
        periodConfig,
      );

      allocations.push(...periodAllocations.allocations);
      amountRemaining = periodAllocations.amountRemaining;
    }

    return { allocations, amountRemaining };
  }

  /**
   * Distribución period-aware: primero cubre los cargos del período correspondiente
   * a la fecha de la transacción, luego aplica FIFO hacia períodos anteriores con deuda.
   * Si no existe período para esa fecha, hace fallback a FIFO puro.
   */
  private async allocatePeriodAware(
    recordId: number,
    houseId: number,
    amount: number,
    periodConfig: any,
    txDate: Date,
  ): Promise<{
    allocations: RecordAllocation[];
    amountRemaining: number;
  }> {
    const txYear = txDate.getFullYear();
    const txMonth = txDate.getMonth() + 1;

    const currentPeriod = await this.periodRepository.findByYearAndMonth(
      txYear,
      txMonth,
    );

    // Fallback graceful: si no existe período para la fecha, usar FIFO puro
    if (!currentPeriod) {
      this.logger.warn(
        `No se encontró período para ${txYear}-${txMonth}. Fallback a FIFO puro.`,
      );
      return this.allocateFIFO(recordId, houseId, amount, periodConfig);
    }

    const allocations: RecordAllocation[] = [];

    // 1. Asignar al período corriente
    const currentResult = await this.allocateToCharges(
      recordId,
      houseId,
      currentPeriod.id,
      amount,
      periodConfig,
    );
    allocations.push(...currentResult.allocations);
    let remaining = currentResult.amountRemaining;

    // 2. Con el sobrante, FIFO hacia períodos anteriores
    if (remaining > 0) {
      const allPeriods = await this.periodRepository.findAll();
      const priorPeriods = allPeriods
        .filter(
          (p) =>
            p.year < txYear || (p.year === txYear && p.month < txMonth),
        )
        .sort((a, b) =>
          a.year !== b.year ? a.year - b.year : a.month - b.month,
        );

      for (const period of priorPeriods) {
        if (remaining <= 0) break;
        const r = await this.allocateToCharges(
          recordId,
          houseId,
          period.id,
          remaining,
          periodConfig,
        );
        allocations.push(...r.allocations);
        remaining = r.amountRemaining;
      }
    }

    return { allocations, amountRemaining: remaining };
  }

  /**
   * Asigna a un periodo específico, verificando allocaciones existentes.
   */
  private async allocateToSinglePeriod(
    recordId: number,
    houseId: number,
    periodId: number,
    amount: number,
    periodConfig: any,
  ): Promise<{
    allocations: RecordAllocation[];
    amountRemaining: number;
  }> {
    const period = await this.periodRepository.findById(periodId);
    if (!period) {
      throw new NotFoundException('No se encontró período válido');
    }

    return this.allocateToCharges(
      recordId,
      houseId,
      periodId,
      amount,
      periodConfig,
    );
  }

  /**
   * Lógica core: asigna un monto a los cargos de una casa en un periodo específico.
   * Verifica allocaciones existentes para evitar sobre-asignación.
   * Orden de conceptos: MAINTENANCE → WATER → EXTRAORDINARY_FEE → PENALTIES
   */
  private async allocateToCharges(
    recordId: number,
    houseId: number,
    periodId: number,
    amount: number,
    periodConfig: any,
  ): Promise<{
    allocations: RecordAllocation[];
    amountRemaining: number;
  }> {
    // Obtener cargos esperados para esta casa+periodo
    const charges = await this.housePeriodChargeRepository.findByHouseAndPeriod(
      houseId,
      periodId,
    );

    // Si no hay cargos, usar fallback legacy
    const concepts =
      charges.length > 0
        ? charges.map((charge) => ({
            type: charge.concept_type as AllocationConceptType,
            conceptId: 0,
            expectedAmount: charge.expected_amount,
          }))
        : await this.preparePaymentConceptsLegacy(
            houseId,
            periodId,
            periodConfig,
          );

    // Ordenar conceptos en orden de prioridad
    const conceptOrder: AllocationConceptType[] = [
      AllocationConceptType.MAINTENANCE,
      AllocationConceptType.WATER,
      AllocationConceptType.EXTRAORDINARY_FEE,
      AllocationConceptType.PENALTIES,
    ];
    concepts.sort((a, b) => {
      const idxA = conceptOrder.indexOf(a.type);
      const idxB = conceptOrder.indexOf(b.type);
      return (idxA === -1 ? 99 : idxA) - (idxB === -1 ? 99 : idxB);
    });

    // Obtener allocaciones existentes para esta casa+periodo
    const existingAllocations =
      await this.recordAllocationRepository.findByHouseAndPeriod(
        houseId,
        periodId,
      );

    const allocations: RecordAllocation[] = [];
    let amountRemaining = amount;

    for (const concept of concepts) {
      if (amountRemaining <= 0) break;

      // Calcular lo ya pagado para este concepto
      const alreadyPaid = existingAllocations
        .filter((a) => a.concept_type === concept.type)
        .reduce((sum, a) => sum + a.allocated_amount, 0);

      const remaining = Math.max(
        0,
        Math.round((concept.expectedAmount - alreadyPaid) * 100) / 100,
      );

      if (remaining <= 0) continue;

      const allocatedAmount = Math.min(amountRemaining, remaining);
      const totalPaidAfter = alreadyPaid + allocatedAmount;
      const paymentStatus = this.calculatePaymentStatus(
        totalPaidAfter,
        concept.expectedAmount,
      );

      const allocation = await this.recordAllocationRepository.create({
        record_id: recordId,
        house_id: houseId,
        period_id: periodId,
        concept_type: concept.type,
        concept_id: concept.conceptId,
        allocated_amount: allocatedAmount,
        expected_amount: concept.expectedAmount,
        payment_status: paymentStatus,
      });

      allocations.push(allocation);
      amountRemaining = Math.round((amountRemaining - allocatedAmount) * 100) / 100;
    }

    return { allocations, amountRemaining };
  }

  /**
   * Método legacy para retrocompatibilidad.
   * Se usa si no hay cargos en house_period_charges (periodos creados antes de Fase 2).
   */
  private async preparePaymentConceptsLegacy(
    houseId: number,
    periodId: number,
    periodConfig: any,
  ): Promise<
    Array<{
      type: AllocationConceptType;
      conceptId: number;
      expectedAmount: number;
    }>
  > {
    const concepts: Array<{
      type: AllocationConceptType;
      conceptId: number;
      expectedAmount: number;
    }> = [];

    const maintenanceAmount =
      await this.housePeriodOverrideRepository.getApplicableAmount(
        houseId,
        periodId,
        ConceptType.MAINTENANCE,
        periodConfig.default_maintenance_amount,
      );
    concepts.push({
      type: AllocationConceptType.MAINTENANCE,
      conceptId: 1,
      expectedAmount: maintenanceAmount,
    });

    if (periodConfig.default_water_amount) {
      const waterAmount =
        await this.housePeriodOverrideRepository.getApplicableAmount(
          houseId,
          periodId,
          ConceptType.WATER,
          periodConfig.default_water_amount,
        );
      concepts.push({
        type: AllocationConceptType.WATER,
        conceptId: 2,
        expectedAmount: waterAmount,
      });
    }

    if (periodConfig.default_extraordinary_fee_amount) {
      const extraordinaryFeeAmount =
        await this.housePeriodOverrideRepository.getApplicableAmount(
          houseId,
          periodId,
          ConceptType.EXTRAORDINARY_FEE,
          periodConfig.default_extraordinary_fee_amount,
        );
      concepts.push({
        type: AllocationConceptType.EXTRAORDINARY_FEE,
        conceptId: 3,
        expectedAmount: extraordinaryFeeAmount,
      });
    }

    return concepts;
  }

  /**
   * Calcula el estado del pago
   */
  private calculatePaymentStatus(
    totalPaid: number,
    expected: number,
  ): PaymentStatus {
    const roundedPaid = Math.round(totalPaid * 100) / 100;
    const roundedExpected = Math.round(expected * 100) / 100;

    if (roundedPaid >= roundedExpected) {
      return PaymentStatus.COMPLETE;
    }
    return PaymentStatus.PARTIAL;
  }

  /**
   * Actualiza el saldo de la casa con el monto restante y centavos.
   *
   * Flujo:
   * 1. integerRemaining → pagar debit_balance primero, sobrante → credit_balance
   * 2. cents → accumulated_cents, convertir a crédito si alcanza threshold
   * 3. Si hay crédito, intentar aplicar a periodos impagos
   */
  private async updateHouseBalance(
    houseId: number,
    currentBalance: any,
    integerRemaining: number,
    cents: number,
    centsCreditThreshold: number,
  ): Promise<any> {
    let remaining = integerRemaining;

    // 1. Aplicar a deuda
    if (remaining > 0 && currentBalance.debit_balance > 0) {
      const debtPayment = Math.min(remaining, currentBalance.debit_balance);
      currentBalance.debit_balance -= debtPayment;
      remaining -= debtPayment;
    }

    // 2. Sobrante entero va a crédito
    if (remaining > 0) {
      currentBalance.credit_balance += remaining;
    }

    // 3. Centavos van a accumulated_cents
    if (cents > 0) {
      currentBalance.accumulated_cents += cents;
    }

    // 4. Convertir centavos a crédito si alcanzan threshold
    while (currentBalance.accumulated_cents >= centsCreditThreshold) {
      currentBalance.credit_balance += centsCreditThreshold;
      currentBalance.accumulated_cents -= centsCreditThreshold;
    }

    const updatedBalance = await this.houseBalanceRepository.update(houseId, {
      accumulated_cents:
        Math.round(currentBalance.accumulated_cents * 100) / 100,
      credit_balance: Math.round(currentBalance.credit_balance * 100) / 100,
      debit_balance: Math.round(currentBalance.debit_balance * 100) / 100,
    });

    // 5. Si hay crédito, intentar aplicar a periodos impagos
    if (updatedBalance.credit_balance > 0) {
      try {
        await this.applyCreditToPeriodsUseCase.execute(houseId);
      } catch (error) {
        this.logger.warn(
          `Error aplicando crédito para casa ${houseId}: ${error instanceof Error ? error.message : 'Unknown'}`,
        );
      }
    }

    return updatedBalance;
  }

  /**
   * Convierte RecordAllocation a DTO
   */
  private toAllocationDTO(allocation: RecordAllocation): PaymentAllocationDTO {
    return {
      id: allocation.id,
      record_id: allocation.record_id,
      house_id: allocation.house_id,
      period_id: allocation.period_id,
      concept_type: allocation.concept_type,
      concept_id: allocation.concept_id,
      allocated_amount: allocation.allocated_amount,
      expected_amount: allocation.expected_amount,
      payment_status: allocation.payment_status,
      created_at: allocation.created_at,
    };
  }
}
