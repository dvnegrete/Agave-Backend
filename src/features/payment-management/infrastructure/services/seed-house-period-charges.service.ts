import { Injectable, Logger, Inject } from '@nestjs/common';
import { AllocationConceptType } from '@/shared/database/entities/enums';
import { Period, PeriodConfig, HousePeriodCharge, House } from '@/shared/database/entities';
import { IHousePeriodChargeRepository } from '../../interfaces/house-period-charge.repository.interface';
import { IHousePeriodOverrideRepository } from '../../interfaces/house-period-override.repository.interface';
import { IRecordAllocationRepository } from '../../interfaces/record-allocation.repository.interface';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { IPeriodRepository } from '../../interfaces/period.repository.interface';
import { IPeriodConfigRepository } from '../../interfaces/period-config.repository.interface';
import { HouseStatusSnapshotService } from './house-status-snapshot.service';

/**
 * Servicio para generar (seed) los cargos esperados de casas en un período.
 *
 * Comportamiento de penalidades:
 * - Las penalidades NO se agregan al período nuevo.
 * - Al crear un período nuevo, se revisan todos los períodos ANTERIORES vencidos.
 * - Si un período vencido tiene deuda sin pagar y aún no tiene cargo de penalidad,
 *   se le agrega la penalidad a ESE período (no al nuevo).
 * - Esto garantiza que la deuda de un período impago sea fija (mantenimiento + penalidad
 *   aplicada una sola vez) y no crezca mes a mes.
 */
@Injectable()
export class SeedHousePeriodChargesService {
  private readonly logger = new Logger(SeedHousePeriodChargesService.name);

  constructor(
    @Inject('IHousePeriodChargeRepository')
    private readonly chargeRepository: IHousePeriodChargeRepository,
    @Inject('IHousePeriodOverrideRepository')
    private readonly overrideRepository: IHousePeriodOverrideRepository,
    @Inject('IRecordAllocationRepository')
    private readonly allocationRepository: IRecordAllocationRepository,
    @Inject('IPeriodRepository')
    private readonly periodRepository: IPeriodRepository,
    @Inject('IPeriodConfigRepository')
    private readonly configRepository: IPeriodConfigRepository,
    private readonly houseRepository: HouseRepository,
    private readonly snapshotService: HouseStatusSnapshotService,
  ) {}

  /**
   * Genera cargos para todas las casas en un período nuevo y aplica penalidades
   * a los períodos anteriores que se encuentren vencidos e impagos.
   */
  async seedChargesForPeriod(periodId: number): Promise<void> {
    const period = await this.periodRepository.findById(periodId);
    if (!period) {
      throw new Error(`Period with ID ${periodId} not found`);
    }

    let config: PeriodConfig | null = null;
    if (period.period_config_id) {
      config = await this.configRepository.findById(period.period_config_id);
    }

    if (!config) {
      this.logger.warn(
        `No PeriodConfig found for period ${periodId}. Skipping seed.`,
      );
      return;
    }

    const houses = await this.houseRepository.findAll();
    if (houses.length === 0) {
      this.logger.warn('No houses found. Skipping seed.');
      return;
    }

    const overrides = await this.overrideRepository.findByPeriodId(periodId);
    const charges: Partial<HousePeriodCharge>[] = [];

    for (const house of houses) {
      // Cargo de MAINTENANCE (siempre presente)
      const maintenanceCharge = await this.resolveChargeAmount(
        house.id,
        period.id,
        AllocationConceptType.MAINTENANCE,
        config.default_maintenance_amount,
        overrides,
      );

      if (maintenanceCharge) {
        charges.push(maintenanceCharge);
      }

      // Cargo de WATER (si está activo en el período)
      if (period.water_active) {
        const waterCharge = await this.resolveChargeAmount(
          house.id,
          period.id,
          AllocationConceptType.WATER,
          config.default_water_amount || 0,
          overrides,
        );

        if (waterCharge) {
          charges.push(waterCharge);
        }
      }

      // Cargo de EXTRAORDINARY_FEE (si está activo en el período)
      if (period.extraordinary_fee_active) {
        const extraCharge = await this.resolveChargeAmount(
          house.id,
          period.id,
          AllocationConceptType.EXTRAORDINARY_FEE,
          config.default_extraordinary_fee_amount || 0,
          overrides,
        );

        if (extraCharge) {
          charges.push(extraCharge);
        }
      }

      // Las penalidades NO van al período nuevo.
      // Se aplican retroactivamente a los períodos vencidos e impagos (ver abajo).
    }

    if (charges.length > 0) {
      await this.chargeRepository.createBatch(charges);
      this.logger.log(
        `Seeded ${charges.length} charges for period ${periodId}`,
      );
    }

    // Al crear un nuevo período, aplicar penalidades a los períodos anteriores
    // vencidos que aún no tengan cargo de penalidad.
    await this.applyPenaltiesToOverduePreviousPeriods(houses, periodId);

    await this.snapshotService.invalidateAll();
  }

