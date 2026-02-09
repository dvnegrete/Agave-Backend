import { Injectable, Inject, Logger } from '@nestjs/common';
import { House } from '@/shared/database/entities';
import {
  AllocationConceptType,
  ConceptType,
} from '@/shared/database/entities/enums';
import {
  IRecordAllocationRepository,
  IPeriodRepository,
  IPeriodConfigRepository,
  IHouseBalanceRepository,
  IHousePeriodOverrideRepository,
} from '../interfaces';
import { PaymentManagementConfig } from '../config/payment-management.config';
import { PaymentDistributionAnalyzerService } from '../infrastructure/matching/payment-distribution-analyzer.service';
import {
  PaymentDistributionResult,
  SuggestedAllocation,
  UnpaidPeriodInfo,
} from '../domain/payment-distribution.types';

@Injectable()
export class DistributePaymentWithAIUseCase {
  private readonly logger = new Logger(DistributePaymentWithAIUseCase.name);

  constructor(
    @Inject('IRecordAllocationRepository')
    private readonly recordAllocationRepository: IRecordAllocationRepository,
    @Inject('IPeriodRepository')
    private readonly periodRepository: IPeriodRepository,
    @Inject('IPeriodConfigRepository')
    private readonly periodConfigRepository: IPeriodConfigRepository,
    @Inject('IHouseBalanceRepository')
    private readonly houseBalanceRepository: IHouseBalanceRepository,
    @Inject('IHousePeriodOverrideRepository')
    private readonly housePeriodOverrideRepository: IHousePeriodOverrideRepository,
    private readonly distributionAnalyzer: PaymentDistributionAnalyzerService,
  ) {}

  async execute(
    houseId: number,
    house: House,
    amount: number,
  ): Promise<PaymentDistributionResult> {
    // 1. Obtener periodos impagos
    const unpaidPeriods = await this.getUnpaidPeriods(houseId);

    if (unpaidPeriods.length === 0) {
      // Todo pagado, el monto va a crédito
      return {
        method: 'deterministic',
        confidence: 'high',
        suggested_allocations: [],
        total_allocated: 0,
        remaining_as_credit: amount,
        reasoning: 'No hay periodos impagos. Monto completo va a credito.',
        requires_manual_review: false,
        auto_applied: false,
      };
    }

    // 2. Intento determinístico
    const deterministicResult = this.tryDeterministicDistribution(
      amount,
      unpaidPeriods,
    );
    if (deterministicResult) {
      return deterministicResult;
    }

    // 3. Fallback a AI
    const balance = await this.houseBalanceRepository.getOrCreate(houseId);
    const totalDebt = unpaidPeriods.reduce(
      (sum, p) => sum + p.pending_maintenance,
      0,
    );

    const aiResponse = await this.distributionAnalyzer.analyzeDistribution({
      amount,
      house_id: houseId,
      house_number: house.number_house,
      credit_balance: balance.credit_balance,
      unpaid_periods: unpaidPeriods,
      total_debt: totalDebt,
    });

    if (!aiResponse) {
      return {
        method: 'manual_review',
        confidence: 'none',
        suggested_allocations: [],
        total_allocated: 0,
        remaining_as_credit: amount,
        reasoning:
          'No se pudo determinar la distribución automáticamente. Requiere revisión manual.',
        requires_manual_review: true,
        auto_applied: false,
      };
    }

    // 4. Determinar si auto-aplicar basado en confianza
    const confidenceLevels = { high: 3, medium: 2, low: 1 };
    const thresholdLevels = { high: 3, medium: 2, low: 1 };
    const meetsThreshold =
      confidenceLevels[aiResponse.confidence] >=
      thresholdLevels[PaymentManagementConfig.AI_CONFIDENCE_THRESHOLD];

    return {
      method: 'ai',
      confidence: aiResponse.confidence,
      suggested_allocations: aiResponse.allocations,
      total_allocated: aiResponse.total_allocated,
      remaining_as_credit: aiResponse.remaining_as_credit,
      reasoning: aiResponse.reasoning,
      requires_manual_review: !meetsThreshold,
      auto_applied: false,
    };
  }

  private tryDeterministicDistribution(
    amount: number,
    unpaidPeriods: UnpaidPeriodInfo[],
  ): PaymentDistributionResult | null {
    // Verificar si el monto es múltiplo exacto del monto de mantenimiento
    const maintenanceAmount =
      PaymentManagementConfig.DEFAULT_MAINTENANCE_AMOUNT;

    // Caso 1: monto exacto de N periodos
    if (amount % maintenanceAmount === 0) {
      const numPeriods = amount / maintenanceAmount;
      const periodsToAllocate = unpaidPeriods.slice(
        0,
        Math.min(numPeriods, unpaidPeriods.length),
      );

      const allocations: SuggestedAllocation[] = periodsToAllocate.map((p) => ({
        period_id: p.period_id,
        concept_type: 'maintenance',
        amount: Math.min(maintenanceAmount, p.pending_maintenance),
        reasoning: `Pago exacto de mantenimiento para ${p.display_name}`,
      }));

      const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);

      return {
        method: 'deterministic',
        confidence: 'high',
        suggested_allocations: allocations,
        total_allocated: totalAllocated,
        remaining_as_credit: Math.round((amount - totalAllocated) * 100) / 100,
        reasoning: `Pago exacto para ${periodsToAllocate.length} periodo(s) de mantenimiento`,
        requires_manual_review: false,
        auto_applied: false,
      };
    }

