import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { PeriodChargeSummaryDto } from '../dto';
import { formatMonthName } from '@/shared/common/utils/date/month-formatter.util';

@Injectable()
export class GetPeriodChargesSummaryUseCase {
  private readonly logger = new Logger(GetPeriodChargesSummaryUseCase.name);

  constructor(private readonly dataSource: DataSource) {}

  async execute(): Promise<PeriodChargeSummaryDto[]> {
    const rows = await this.dataSource.query(`
      SELECT
        p.id AS period_id,
        p.year,
        p.month,
        p.water_active,
        p.extraordinary_fee_active,
        MAX(CASE WHEN hpc.concept_type = 'maintenance' THEN hpc.expected_amount END) AS maintenance_amount,
        MAX(CASE WHEN hpc.concept_type = 'water' THEN hpc.expected_amount END) AS water_amount,
        MAX(CASE WHEN hpc.concept_type = 'extraordinary_fee' THEN hpc.expected_amount END) AS extraordinary_fee_amount,
        EXISTS(SELECT 1 FROM record_allocations ra WHERE ra.period_id = p.id) AS has_allocations
      FROM periods p
      LEFT JOIN house_period_charges hpc ON hpc.period_id = p.id
        AND hpc.house_id = (SELECT MIN(id) FROM houses)
      GROUP BY p.id
      ORDER BY p.year ASC, p.month ASC
    `);

    return rows.map(
      (row: {
        period_id: number;
        year: number;
        month: number;
        water_active: boolean;
        extraordinary_fee_active: boolean;
        maintenance_amount: string | null;
        water_amount: string | null;
        extraordinary_fee_amount: string | null;
        has_allocations: boolean;
      }) => {
        const dto = new PeriodChargeSummaryDto();
        dto.period_id = row.period_id;
        dto.year = row.year;
        dto.month = row.month;
        dto.display_name = formatMonthName(row.month, row.year);
        dto.maintenance_amount = row.maintenance_amount
          ? parseFloat(row.maintenance_amount)
          : 0;
        dto.water_amount = row.water_amount
          ? parseFloat(row.water_amount)
          : null;
        dto.extraordinary_fee_amount = row.extraordinary_fee_amount
          ? parseFloat(row.extraordinary_fee_amount)
          : null;
        dto.water_active = row.water_active;
        dto.extraordinary_fee_active = row.extraordinary_fee_active;
        dto.has_allocations = row.has_allocations;
        return dto;
      },
    );
  }
}
