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
 * Filtros para obtener depósitos no reclamados
 */
export class GetUnclaimedDepositsFilterDto {
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
    description: 'Filtrar por tipo de sobrante',
    enum: ['conflict', 'not-found', 'all'],
    default: 'all',
  })
  @IsOptional()
  @IsEnum(['conflict', 'not-found', 'all'])
  validationStatus?: 'conflict' | 'not-found' | 'all' = 'all';

  @ApiPropertyOptional({
    description: 'Filtrar por casa sugerida (centavos)',
    example: 15,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(MIN_HOUSE_NUMBER)
  @Max(MAX_HOUSE_NUMBER)
  houseNumber?: number;

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
 * DTO para asignar casa manualmente a un depósito
 */
export class AssignHouseDto {
  @ApiProperty({
    description: 'Número de casa a asignar (1-66)',
    example: 15,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(MIN_HOUSE_NUMBER)
  @Max(MAX_HOUSE_NUMBER)
  houseNumber: number;

  @ApiPropertyOptional({
    description: 'Notas/comentario del administrador',
    example: 'Casa 15 confirmada por el residente mediante llamada telefónica',
  })
  @IsOptional()
  @IsString()
  adminNotes?: string;
}

/**
 * Información de un depósito no reclamado
 */
export class UnclaimedDepositResponseDto {
  @ApiProperty({
    description: 'ID de la transacción bancaria',
    example: 'TX-12345',
  })
  transactionBankId: string;

  @ApiProperty({
    description: 'Monto del depósito',
    example: 1500.15,
  })
  amount: number;

  @ApiProperty({
    description: 'Fecha del depósito',
    example: '2025-01-15T10:00:00Z',
  })
  date: Date;

  @ApiProperty({
    description: 'Concepto/descripción del depósito',
    example: 'Pago casa 20 mantenimiento',
  })
  concept: string | null;

  @ApiProperty({
    description: 'Estado de validación',
    enum: ['conflict', 'not-found'],
    example: 'conflict',
  })
  validationStatus: 'conflict' | 'not-found';

  @ApiProperty({
    description: 'Razón por la que no se pudo conciliar automáticamente',
    example: 'Conflicto: concepto sugiere casa 20, centavos sugieren casa 15',
  })
  reason: string;

  @ApiPropertyOptional({
    description: 'Número de casa sugerida por los centavos (si aplica)',
    example: 15,
  })
  suggestedHouseNumber?: number | null;

  @ApiPropertyOptional({
    description: 'Número de casa sugerida por análisis de concepto (si aplica)',
    example: 20,
  })
  conceptHouseNumber?: number | null;

  @ApiProperty({
    description: 'Fecha en que fue procesado por el sistema',
    example: '2025-01-15T10:05:00Z',
  })
  processedAt: Date;
}

/**
 * DTO de respuesta para lista paginada de depósitos no reclamados
 */
export class UnclaimedDepositsPageDto {
  @ApiProperty({
    description: 'Total de depósitos no reclamados (sin paginación)',
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
    description: 'Array de depósitos no reclamados',
    type: [UnclaimedDepositResponseDto],
  })
  items: UnclaimedDepositResponseDto[];
}

/**
 * Información de distribución de pagos
 */
export class PaymentAllocationDetailDto {
  @ApiProperty({
    description: 'Tipo de concepto al que se asignó',
    example: 'maintenance',
  })
  conceptType: string;

  @ApiProperty({
    description: 'Monto asignado a este concepto',
    example: 2000.00,
  })
  allocatedAmount: number;

  @ApiProperty({
    description: 'Estado de la asignación',
    example: 'complete',
  })
  paymentStatus: string;
}

/**
 * Información de resultado de asignación de casa
 */
export class ReconciliationResultDto {
  @ApiProperty({
    description: 'ID de la transacción bancaria',
    example: 'TX-12345',
  })
  transactionBankId: string;

  @ApiProperty({
    description: 'Número de casa asignada',
    example: 15,
  })
  houseNumber: number;

  @ApiProperty({
    description: 'Estado de la conciliación',
    example: 'confirmed',
  })
  status: string;

  @ApiPropertyOptional({
    description: 'Información sobre la asignación de pagos',
    type: Object,
  })
  paymentAllocation?: {
    total_distributed: number;
    allocations: PaymentAllocationDetailDto[];
  } | null;
}

/**
 * DTO de respuesta para asignación de casa a depósito
 */
export class AssignHouseResponseDto {
  @ApiProperty({
    description: 'Mensaje de confirmación',
    example: 'Depósito asignado exitosamente a casa 15',
  })
  message: string;

  @ApiProperty({
    description: 'Resultado de la conciliación',
    type: ReconciliationResultDto,
  })
  reconciliation: ReconciliationResultDto;

  @ApiProperty({
    description: 'Timestamp de la asignación',
    example: '2025-01-15T11:30:00Z',
  })
  assignedAt: Date;
}
