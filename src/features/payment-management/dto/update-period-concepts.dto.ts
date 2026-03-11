import { IsOptional, IsBoolean, IsInt, Min, Max } from 'class-validator';

export class UpdatePeriodConceptsDto {
  @IsOptional()
  @IsBoolean()
  water_active?: boolean;

  @IsOptional()
  @IsBoolean()
  extraordinary_fee_active?: boolean;

  /**
   * Día límite de pago para este período (1–28).
   * Sobreescribe el payment_due_day del PeriodConfig para este mes específico.
   * Enviar null para volver a usar el del PeriodConfig.
   */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(28)
  payment_due_day?: number | null;
}