  /**
   * Revisa todos los períodos anteriores al período nuevo y aplica una penalidad
   * (en house_period_charges) a las casas que tengan deuda vencida sin penalidad previa.
   *
   * Regla: la penalidad se registra UNA sola vez en el período vencido.
   * No se acumula aunque pasen más meses sin pago.
   */
  private async applyPenaltiesToOverduePreviousPeriods(
    houses: House[],
    newPeriodId: number,
  ): Promise<void> {
    const allPeriods = await this.periodRepository.findAll();
    const now = new Date();

    const penaltyChargesToCreate: Partial<HousePeriodCharge>[] = [];

    for (const period of allPeriods) {
      // Solo períodos anteriores al nuevo
      if (period.id === newPeriodId) continue;

      const periodConfig = await this.configRepository.findActiveForDate(
        new Date(period.year, period.month - 1, 1),
      );
      if (!periodConfig) continue;

      const dueDate = new Date(
        period.year,
        period.month - 1,
        periodConfig.payment_due_day,
      );

      // Solo aplica penalidad si el período ya venció
      if (now <= dueDate) continue;

      // Obtener todos los cargos del período para todas las casas (una sola consulta)
      const periodCharges = await this.chargeRepository.findByPeriod(period.id);

      // Agrupar cargos por casa para acceso eficiente
      const chargesByHouse = new Map<number, HousePeriodCharge[]>();
      for (const charge of periodCharges) {
        const list = chargesByHouse.get(charge.house_id) ?? [];
        list.push(charge);
        chargesByHouse.set(charge.house_id, list);
      }

      for (const house of houses) {
        const houseCharges = chargesByHouse.get(house.id) ?? [];

        // Si ya tiene cargo de penalidad en este período, saltar
        if (
          houseCharges.some(
            (c) => c.concept_type === AllocationConceptType.PENALTIES,
          )
        ) {
          continue;
        }

        // Si no tiene cargos principales, no hay nada que penalizar
        const nonPenaltyCharges = houseCharges.filter(
          (c) => c.concept_type !== AllocationConceptType.PENALTIES,
        );
        if (nonPenaltyCharges.length === 0) continue;

        // Verificar si tiene deuda: expected > paid
        const totalExpected = nonPenaltyCharges.reduce(
          (sum, c) => sum + c.expected_amount,
          0,
        );
        const totalPaid =
          await this.allocationRepository.getTotalPaidByHousePeriod(
            house.id,
            period.id,
          );

        // Solo aplica penalidad si hay deuda sin pagar
        if (totalPaid >= totalExpected) continue;

        penaltyChargesToCreate.push({
          house_id: house.id,
          period_id: period.id,
          concept_type: AllocationConceptType.PENALTIES,
          expected_amount: periodConfig.late_payment_penalty_amount,
          source: 'auto_penalty',
        });
      }
    }

    if (penaltyChargesToCreate.length > 0) {
      this.logger.log(
        `Applying ${penaltyChargesToCreate.length} penalty charges to overdue periods`,
      );
      // createBatch ignora duplicados silenciosamente si la BD tiene unique index
      try {
        await this.chargeRepository.createBatch(penaltyChargesToCreate);
      } catch (e) {
        // Si hay conflicto de unique index (race condition), loguear y continuar
        this.logger.warn(
          `Some penalty charges already existed (race condition): ${e.message}`,
        );
      }
    }
  }

  /**
   * Resuelve el monto de un cargo considerando overrides
   */
  private async resolveChargeAmount(
    houseId: number,
    periodId: number,
    conceptType: AllocationConceptType,
    defaultAmount: number,
    overrides: any[],
  ): Promise<Partial<HousePeriodCharge> | null> {
    const override = overrides.find(
      (o) =>
        o.house_id === houseId &&
        o.period_id === periodId &&
        o.concept_type === conceptType,
    );

    const amount = override?.custom_amount ?? defaultAmount;

    if (amount <= 0) {
      return null;
    }

    return {
      house_id: houseId,
      period_id: periodId,
      concept_type: conceptType,
      expected_amount: amount,
      source: override ? 'override' : 'period_config',
    };
  }

  /**
   * Verifica si un período ya tiene charges (para evitar duplicados)
   */
  async hasCharges(periodId: number): Promise<boolean> {
    const charges = await this.chargeRepository.findByPeriod(periodId);
    return charges.length > 0;
  }
}
