export interface Transaction {
  id?: string;
  date: Date;
  description: string;
  amount: number;
  type: 'credit' | 'debit';
  accountNumber: string;
  reference?: string;
  category?: string;
  status: 'pending' | 'processed' | 'failed';
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProcessedTransaction extends Transaction {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TransactionValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface FileProcessingResult {
  success: boolean;
  totalTransactions: number;
  validTransactions: number;
  invalidTransactions: number;
  transactions: ProcessedTransaction[];
  errors: string[];
  processingTime: number;
}
