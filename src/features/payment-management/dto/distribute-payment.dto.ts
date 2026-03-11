import {
  IsNumber,
  Min,
  IsOptional,
  IsInt,
  IsArray,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class DistributePaymentRequestDto {
  @IsNumber()
  @Min(0.01)
  amount: number;

  @IsOptional()
  @IsInt()
  record_id?: number;
}

export class ConfirmAllocationDto {
  @IsInt()
  period_id: number;

  @IsNumber()
  @Min(0.01)
  amount: number;
}

export class ConfirmDistributionRequestDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ConfirmAllocationDto)
  allocations: ConfirmAllocationDto[];

  @IsOptional()
  @IsInt()
  record_id?: number;
}
