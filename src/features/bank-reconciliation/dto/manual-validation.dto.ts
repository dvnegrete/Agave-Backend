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
import {
  MIN_HOUSE_NUMBER,
  MAX_HOUSE_NUMBER,
} from '@/shared/config/business-rules.config';

/**
 * Filtros para obtener casos pendientes de validación manual
 */
export class GetManualValidationCasesFilterDto {
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
    description: 'Filtrar por número de casa específico',
    example: 15,
  })
  @IsOptional()
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
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({
    description: 'Registros por página',
    example: 20,
    default: 20,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Ordenar por: date (más nuevo primero), similarity (menor primero), candidates (más candidatos)',
    enum: ['date', 'similarity', 'candidates'],
    default: 'date',
  })
  @IsOptional()
  @IsEnum(['date', 'similarity', 'candidates'])
  sortBy?: 'date' | 'similarity' | 'candidates' = 'date';
}

/**
 * DTO para aprobar un caso de validación manual
 */
export class ApproveManualCaseDto {
  @ApiProperty({
    description: 'ID del voucher que se elige para conciliar',
    example: 101,
  })
  @IsNumber()
  voucherId: number;

  @ApiPropertyOptional({
    description: 'Notas/comentario del operador sobre la aprobación',
    example: 'Voucher 101 es el correcto. La fecha del 102 es inconsistente.',
  })
  @IsOptional()
  @IsString()
  approverNotes?: string;
}

/**
 * DTO para rechazar un caso de validación manual (todos los vouchers candidatos)
 */
export class RejectManualCaseDto {
  @ApiProperty({
    description: 'Razón del rechazo',
    example: 'Ninguno de los vouchers coincide correctamente. El pago puede ser de otra transacción.',
  })
  @IsString()
  rejectionReason: string;

  @ApiPropertyOptional({
    description: 'Notas adicionales del operador',
    example: 'Contactar con residente para aclarar.',
  })
  @IsOptional()
  @IsString()
  notes?: string;
}

/**
 * Información de un posible candidato en respuesta detallada
 */
export class PossibleMatchDetailDto {
  @ApiProperty({
    description: 'ID del voucher candidato',
    example: 101,
  })
  voucherId: number;

  @ApiProperty({
    description: 'Monto del voucher',
    example: 1500.15,
  })
  voucherAmount: number;

  @ApiProperty({
    description: 'Fecha del voucher',
    example: '2025-01-15T09:00:00Z',
  })
  voucherDate: Date;

  @ApiProperty({
    description: 'Número de casa del voucher (si está disponible)',
    example: 15,
  })
  houseNumber?: number;

  @ApiProperty({
    description: 'Score de similitud (0-1, donde 1 es perfecto)',
    example: 0.99,
  })
  similarity: number;

  @ApiProperty({
    description: 'Diferencia de horas entre la transacción y el voucher',
    example: 1,
  })
  dateDifferenceHours: number;
}

/**
 * DTO de respuesta detallada para un caso de validación manual
 */
export class ManualValidationCaseResponseDto {
  @ApiProperty({
    description: 'ID de la transacción bancaria',
    example: 'TX-001',
  })
  transactionBankId: string;

  @ApiProperty({
    description: 'Monto de la transacción',
    example: 1500.15,
  })
  transactionAmount: number;

  @ApiProperty({
    description: 'Fecha de la transacción',
    example: '2025-01-15T10:00:00Z',
  })
  transactionDate: Date;

  @ApiProperty({
    description: 'Concepto/descripción de la transacción',
    example: 'Pago residencia',
  })
  transactionConcept: string | null;

  @ApiProperty({
    description: 'Lista de posibles matches ordenados por similitud (mejor primero)',
    type: [PossibleMatchDetailDto],
  })
  possibleMatches: PossibleMatchDetailDto[];

  @ApiProperty({
    description: 'Explicación de por qué requiere validación manual',
    example: '2 vouchers con monto exacto y similitud muy cercana. Diferencia máxima entre candidatos: 0.02.',
  })
  reason: string;

