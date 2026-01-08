/**
 * DTOs de respuesta para períodos
 */

export class PeriodResponseDto {
  id: number;
  year: number;
  month: number;
  start_date: string;
  end_date: string;
  period_config_id?: number;
  display_name: string;
  created_at: Date;
  updated_at: Date;
}

export class PeriodConfigResponseDto {
  id: number;
  default_maintenance_amount: number;
  default_water_amount?: number;
  default_extraordinary_fee_amount?: number;
  payment_due_day: number;
  late_payment_penalty_amount: number;
  effective_from: Date;
  effective_until?: Date;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export class PeriodWithConfigResponseDto extends PeriodResponseDto {
  config?: PeriodConfigResponseDto;
}
