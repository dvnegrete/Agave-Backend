import { IsNumber, Min, IsOptional, IsString, IsEnum } from 'class-validator';
import { AllocationConceptType } from '@/shared/database/entities/enums';

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

export class InitialDebtDto {
  @IsNumber()
  @Min(1)
  period_id: number;

  @IsEnum(AllocationConceptType)
  concept_type: AllocationConceptType;

  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsString()
  reason?: string;
}
