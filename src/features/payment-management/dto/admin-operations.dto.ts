import { IsNumber, Min, IsOptional, IsString } from 'class-validator';

export class InitialBalanceDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  reason?: string;
}

export class AdjustChargeDto {
  @IsNumber()
  @Min(0)
  new_amount: number;
}
