import {
  IsNumber,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class CreatePeriodConfigDto {
  @IsNumber()
  @Min(0)
  default_maintenance_amount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  default_water_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  default_extraordinary_fee_amount?: number;

  @IsInt()
  @Min(1)
  @Max(31)
  payment_due_day: number;

  @IsNumber()
  @Min(0)
  late_payment_penalty_amount: number;

  @IsDateString()
  effective_from: string;

  @IsOptional()
  @IsDateString()
  effective_until?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
