import {
  IsNumber,
  IsInt,
  Min,
  Max,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PeriodChargeAmountsDto {
  @IsNumber()
  @Min(0)
  maintenance_amount: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  water_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraordinary_fee_amount?: number;
}

export class BatchUpdatePeriodChargesDto {
  @IsInt()
  @Min(2020)
  @Max(2030)
  start_year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  start_month: number;

  @IsInt()
  @Min(2020)
  @Max(2030)
  end_year: number;

  @IsInt()
  @Min(1)
  @Max(12)
  end_month: number;

  @ValidateNested()
  @Type(() => PeriodChargeAmountsDto)
  amounts: PeriodChargeAmountsDto;
}
