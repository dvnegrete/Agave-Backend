import { IsNumber, IsOptional, Min } from 'class-validator';

/**
 * DTO para actualizar montos esperados en conceptos de un período
 */
export class UpdatePeriodAmountsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  maintenance_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  water_amount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  extraordinary_fee_amount?: number;
}