  @ApiProperty({
    description: 'Fecha en que fue creado el caso',
    example: '2025-01-15T10:05:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Estado del caso: pending, approved, rejected',
    enum: ['pending', 'approved', 'rejected'],
    example: 'pending',
  })
  status: 'pending' | 'approved' | 'rejected';

  @ApiPropertyOptional({
    description: 'ID del usuario que aprobó/rechazó el caso (si aplica)',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  approvedByUserId?: string;

  @ApiPropertyOptional({
    description: 'Notas del operador',
    example: 'Voucher 101 elegido. Voucher 102 es de otro período de pago.',
  })
  approvalNotes?: string;

  @ApiPropertyOptional({
    description: 'Fecha en que fue aprobado/rechazado',
    example: '2025-01-15T11:30:00Z',
  })
  approvedAt?: Date;
}

/**
 * DTO de respuesta para lista paginada de casos de validación manual
 */
export class ManualValidationCasesPageDto {
  @ApiProperty({
    description: 'Total de casos pendientes (sin paginación)',
    example: 42,
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
    example: 3,
  })
  totalPages: number;

  @ApiProperty({
    description: 'Array de casos de validación manual',
    type: [ManualValidationCaseResponseDto],
  })
  items: ManualValidationCaseResponseDto[];
}

/**
 * DTO de respuesta para estadísticas de validación manual
 */
export class ManualValidationStatsDto {
  @ApiProperty({
    description: 'Total de casos pendientes de revisión',
    example: 15,
  })
  totalPending: number;

  @ApiProperty({
    description: 'Total de casos aprobados',
    example: 127,
  })
  totalApproved: number;

  @ApiProperty({
    description: 'Total de casos rechazados',
    example: 8,
  })
  totalRejected: number;

  @ApiProperty({
    description: 'Casos pendientes en últimas 24 horas',
    example: 3,
  })
  pendingLast24Hours: number;

  @ApiProperty({
    description: 'Tasa de aprobación (aprobados / (aprobados + rechazados))',
    example: 0.94,
  })
  approvalRate: number;

  @ApiProperty({
    description: 'Tiempo promedio de aprobación en minutos',
    example: 125,
  })
  avgApprovalTimeMinutes: number;

  @ApiProperty({
    description: 'Distribución de casos por rango de casa',
    example: {
      '1-10': 5,
      '11-20': 4,
      '21-30': 2,
      '31-40': 2,
      '41-66': 2,
    },
  })
  distributionByHouseRange: Record<string, number>;
}

/**
 * DTO de respuesta para aprobación de caso
 */
export class ApproveManualCaseResponseDto {
  @ApiProperty({
    description: 'Mensaje de confirmación',
    example: 'Caso aprobado exitosamente',
  })
  message: string;

  @ApiProperty({
    description: 'Transacción conciliada',
    example: {
      transactionBankId: 'TX-001',
      voucherId: 101,
      houseNumber: 15,
      confidenceLevel: 'HIGH',
      status: 'confirmed',
    },
  })
  reconciliation: any;

  @ApiProperty({
    description: 'Timestamp de la aprobación',
    example: '2025-01-15T11:30:00Z',
  })
  approvedAt: Date;
}

/**
 * DTO de respuesta para rechazo de caso
 */
export class RejectManualCaseResponseDto {
  @ApiProperty({
    description: 'Mensaje de confirmación',
    example: 'Caso rechazado exitosamente',
  })
  message: string;

  @ApiProperty({
    description: 'ID de la transacción',
    example: 'TX-001',
  })
  transactionBankId: string;

  @ApiProperty({
    description: 'Nuevo estado de la transacción',
    example: 'not-found',
  })
  newStatus: string;

  @ApiProperty({
    description: 'Timestamp del rechazo',
    example: '2025-01-15T11:30:00Z',
  })
  rejectedAt: Date;
}
