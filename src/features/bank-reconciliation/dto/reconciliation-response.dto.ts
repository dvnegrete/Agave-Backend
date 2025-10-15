import {
  ReconciliationMatch,
  PendingVoucher,
  SurplusTransaction,
  ManualValidationCase,
  ReconciliationSummary,
} from '../interfaces/reconciliation.interface';

export class ReconciliationResponseDto {
  summary: ReconciliationSummary;
  conciliados: ReconciliationMatch[];
  pendientes: PendingVoucher[];
  sobrantes: SurplusTransaction[];
  manualValidationRequired: ManualValidationCase[];
}
