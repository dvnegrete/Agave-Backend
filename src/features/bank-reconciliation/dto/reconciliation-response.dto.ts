import { ApiProperty } from '@nestjs/swagger';
import {
  ReconciliationMatch,
  PendingVoucher,
  SurplusTransaction,
  ManualValidationCase,
  ReconciliationSummary,
} from '../interfaces/reconciliation.interface';

export class ReconciliationResponseDto {
  @ApiProperty({
    description: 'Resumen numérico de los resultados de la conciliación',
    example: {
      totalVouchers: 50,
      totalTransactions: 48,
      matched: 45,
      pendingVouchers: 5,
      surplusTransactions: 3,
      manualValidationRequired: 2,
    },
  })
  summary: ReconciliationSummary;

  @ApiProperty({
    description: 'Lista de transacciones que coincidieron automáticamente con vouchers',
    type: 'array',
    example: [
      {
        voucher: { id: 1, monto: 1500.15, casa: 15 },
        transaction: { id: 100, monto: 1500.15, fecha: '2025-01-05' },
        matchConfidence: 1.0,
      },
    ],
  })
  conciliados: ReconciliationMatch[];

  @ApiProperty({
    description: 'Lista de vouchers sin transacción bancaria asociada',
    type: 'array',
    example: [
      {
        voucher: { id: 2, monto: 2000.0, casa: 20 },
        reason: 'No se encontró transacción bancaria coincidente',
      },
    ],
  })
  pendientes: PendingVoucher[];

  @ApiProperty({
    description: 'Lista de transacciones bancarias sin voucher asociado',
    type: 'array',
    example: [
      {
        transaction: { id: 101, monto: 3000.0, fecha: '2025-01-10' },
        reason: 'No se encontró voucher coincidente',
      },
    ],
  })
  sobrantes: SurplusTransaction[];

  @ApiProperty({
    description: 'Casos ambiguos que requieren revisión y validación manual',
    type: 'array',
    example: [
      {
        voucher: { id: 3, monto: 1000.0 },
        possibleMatches: [
          { transaction: { id: 102 }, matchScore: 0.85 },
          { transaction: { id: 103 }, matchScore: 0.80 },
        ],
        reason: 'Múltiples transacciones candidatas',
      },
    ],
  })
  manualValidationRequired: ManualValidationCase[];
}
