import { ApiProperty } from '@nestjs/swagger';
import {
  ReconciliationMatch,
  UnfundedVoucher,
  UnclaimedDeposit,
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
    description:
      'Lista de transacciones que coincidieron automáticamente con vouchers',
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
    description:
      'Vouchers sin fondos: comprobantes que existen pero la transacción bancaria no',
    type: 'array',
    example: [
      {
        voucherId: 2,
        amount: 2000.0,
        date: '2025-01-10',
        reason: 'No matching bank transaction found',
      },
    ],
  })
  unfundedVouchers: UnfundedVoucher[];

  @ApiProperty({
    description:
      'Depósitos no reclamados: transacciones bancarias que existen pero el voucher no',
    type: 'array',
    example: [
      {
        transactionBankId: '101',
        amount: 3000.0,
        date: '2025-01-10',
        reason: 'Sin voucher, sin centavos válidos, sin concepto identificable',
        requiresManualReview: true,
      },
    ],
  })
  unclaimedDeposits: UnclaimedDeposit[];

  @ApiProperty({
    description: 'Casos ambiguos que requieren revisión y validación manual',
    type: 'array',
    example: [
      {
        voucher: { id: 3, monto: 1000.0 },
        possibleMatches: [
          { transaction: { id: 102 }, matchScore: 0.85 },
          { transaction: { id: 103 }, matchScore: 0.8 },
        ],
        reason: 'Múltiples transacciones candidatas',
      },
    ],
  })
  manualValidationRequired: ManualValidationCase[];

  @ApiProperty({
    description:
      'Cantidad de conciliaciones automáticas por cross-matching (depósitos no reclamados + vouchers sin fondos)',
    example: 2,
  })
  crossMatched: number;
}
