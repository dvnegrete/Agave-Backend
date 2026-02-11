import { Injectable, Logger, Inject } from '@nestjs/common';
import { AllocationConceptType } from '@/shared/database/entities/enums';
import { Period, PeriodConfig, HousePeriodCharge } from '@/shared/database/entities';
import { IHousePeriodChargeRepository } from '../../interfaces/house-period-charge.repository.interface';
import { IHousePeriodOverrideRepository } from '../../interfaces/house-period-override.repository.interface';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { IPeriodRepository } from '../../interfaces/period.repository.interface';
import { IPeriodConfigRepository } from '../../interfaces/period-config.repository.interface';

/**
 * Servicio para generar (seed) los cargos esperados de casas en un período
 * Resuelve montos desde PeriodConfig + HousePeriodOverride
 * Respeta los flags water_active y extraordinary_fee_active
 * Realiza batch insert para eficiencia
 */
@Injectable()
export class SeedHousePeriodChargesService {
  private readonly logger = new Logger(SeedHousePeriodChargesService.name);

  constructor(
    @Inject('IHousePeriodChargeRepository')
    private readonly chargeRepository: IHousePeriodChargeRepository,
    @Inject('IHousePeriodOverrideRepository')
    private readonly overrideRepository: IHousePeriodOverrideRepository,
    @Inject('IPeriodRepository')
    private readonly periodRepository: IPeriodRepository,
    @Inject('IPeriodConfigRepository')
    private readonly configRepository: IPeriodConfigRepository,
    private readonly houseRepository: HouseRepository,
  ) {}

  /**
   * Genera cargos para todas las casas en un período
   * @param periodId ID del período para el cual generar cargos
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

    // Obtener todas las casas
    const houses = await this.houseRepository.findAll();
    if (houses.length === 0) {
      this.logger.warn('No houses found. Skipping seed.');
      return;
    }

    // Obtener overrides para este período
    const overrides = await this.overrideRepository.findByPeriodId(periodId);

    // Preparar charges para batch insert
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
    }

    // Batch insert
    if (charges.length > 0) {
      await this.chargeRepository.createBatch(charges);
      this.logger.log(
        `Seeded ${charges.length} charges for period ${periodId}`,
      );
    }
  }

  /**
   * Resuelve el monto de un cargo considerando overrides
   * Retorna el cargo a crear, o null si no se debe crear
   * @private
   */
  private async resolveChargeAmount(
    houseId: number,
    periodId: number,
    conceptType: AllocationConceptType,
    defaultAmount: number,
    overrides: any[],
  ): Promise<Partial<HousePeriodCharge> | null> {
    // Buscar override específico para esta casa/período/concepto
    const override = overrides.find(
      (o) =>
        o.house_id === houseId &&
        o.period_id === periodId &&
        o.concept_type === conceptType,
    );

    const amount = override?.custom_amount ?? defaultAmount;

    // No crear cargo si el monto es 0 o negativo
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
   * Útil para implementar idempotencia
   */
  async hasCharges(periodId: number): Promise<boolean> {
    const charges = await this.chargeRepository.findByPeriod(periodId);
    return charges.length > 0;
  }
}