    // Caso 2: monto cubre periodos completos + parcial
    // Solo si cubre al menos un periodo completo
    if (amount >= maintenanceAmount) {
      const fullPeriods = Math.floor(amount / maintenanceAmount);
      const remainder = Math.round((amount % maintenanceAmount) * 100) / 100;

      const periodsToAllocate = unpaidPeriods.slice(
        0,
        Math.min(fullPeriods + (remainder > 0 ? 1 : 0), unpaidPeriods.length),
      );

      const allocations: SuggestedAllocation[] = [];
      let remainingAmount = amount;

      for (const period of periodsToAllocate) {
        if (remainingAmount <= 0) break;
        const toAllocate = Math.min(
          remainingAmount,
          period.pending_maintenance,
        );
        allocations.push({
          period_id: period.period_id,
          concept_type: 'maintenance',
          amount: Math.round(toAllocate * 100) / 100,
          reasoning: `Mantenimiento ${period.display_name}`,
        });
        remainingAmount -= toAllocate;
      }

      const totalAllocated = allocations.reduce((sum, a) => sum + a.amount, 0);

      return {
        method: 'deterministic',
        confidence: 'high',
        suggested_allocations: allocations,
        total_allocated: Math.round(totalAllocated * 100) / 100,
        remaining_as_credit: Math.round((amount - totalAllocated) * 100) / 100,
        reasoning: `Distribución FIFO: ${allocations.length} periodo(s)`,
        requires_manual_review: false,
        auto_applied: false,
      };
    }

    // Caso 3: monto menor a un periodo - pago parcial al más antiguo
    if (amount > 0 && amount < maintenanceAmount && unpaidPeriods.length > 0) {
      const oldest = unpaidPeriods[0];
      return {
        method: 'deterministic',
        confidence: 'medium',
        suggested_allocations: [
          {
            period_id: oldest.period_id,
            concept_type: 'maintenance',
            amount: Math.min(amount, oldest.pending_maintenance),
            reasoning: `Pago parcial para ${oldest.display_name}`,
          },
        ],
        total_allocated: Math.min(amount, oldest.pending_maintenance),
        remaining_as_credit: Math.max(0, amount - oldest.pending_maintenance),
        reasoning: `Pago parcial aplicado al periodo mas antiguo: ${oldest.display_name}`,
        requires_manual_review: false,
        auto_applied: false,
      };
    }

    return null;
  }

  private async getUnpaidPeriods(houseId: number): Promise<UnpaidPeriodInfo[]> {
    const allPeriods = await this.periodRepository.findAll();
    const sortedPeriods = [...allPeriods].sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.month - b.month,
    );

    const unpaid: UnpaidPeriodInfo[] = [];
    const monthNames = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
    ];

    for (const period of sortedPeriods) {
      const periodStartDate =
        period.start_date instanceof Date
          ? period.start_date
          : new Date(period.start_date);
      const config =
        await this.periodConfigRepository.findActiveForDate(periodStartDate);
      if (!config) continue;

      const expectedMaintenance =
        await this.housePeriodOverrideRepository.getApplicableAmount(
          houseId,
          period.id,
          ConceptType.MAINTENANCE,
          config.default_maintenance_amount,
        );

      const allocations =
        await this.recordAllocationRepository.findByHouseAndPeriod(
          houseId,
          period.id,
        );

      const paidMaintenance = allocations
        .filter((a) => a.concept_type === AllocationConceptType.MAINTENANCE)
        .reduce((sum, a) => sum + a.allocated_amount, 0);

      const pendingMaintenance = Math.max(
        0,
        expectedMaintenance - paidMaintenance,
      );

      if (pendingMaintenance > 0) {
        unpaid.push({
          period_id: period.id,
          year: period.year,
          month: period.month,
          display_name: `${monthNames[period.month - 1]} ${period.year}`,
          expected_maintenance: expectedMaintenance,
          paid_maintenance: paidMaintenance,
          pending_maintenance: pendingMaintenance,
        });
      }

      if (
        unpaid.length >= PaymentManagementConfig.MAX_PERIODS_FOR_DISTRIBUTION
      ) {
        break;
      }
    }

    return unpaid;
  }
}
