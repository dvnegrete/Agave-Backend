import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  IsEnum,
  Min,
  Max,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  MIN_HOUSE_NUMBER,
  MAX_HOUSE_NUMBER,
} from '@/shared/config/business-rules.config';

/**
 * Filtros para obtener vouchers sin fondos (no conciliados)
 */
export class GetUnfundedVouchersFilterDto {
  @ApiPropertyOptional({
    description: 'Fecha inicial del rango (inclusiva)',
    example: '2025-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Fecha final del rango (inclusiva)',
    example: '2025-01-31',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Página de resultados (comienza en 1)',
    example: 1,
    default: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Registros por página',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description:
      'Ordenar por: date (más reciente primero), amount (mayor primero)',
    enum: ['date', 'amount'],
    default: 'date',
  })
  @IsOptional()
  @IsEnum(['date', 'amount'])
  sortBy?: 'date' | 'amount' = 'date';
}

/**
 * Información de un voucher sin fondos
 */
export class UnfundedVoucherItemDto {
  @ApiProperty({
    description: 'ID del voucher',
    example: 101,
  })
  voucherId: number;

  @ApiProperty({
    description: 'Monto del voucher',
    example: 800.0,
  })
  amount: number;

  @ApiProperty({
    description: 'Fecha del voucher',
    example: '2025-01-15T13:36:36Z',
  })
  date: Date;

  @ApiPropertyOptional({
    description: 'Número de casa asociado al voucher (si disponible)',
    example: 15,
  })
  houseNumber?: number | null;

  @ApiPropertyOptional({
    description: 'URL del comprobante (si disponible)',
    example: 'p-2025-10-17_14-30-45-uuid.jpg',
  })
  url?: string | null;
}

/**
 * DTO de respuesta paginada para vouchers sin fondos
 */
export class UnfundedVouchersPageDto {
  @ApiProperty({
    description: 'Total de vouchers sin fondos (sin paginación)',
    example: 5,
  })
  totalCount: number;

  @ApiProperty({
    description: 'Página actual',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Límite de registros por página',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Total de páginas',
    example: 1,
  })
  totalPages: number;

  @ApiProperty({
    description: 'Array de vouchers sin fondos',
    type: [UnfundedVoucherItemDto],
  })
  items: UnfundedVoucherItemDto[];
}

/**
 * DTO para conciliar manualmente un voucher sin fondos con un depósito
 */
export class MatchVoucherToDepositDto {
  @ApiProperty({
    description: 'ID de la transacción bancaria (depósito) a vincular',
    example: '12345',
  })
  @IsString()
  transactionBankId: string;

  @ApiProperty({
    description: 'Número de casa a asignar',
    example: 15,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(MIN_HOUSE_NUMBER)
  @Max(MAX_HOUSE_NUMBER)
  houseNumber: number;

  @ApiPropertyOptional({
    description: 'Notas del administrador',
    example: 'Voucher corresponde al depósito según confirmación del residente',
  })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}

/**
 * DTO de respuesta para conciliación manual de voucher
 */
export class MatchVoucherResponseDto {
  @ApiProperty({
    description: 'Mensaje de confirmación',
    example: 'Voucher conciliado exitosamente con depósito',
  })
  message: string;

  @ApiProperty({
    description: 'Detalles de la conciliación',
  })
  reconciliation: {
    voucherId: number;
    transactionBankId: string;
    houseNumber: number;
    status: string;
    paymentAllocation?: {
      total_distributed: number;
      allocations: Array<{
        conceptType: string;
        allocatedAmount: number;
        paymentStatus: string;
      }>;
    } | null;
  };

  @ApiProperty({
    description: 'Timestamp de la conciliación',
    example: '2025-01-15T11:30:00Z',
  })
  matchedAt: Date;
}
