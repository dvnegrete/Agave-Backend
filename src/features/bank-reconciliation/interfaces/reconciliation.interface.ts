// Re-export domain entities for backward compatibility
export {
  ConfidenceLevel,
  MatchCriteria,
  ReconciliationMatch,
  UnfundedVoucher,
  UnclaimedDeposit,
  PendingVoucher, // Legacy alias
  SurplusTransaction, // Legacy alias
  ManualValidationCase,
  ReconciliationSummary,
} from '../domain/reconciliation.entity';
