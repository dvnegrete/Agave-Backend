import { IsOptional, IsBoolean } from 'class-validator';

export class UpdatePeriodConceptsDto {
  @IsOptional()
  @IsBoolean()
  water_active?: boolean;

  @IsOptional()
  @IsBoolean()
  extraordinary_fee_active?: boolean;
}
