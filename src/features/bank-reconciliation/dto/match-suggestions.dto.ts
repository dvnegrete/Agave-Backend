import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  ValidateNested,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  MIN_HOUSE_NUMBER,
  MAX_HOUSE_NUMBER,
} from '@/shared/config/business-rules.config';

/**
 * Item individual de sugerencia de cross-matching
 */
export class MatchSuggestionItemDto {
  @ApiProperty({ description: 'ID de la transacción bancaria (depósito)', example: '12345' })
  transactionBankId: string;

  @ApiProperty({ description: 'ID del voucher sugerido', example: 101 })
  voucherId: number;

  @ApiProperty({ description: 'Monto coincidente', example: 800.0 })
  amount: number;

  @ApiProperty({ description: 'Fecha del depósito', example: '2025-11-14' })
  depositDate: string;

  @ApiPropertyOptional({ description: 'Hora del depósito', example: '10:30:00' })
  depositTime: string | null;

  @ApiProperty({ description: 'Fecha del voucher', example: '2025-11-14' })
  voucherDate: string;

  @ApiPropertyOptional({ description: 'Número de casa del voucher (si disponible)', example: 15 })
  houseNumber: number | null;

  @ApiProperty({
    description: 'Nivel de confianza del match',
    enum: ['high', 'medium'],
    example: 'high',
  })
  confidence: 'high' | 'medium';

  @ApiProperty({ description: 'Razón del match', example: 'Mismo monto y fecha, misma cantidad de deposits/vouchers' })
  reason: string;
}

/**
 * Response para GET /match-suggestions
 */
export class MatchSuggestionsResponseDto {
  @ApiProperty({ description: 'Total de sugerencias encontradas', example: 4 })
  totalSuggestions: number;

  @ApiProperty({ description: 'Cantidad de sugerencias de alta confianza', example: 2 })
  highConfidence: number;

  @ApiProperty({ description: 'Cantidad de sugerencias de confianza media', example: 2 })
  mediumConfidence: number;

  @ApiProperty({ description: 'Lista de sugerencias', type: [MatchSuggestionItemDto] })
  suggestions: MatchSuggestionItemDto[];
}

/**
 * Request para POST /match-suggestions/apply
 */
export class ApplyMatchSuggestionDto {
  @ApiProperty({ description: 'ID de la transacción bancaria', example: '12345' })
  @IsString()
  transactionBankId: string;

  @ApiProperty({ description: 'ID del voucher a vincular', example: 101 })
  @Type(() => Number)
  @IsNumber()
  voucherId: number;

  @ApiProperty({ description: 'Número de casa', example: 15 })
  @Type(() => Number)
  @IsNumber()
  @Min(MIN_HOUSE_NUMBER)
  @Max(MAX_HOUSE_NUMBER)
  houseNumber: number;

  @ApiPropertyOptional({ description: 'Notas del administrador' })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}

/**
 * Request para POST /match-suggestions/apply-batch
 */
export class ApplyBatchMatchSuggestionsDto {
  @ApiProperty({ description: 'Lista de sugerencias a aplicar', type: [ApplyMatchSuggestionDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ApplyMatchSuggestionDto)
  suggestions: ApplyMatchSuggestionDto[];
}

/**
 * Response para POST /match-suggestions/apply
 */
export class ApplyMatchSuggestionResponseDto {
  @ApiProperty({ description: 'Mensaje de confirmación' })
  message: string;

  @ApiProperty({
    description: 'Detalles de la conciliación',
    example: { transactionBankId: '12345', voucherId: 101, houseNumber: 15, status: 'confirmed' },
  })
  reconciliation: {
    transactionBankId: string;
    voucherId: number;
    houseNumber: number;
    status: string;
  };

  @ApiProperty({ description: 'Timestamp de aplicación' })
  appliedAt: Date;
}

/**
 * Item de resultado individual en batch
 */
export class BatchResultItemDto {
  @ApiProperty() transactionBankId: string;
  @ApiProperty() voucherId: number;
  @ApiProperty() success: boolean;
  @ApiPropertyOptional() error?: string;
}

/**
 * Response para POST /match-suggestions/apply-batch
 */
export class ApplyBatchResponseDto {
  @ApiProperty({ description: 'Total de sugerencias aplicadas exitosamente', example: 2 })
  totalApplied: number;

  @ApiProperty({ description: 'Total de sugerencias fallidas', example: 0 })
  totalFailed: number;

  @ApiProperty({ description: 'Resultados individuales', type: [BatchResultItemDto] })
  results: BatchResultItemDto[];
}
