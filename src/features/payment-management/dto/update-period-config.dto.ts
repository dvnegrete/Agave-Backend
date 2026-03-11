import {
  IsNumber,
  IsInt,
  Min,
  Max,
  IsDateString,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class UpdatePeriodConfigDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  default_maintenance_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  default_water_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  default_extraordinary_fee_amount?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(31)
  payment_due_day?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  late_payment_penalty_amount?: number;

  @IsOptional()
  @IsDateString()
  effective_from?: string;

  @IsOptional()
  @IsDateString()
  effective_until?: string;

  @IsOptional()
  @IsBoolean()
  is_active?: boolean;
}
