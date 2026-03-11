import {
  ReconciliationMatch,
  PendingVoucher,
  SurplusTransaction,
  ManualValidationCase,
  ReconciliationSummary,
  ConfidenceLevel,
  MatchCriteria,
} from './reconciliation.entity';
import { TransactionBank } from '@/shared/database/entities/transaction-bank.entity';
import { Voucher } from '@/shared/database/entities/voucher.entity';

describe('Domain Entities - Bank Reconciliation', () => {
  describe('ReconciliationMatch', () => {
    const mockTransaction = {
      id: '123',
      amount: 500.15,
      date: new Date('2025-01-10'),
      time: '10:00:00',
      is_deposit: true,
      confirmation_status: false,
    } as TransactionBank;

    const mockVoucher = {
      id: 456,
      amount: 500.15,
      date: new Date('2025-01-10T10:05:00'),
      confirmation_status: false,
    } as Voucher;

    it('should create a match with voucher', () => {
      const match = ReconciliationMatch.create({
        transaction: mockTransaction,
        voucher: mockVoucher,
        houseNumber: 15,
        matchCriteria: [MatchCriteria.AMOUNT, MatchCriteria.DATE],
        confidenceLevel: ConfidenceLevel.HIGH,
        dateDifferenceHours: 0.08,
      });

      expect(match.transactionBankId).toBe('123');
      expect(match.voucherId).toBe(456);
      expect(match.houseNumber).toBe(15);
      expect(match.amount).toBe(500.15);
      expect(match.matchCriteria).toEqual([
        MatchCriteria.AMOUNT,
        MatchCriteria.DATE,
      ]);
      expect(match.confidenceLevel).toBe(ConfidenceLevel.HIGH);
      expect(match.dateDifferenceHours).toBe(0.08);
    });

    it('should create a match without voucher', () => {
      const match = ReconciliationMatch.create({
        transaction: mockTransaction,
        houseNumber: 15,
        matchCriteria: [MatchCriteria.AMOUNT],
        confidenceLevel: ConfidenceLevel.LOW,
      });

      expect(match.voucherId).toBeUndefined();
      expect(match.hasVoucher()).toBe(false);
    });

    it('should identify if has voucher', () => {
      const withVoucher = ReconciliationMatch.create({
        transaction: mockTransaction,
        voucher: mockVoucher,
        houseNumber: 15,
        matchCriteria: [MatchCriteria.AMOUNT],
        confidenceLevel: ConfidenceLevel.HIGH,
      });

      const withoutVoucher = ReconciliationMatch.create({
        transaction: mockTransaction,
        houseNumber: 15,
        matchCriteria: [MatchCriteria.AMOUNT],
        confidenceLevel: ConfidenceLevel.LOW,
      });

      expect(withVoucher.hasVoucher()).toBe(true);
      expect(withoutVoucher.hasVoucher()).toBe(false);
    });

    it('should identify high confidence matches', () => {
      const highConfidence = ReconciliationMatch.create({
        transaction: mockTransaction,
        voucher: mockVoucher,
        houseNumber: 15,
        matchCriteria: [MatchCriteria.AMOUNT, MatchCriteria.DATE],
        confidenceLevel: ConfidenceLevel.HIGH,
      });

      const lowConfidence = ReconciliationMatch.create({
        transaction: mockTransaction,
        houseNumber: 15,
        matchCriteria: [MatchCriteria.AMOUNT],
        confidenceLevel: ConfidenceLevel.LOW,
      });

      expect(highConfidence.isHighConfidence()).toBe(true);
      expect(lowConfidence.isHighConfidence()).toBe(false);
    });
  });

  describe('PendingVoucher', () => {
    const mockVoucher = {
      id: 789,
      amount: 300.25,
      date: new Date('2025-01-10T10:00:00'),
      confirmation_status: false,
    } as Voucher;

    it('should create from voucher', () => {
      const pending = PendingVoucher.fromVoucher(
        mockVoucher,
        'No matching transaction found',
      );

      expect(pending.voucherId).toBe(789);
      expect(pending.amount).toBe(300.25);
      expect(pending.date).toEqual(mockVoucher.date);
      expect(pending.reason).toBe('No matching transaction found');
    });

    it('should create with custom reason', () => {
      const pending = PendingVoucher.fromVoucher(
        mockVoucher,
        'Payment not reflected in bank',
      );

      expect(pending.reason).toBe('Payment not reflected in bank');
    });
  });

  describe('SurplusTransaction', () => {
    const mockTransaction = {
      id: '999',
      amount: 600.0,
      date: new Date('2025-01-12'),
      time: '15:30:00',
      is_deposit: true,
      confirmation_status: false,
    } as TransactionBank;

    it('should create from transaction', () => {
      const surplus = SurplusTransaction.fromTransaction(
        mockTransaction,
        'No voucher found',
        true,
      );

      expect(surplus.transactionBankId).toBe('999');
      expect(surplus.amount).toBe(600.0);
      expect(surplus.date).toEqual(mockTransaction.date);
      expect(surplus.reason).toBe('No voucher found');
      expect(surplus.requiresManualReview).toBe(true);
    });

    it('should default requiresManualReview to true', () => {
      const surplus = SurplusTransaction.fromTransaction(
        mockTransaction,
        'No voucher',
      );

      expect(surplus.requiresManualReview).toBe(true);
    });

    it('should allow requiresManualReview false', () => {
      const surplus = SurplusTransaction.fromTransaction(
        mockTransaction,
        'Automatic processing',
        false,
      );

      expect(surplus.requiresManualReview).toBe(false);
    });
  });

  describe('ManualValidationCase', () => {
    const mockTransaction = {
      id: '888',
      amount: 500.15,
      date: new Date('2025-01-10'),
    } as TransactionBank;

    const mockVoucher1 = {
      id: 111,
      amount: 500.15,
    } as Voucher;

    const mockVoucher2 = {
      id: 222,
      amount: 500.15,
    } as Voucher;

    it('should create with multiple possible matches', () => {
      const manualCase = ManualValidationCase.create({
        transaction: mockTransaction,
        possibleMatches: [
          {
            voucher: mockVoucher1,
            dateDifferenceHours: 12,
            similarityScore: 0.85,
          },
          {
            voucher: mockVoucher2,
            dateDifferenceHours: 18,
            similarityScore: 0.82,
          },
        ],
        reason: 'Multiple vouchers with same amount',
      });

      expect(manualCase.transactionBankId).toBe('888');
      expect(manualCase.possibleMatches).toHaveLength(2);
      expect(manualCase.possibleMatches[0].voucherId).toBe(111);
      expect(manualCase.possibleMatches[0].similarity).toBe(0.85);
      expect(manualCase.possibleMatches[0].dateDifferenceHours).toBe(12);
      expect(manualCase.reason).toBe('Multiple vouchers with same amount');
    });

    it('should identify if has multiple options', () => {
      const multipleOptions = ManualValidationCase.create({
        transaction: mockTransaction,
        possibleMatches: [
          {
            voucher: mockVoucher1,
            dateDifferenceHours: 12,
            similarityScore: 0.85,
          },
          {
            voucher: mockVoucher2,
            dateDifferenceHours: 18,
            similarityScore: 0.82,
          },
        ],
        reason: 'Multiple matches',
      });

      const singleOption = ManualValidationCase.create({
        transaction: mockTransaction,
        possibleMatches: [
          {
            voucher: mockVoucher1,
            dateDifferenceHours: 12,
            similarityScore: 0.85,
          },
        ],
        reason: 'Single match',
      });

      expect(multipleOptions.hasMultipleOptions()).toBe(true);
      expect(singleOption.hasMultipleOptions()).toBe(false);
    });
  });

  describe('ReconciliationSummary', () => {
    it('should create summary', () => {
      const summary = ReconciliationSummary.create({
        totalProcessed: 100,
        conciliados: 75,
        unclaimedDeposits: 15,
        unfundedVouchers: 10,
        requiresManualValidation: 20,
      });

      expect(summary.totalProcessed).toBe(100);
      expect(summary.conciliados).toBe(75);
      expect(summary.unclaimedDeposits).toBe(15);
      expect(summary.unfundedVouchers).toBe(10);
      expect(summary.requiresManualValidation).toBe(20);
    });

    it('should calculate success rate', () => {
      const summary = ReconciliationSummary.create({
        totalProcessed: 100,
        conciliados: 75,
        unclaimedDeposits: 15,
        unfundedVouchers: 10,
        requiresManualValidation: 20,
      });

      expect(summary.getSuccessRate()).toBe(75); // 75%
    });

    it('should handle zero totalProcessed', () => {
      const summary = ReconciliationSummary.create({
        totalProcessed: 0,
        conciliados: 0,
        unclaimedDeposits: 0,
        unfundedVouchers: 0,
        requiresManualValidation: 0,
      });

      expect(summary.getSuccessRate()).toBe(0);
    });

    it('should identify if has manual review', () => {
      const withManual = ReconciliationSummary.create({
        totalProcessed: 100,
        conciliados: 75,
        unclaimedDeposits: 15,
        unfundedVouchers: 10,
        requiresManualValidation: 20,
      });

      const withoutManual = ReconciliationSummary.create({
        totalProcessed: 100,
        conciliados: 100,
        unclaimedDeposits: 0,
        unfundedVouchers: 0,
        requiresManualValidation: 0,
      });

      expect(withManual.hasManualReview()).toBe(true);
      expect(withoutManual.hasManualReview()).toBe(false);
    });
  });
});
