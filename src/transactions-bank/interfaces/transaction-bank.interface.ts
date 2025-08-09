export interface TransactionBank {
  id?: string;
  date: string;
  time: string;
  concept: string;
  amount: number;
  currency: string;
  is_deposit: boolean;
  validation_flag?: boolean;
  status?: 'pending' | 'processed' | 'failed' | 'reconciled';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProcessedBankTransaction extends TransactionBank {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface BankTransactionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FileProcessingResult {
  success: boolean;
  totalTransactions: number;
  validTransactions: number;
  invalidTransactions: number;
  transactions: ProcessedBankTransaction[];
  errors: string[];
  processingTime: number;
  bankName?: string;
  accountNumber?: string;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

export interface BankAccount {
  accountNumber: string;
  bankName: string;
  accountType: 'checking' | 'savings' | 'credit' | 'investment';
  currency: string;
  balance: number;
  lastReconciliation?: Date;
}

export interface ReconciliationResult {
  success: boolean;
  matchedTransactions: number;
  unmatchedTransactions: number;
  totalTransactions: number;
  reconciliationDate: Date;
  discrepancies: string[];
}


