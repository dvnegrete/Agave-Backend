import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Inject,
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
} from '../interfaces';
import { PeriodConfigRepository } from '../infrastructure/repositories/period-config.repository';
import { ApplyCreditToPeriodsUseCase } from './apply-credit-to-periods.use-case';

/**
 * Use case para asignar pagos a conceptos
 * Distribución de dinero a mantenimiento, agua, etc.
 */
@Injectable()
export class AllocatePaymentUseCase {
  constructor(
    @Inject('IRecordAllocationRepository')
    private readonly recordAllocationRepository: IRecordAllocationRepository,
    @Inject('IHouseBalanceRepository')
    private readonly houseBalanceRepository: IHouseBalanceRepository,
    @Inject('IHousePeriodOverrideRepository')
    private readonly housePeriodOverrideRepository: IHousePeriodOverrideRepository,
    @Inject('IPeriodRepository')
    private readonly periodRepository: IPeriodRepository,
    private readonly periodConfigRepository: PeriodConfigRepository,
    private readonly applyCreditToPeriodsUseCase: ApplyCreditToPeriodsUseCase,
  ) {}

  /**
   * Ejecuta la distribución de pagos
   */
  async execute(
    request: PaymentDistributionRequestDTO,
  ): Promise<PaymentDistributionResponseDTO> {
    // Validar entrada
    if (request.amount_to_distribute <= 0) {
      throw new BadRequestException('El monto debe ser mayor a 0');
    }

    // Obtener período (usar actual si no se especifica)
    const period = request.period_id
      ? await this.periodRepository.findById(request.period_id)
      : await this.getPeriodFromToday();

    if (!period) {
      throw new NotFoundException('No se encontró período válido');
    }

    // Obtener balance actual de la casa
    const currentBalance = await this.houseBalanceRepository.getOrCreate(
      request.house_id,
    );

    // Obtener configuración de período
    const periodConfig = await this.periodConfigRepository.findActiveForDate(
      new Date(),
    );

    if (!periodConfig) {
      throw new NotFoundException(
        'No hay configuración de período activa para hoy',
      );
    }

    // Preparar conceptos a pagar
    const concepts = await this.preparePaymentConcepts(
      request.house_id,
      period.id,
      periodConfig,
    );

    // Distribuir el pago
    const { allocations, amountRemaining } = await this.distributePayment(
      request.record_id,
      request.house_id,
      period.id,
      request.amount_to_distribute,
      concepts,
    );

    // Actualizar saldo de la casa
    const updatedBalance = await this.updateHouseBalance(
      request.house_id,
      currentBalance,
      amountRemaining,
    );

    // Convertir a DTOs
    const allocationDTOs = allocations.map((a) => this.toAllocationDTO(a));

    return {
      record_id: request.record_id,
      house_id: request.house_id,
      total_distributed: request.amount_to_distribute - amountRemaining,
      allocations: allocationDTOs,
      remaining_amount: amountRemaining,
      balance_after: {
        accumulated_cents: updatedBalance.accumulated_cents,
        credit_balance: updatedBalance.credit_balance,
        debit_balance: updatedBalance.debit_balance,
      },
    };
  }

  /**
   * Obtiene el período actual basado en la fecha de hoy
   */
  private async getPeriodFromToday(): Promise<any> {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // getMonth() retorna 0-11
    return this.periodRepository.findByYearAndMonth(year, month);
  }

  /**
   * Prepara la lista de conceptos con montos esperados
   */
  private async preparePaymentConcepts(
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

    // Mantenimiento
    const maintenanceAmount = await this.housePeriodOverrideRepository.getApplicableAmount(
      houseId,
      periodId,
      ConceptType.MAINTENANCE,
      periodConfig.default_maintenance_amount,
    );
    concepts.push({
      type: AllocationConceptType.MAINTENANCE,
      conceptId: 1, // Será actualizado según registro real
      expectedAmount: maintenanceAmount,
    });

    // Agua
    if (periodConfig.default_water_amount) {
      const waterAmount = await this.housePeriodOverrideRepository.getApplicableAmount(
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

    // Cuota extraordinaria
    if (periodConfig.default_extraordinary_fee_amount) {
      const extraordinaryFeeAmount = await this.housePeriodOverrideRepository.getApplicableAmount(
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
   * Distribuye el pago entre conceptos
   */
  private async distributePayment(
    recordId: number,
    houseId: number,
    periodId: number,
    amountToPay: number,
    concepts: Array<{
      type: AllocationConceptType;
      conceptId: number;
      expectedAmount: number;
    }>,
  ): Promise<{
    allocations: RecordAllocation[];
    amountRemaining: number;
  }> {
    const allocations: RecordAllocation[] = [];
    let amountRemaining = amountToPay;

    // Distribuir a cada concepto
    for (const concept of concepts) {
      if (amountRemaining <= 0) break;

      const allocatedAmount = Math.min(amountRemaining, concept.expectedAmount);
      const paymentStatus = this.calculatePaymentStatus(
        allocatedAmount,
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
      amountRemaining -= allocatedAmount;
    }

    return { allocations, amountRemaining };
  }

  /**
   * Calcula el estado del pago
   */
  private calculatePaymentStatus(
    allocated: number,
    expected: number,
  ): PaymentStatus {
    if (allocated >= expected) {
      return PaymentStatus.COMPLETE;
    }
    return PaymentStatus.PARTIAL;
  }

  /**
   * Actualiza el saldo de la casa con el monto restante
   */
  private async updateHouseBalance(
    houseId: number,
    currentBalance: any,
    amountRemaining: number,
  ): Promise<any> {
    if (amountRemaining <= 0) {
      return currentBalance;
    }

    // El monto restante se aplica así:
    // 1. Primero a deuda acumulada
    // 2. Luego a centavos acumulados
    // 3. Finalmente a crédito a favor

    let remaining = amountRemaining;

    // 1. Aplicar a deuda
    if (currentBalance.debit_balance > 0) {
      const debtPayment = Math.min(remaining, currentBalance.debit_balance);
      currentBalance.debit_balance -= debtPayment;
      remaining -= debtPayment;
    }

    // 2. Separar parte entera y centavos del restante
    if (remaining > 0) {
      const cents = remaining - Math.floor(remaining);
      const wholePart = Math.floor(remaining);

      if (cents > 0) {
        currentBalance.accumulated_cents += cents;
        // Si centavos acumulados >= 1, mover parte entera a crédito
        if (currentBalance.accumulated_cents >= 1) {
          const extraPesos = Math.floor(currentBalance.accumulated_cents);
          currentBalance.accumulated_cents -= extraPesos;
          currentBalance.credit_balance += extraPesos;
        }
      }

      // 3. Parte entera va a crédito
      if (wholePart > 0) {
        currentBalance.credit_balance += wholePart;
      }
    }

    const updatedBalance = await this.houseBalanceRepository.update(houseId, {
      accumulated_cents: Math.round(currentBalance.accumulated_cents * 100) / 100,
      credit_balance: Math.round(currentBalance.credit_balance * 100) / 100,
      debit_balance: Math.round(currentBalance.debit_balance * 100) / 100,
    });

    // 4. Si hay crédito, intentar aplicar a periodos impagos
    if (updatedBalance.credit_balance > 0) {
      try {
        await this.applyCreditToPeriodsUseCase.execute(houseId);
      } catch (error) {
        // Log pero no fallar la operación principal
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
