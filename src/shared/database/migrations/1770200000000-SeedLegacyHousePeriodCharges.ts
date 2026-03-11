import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migración de datos: Inserta house_period_charges faltantes para periodos existentes.
 * Esto permite que la distribución FIFO funcione con periodos creados antes de Fase 2.
 *
 * Para cada periodo sin cargos:
 * - MAINTENANCE: siempre (desde period_config o house_period_overrides)
 * - WATER: si period.water_active = true
 * - EXTRAORDINARY_FEE: si period.extraordinary_fee_active = true
 * - PENALTIES: si existe en cta_penalties para esa casa+periodo
 */
export class SeedLegacyHousePeriodCharges1770200000000
  implements MigrationInterface
{
  name = 'SeedLegacyHousePeriodCharges1770200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Encontrar periodos que no tienen house_period_charges
    const periodsWithoutCharges: Array<{
      id: number;
      year: number;
      month: number;
      period_config_id: number | null;
      water_active: boolean;
      extraordinary_fee_active: boolean;
    }> = await queryRunner.query(`
      SELECT p.id, p.year, p.month, p.period_config_id,
             p.water_active, p.extraordinary_fee_active
      FROM periods p
      WHERE NOT EXISTS (
        SELECT 1 FROM house_period_charges hpc WHERE hpc.period_id = p.id
      )
      ORDER BY p.year ASC, p.month ASC
    `);

    if (periodsWithoutCharges.length === 0) {
      console.log(
        'Migration: All periods already have house_period_charges. Skipping.',
      );
      return;
    }

    console.log(
      `Migration: Found ${periodsWithoutCharges.length} periods without charges. Seeding...`,
    );

    // Obtener todas las casas
    const houses: Array<{ id: number; number_house: number }> =
      await queryRunner.query(
        `SELECT id, number_house FROM houses ORDER BY number_house ASC`,
      );

    if (houses.length === 0) {
      console.log('Migration: No houses found. Skipping.');
      return;
    }

    for (const period of periodsWithoutCharges) {
      // Obtener configuración del periodo
      let config: {
        default_maintenance_amount: number;
        default_water_amount: number | null;
        default_extraordinary_fee_amount: number | null;
      } | null = null;

      if (period.period_config_id) {
        const configs = await queryRunner.query(
          `SELECT default_maintenance_amount, default_water_amount, default_extraordinary_fee_amount
           FROM period_config WHERE id = $1`,
          [period.period_config_id],
        );
        if (configs.length > 0) config = configs[0];
      }

      // Fallback: buscar config activa para la fecha del periodo
      if (!config) {
        const startDate = `${period.year}-${String(period.month).padStart(2, '0')}-01`;
        const configs = await queryRunner.query(
          `SELECT default_maintenance_amount, default_water_amount, default_extraordinary_fee_amount
           FROM period_config
           WHERE is_active = true
             AND effective_from <= $1
             AND (effective_until IS NULL OR effective_until >= $1)
           ORDER BY effective_from DESC
           LIMIT 1`,
          [startDate],
        );
        if (configs.length > 0) config = configs[0];
      }

      // Fallback final: valores hardcodeados
      if (!config) {
        config = {
          default_maintenance_amount: 800,
          default_water_amount: 200,
          default_extraordinary_fee_amount: 1000,
        };
      }

      // Obtener penalidades para este periodo
      const penalties: Array<{ house_id: number; amount: number }> =
        await queryRunner.query(
          `SELECT house_id, amount FROM cta_penalties WHERE period_id = $1 AND house_id IS NOT NULL`,
          [period.id],
        );
      const penaltyMap = new Map<number, number>();
      for (const p of penalties) {
        penaltyMap.set(p.house_id, (penaltyMap.get(p.house_id) || 0) + p.amount);
      }

      // Obtener overrides para este periodo
      const overrides: Array<{
        house_id: number;
        concept_type: string;
        custom_amount: number;
      }> = await queryRunner.query(
        `SELECT house_id, concept_type, custom_amount
         FROM house_period_overrides
         WHERE period_id = $1`,
        [period.id],
      );
      const overrideMap = new Map<string, number>();
      for (const o of overrides) {
        overrideMap.set(`${o.house_id}_${o.concept_type}`, o.custom_amount);
      }

      // Insertar cargos para cada casa
      const values: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      for (const house of houses) {
        // MAINTENANCE (siempre)
        const maintenanceOverride = overrideMap.get(
          `${house.id}_maintenance`,
        );
        const maintenanceAmount =
          maintenanceOverride ?? config.default_maintenance_amount;
        values.push(
          `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`,
        );
        params.push(
          house.id,
          period.id,
          'maintenance',
          maintenanceAmount,
          maintenanceOverride ? 'override' : 'period_config',
        );

        // WATER (si activo)
        if (period.water_active && config.default_water_amount) {
          const waterOverride = overrideMap.get(`${house.id}_water`);
          const waterAmount = waterOverride ?? config.default_water_amount;
          values.push(
            `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`,
          );
          params.push(
            house.id,
            period.id,
            'water',
            waterAmount,
            waterOverride ? 'override' : 'period_config',
          );
        }

        // EXTRAORDINARY_FEE (si activo)
        if (
          period.extraordinary_fee_active &&
          config.default_extraordinary_fee_amount
        ) {
          const feeOverride = overrideMap.get(
            `${house.id}_extraordinary_fee`,
          );
          const feeAmount =
            feeOverride ?? config.default_extraordinary_fee_amount;
          values.push(
            `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`,
          );
          params.push(
            house.id,
            period.id,
            'extraordinary_fee',
            feeAmount,
            feeOverride ? 'override' : 'period_config',
          );
        }

        // PENALTIES (si existe para esta casa+periodo)
        const penaltyAmount = penaltyMap.get(house.id);
        if (penaltyAmount && penaltyAmount > 0) {
          values.push(
            `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`,
          );
          params.push(
            house.id,
            period.id,
            'penalties',
            penaltyAmount,
            'auto_penalty',
          );
        }
      }

      // Insertar en batches para evitar límites de parámetros
      if (values.length > 0) {
        // Batch insert con ON CONFLICT para idempotencia
        const batchSize = 500; // ~100 casas × 5 params = 500 params por batch
        for (let i = 0; i < values.length; i += batchSize) {
          const batchValues = values.slice(i, i + batchSize);
          // Recalcular params para este batch
          const paramsPerValue = 5;
          const startParam = i * paramsPerValue;
          const endParam = (i + batchSize) * paramsPerValue;
          const batchParams = params.slice(startParam, endParam);

          await queryRunner.query(
            `INSERT INTO house_period_charges (house_id, period_id, concept_type, expected_amount, source)
             VALUES ${batchValues.join(', ')}
             ON CONFLICT (house_id, period_id, concept_type) DO NOTHING`,
            batchParams,
          );
        }

        console.log(
          `Migration: Seeded ${values.length} charges for period ${period.year}-${String(period.month).padStart(2, '0')}`,
        );
      }
    }

    console.log('Migration: SeedLegacyHousePeriodCharges completed.');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // No eliminamos datos - la migración de seed es aditiva
    // Si se necesita revertir, se puede truncar manualmente
    console.log(
      'Migration: SeedLegacyHousePeriodCharges down - no action (data seed is additive).',
    );
  }
}
