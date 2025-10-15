import { MatchingService } from './matching.service';
import { TransactionBank } from '@/shared/database/entities/transaction-bank.entity';
import { Voucher } from '@/shared/database/entities/voucher.entity';
import { ConfidenceLevel, MatchCriteria } from '../../domain';

describe('MatchingService', () => {
  let service: MatchingService;

  beforeEach(() => {
    service = new MatchingService();
  });

  describe('matchTransaction', () => {
    const createTransaction = (
      id: string,
      amount: number,
      date: Date,
      time: string,
    ): TransactionBank => {
      return {
        id,
        amount,
        date,
        time,
        is_deposit: true,
        confirmation_status: false,
      } as TransactionBank;
    };

    const createVoucher = (id: number, amount: number, date: Date): Voucher => {
      return {
        id,
        amount,
        date,
        confirmation_status: false,
      } as Voucher;
    };

    describe('Single match by amount', () => {
      it('should match when there is only one voucher with exact amount', () => {
        const transaction = createTransaction(
          'tx1',
          500.15,
          new Date('2025-01-10T10:00:00'),
          '10:00:00',
        );

        const vouchers = [
          createVoucher(1, 500.15, new Date('2025-01-10T10:05:00')),
          createVoucher(2, 600.25, new Date('2025-01-10T10:10:00')),
        ];

        const processedIds = new Set<number>();

        const result = service.matchTransaction(
          transaction,
          vouchers,
          processedIds,
        );

        expect(result.type).toBe('matched');
        if (result.type === 'matched') {
          expect(result.match.transactionBankId).toBe('tx1');
          expect(result.match.voucherId).toBe(1);
          expect(result.match.amount).toBe(500.15);
          expect(result.match.houseNumber).toBe(15);
          expect(result.match.matchCriteria).toContain(MatchCriteria.AMOUNT);
          expect(result.match.confidenceLevel).toBe(ConfidenceLevel.HIGH);
          expect(result.voucherId).toBe(1);
        }
      });

      it('should not match already processed vouchers', () => {
        const transaction = createTransaction(
          'tx1',
          500.15,
          new Date('2025-01-10T10:00:00'),
          '10:00:00',
        );

        const vouchers = [
          createVoucher(1, 500.15, new Date('2025-01-10T10:05:00')),
        ];

        const processedIds = new Set<number>([1]); // Voucher already processed

        const result = service.matchTransaction(
          transaction,
          vouchers,
          processedIds,
        );

        expect(result.type).toBe('surplus');
        if (result.type === 'surplus') {
          expect(result.surplus.transactionBankId).toBe('tx1');
          expect(result.surplus.requiresManualReview).toBe(true);
        }
      });
    });

    describe('Multiple matches by amount', () => {
      it('should match the closest by date when multiple vouchers have same amount', () => {
        const transaction = createTransaction(
          'tx1',
          500.15,
          new Date('2025-01-10T10:00:00'),
          '10:00:00',
        );

        const vouchers = [
          createVoucher(1, 500.15, new Date('2025-01-08T10:00:00')), // 48 hours before - out of tolerance
          createVoucher(2, 500.15, new Date('2025-01-10T08:00:00')), // 2 hours before - closest
          createVoucher(3, 500.15, new Date('2025-01-11T10:00:00')), // 24 hours after
        ];

        const processedIds = new Set<number>();

        const result = service.matchTransaction(
          transaction,
          vouchers,
          processedIds,
        );

        expect(result.type).toBe('matched');
        if (result.type === 'matched') {
          expect(result.match.voucherId).toBe(2); // Closest voucher
          expect(result.match.matchCriteria).toContain(MatchCriteria.AMOUNT);
          expect(result.match.matchCriteria).toContain(MatchCriteria.DATE);
          expect(result.match.confidenceLevel).toBe(ConfidenceLevel.HIGH);
        }
      });

      it('should require manual validation when multiple vouchers within date tolerance', () => {
        const transaction = createTransaction(
          'tx1',
          500.15,
          new Date('2025-01-10T10:00:00'),
          '10:00:00',
        );

        const vouchers = [
          createVoucher(1, 500.15, new Date('2025-01-10T09:00:00')), // 1 hour before
          createVoucher(2, 500.15, new Date('2025-01-10T11:00:00')), // 1 hour after
        ];

        const processedIds = new Set<number>();

        const result = service.matchTransaction(
          transaction,
          vouchers,
          processedIds,
        );

        expect(result.type).toBe('manual');
        if (result.type === 'manual') {
          expect(result.case.transactionBankId).toBe('tx1');
          expect(result.case.possibleMatches).toHaveLength(2);
          expect(result.case.reason).toContain('Multiple vouchers');
        }
      });

      it('should create surplus when all matches are outside date tolerance', () => {
        const transaction = createTransaction(
          'tx1',
          500.15,
          new Date('2025-01-10T10:00:00'),
          '10:00:00',
        );

        const vouchers = [
          createVoucher(1, 500.15, new Date('2025-01-05T10:00:00')), // 5 days before
          createVoucher(2, 500.15, new Date('2025-01-15T10:00:00')), // 5 days after
        ];

        const processedIds = new Set<number>();

        const result = service.matchTransaction(
          transaction,
          vouchers,
          processedIds,
        );

        expect(result.type).toBe('surplus');
        if (result.type === 'surplus') {
          expect(result.surplus.transactionBankId).toBe('tx1');
          expect(result.surplus.houseNumber).toBe(15);
        }
      });
    });

    describe('No voucher match', () => {
      it('should create surplus with house number when transaction has valid cents', () => {
        const transaction = createTransaction(
          'tx1',
          500.42,
          new Date('2025-01-10T10:00:00'),
          '10:00:00',
        );

        const vouchers = [
          createVoucher(1, 600.25, new Date('2025-01-10T10:00:00')),
        ];

        const processedIds = new Set<number>();

        const result = service.matchTransaction(
          transaction,
          vouchers,
          processedIds,
        );

        expect(result.type).toBe('surplus');
        if (result.type === 'surplus') {
          expect(result.surplus.transactionBankId).toBe('tx1');
          expect(result.surplus.houseNumber).toBe(42);
          expect(result.surplus.reason).toContain(
            'house 42 identified by cents',
          );
          expect(result.surplus.requiresManualReview).toBe(true);
        }
      });

      it('should create surplus requiring voucher when no valid cents', () => {
        const transaction = createTransaction(
          'tx1',
          500.0, // No cents
          new Date('2025-01-10T10:00:00'),
          '10:00:00',
        );

        const vouchers = [
          createVoucher(1, 600.25, new Date('2025-01-10T10:00:00')),
        ];

        const processedIds = new Set<number>();

        const result = service.matchTransaction(
          transaction,
          vouchers,
          processedIds,
        );

        expect(result.type).toBe('surplus');
        if (result.type === 'surplus') {
          expect(result.surplus.transactionBankId).toBe('tx1');
          expect(result.surplus.houseNumber).toBe(0);
          expect(result.surplus.reason).toContain('voucher required');
          expect(result.surplus.requiresManualReview).toBe(true);
        }
      });

      it('should create surplus when cents exceed max house number', () => {
        const transaction = createTransaction(
          'tx1',
          500.99, // 99 exceeds MAX_HOUSE_NUMBER (66)
          new Date('2025-01-10T10:00:00'),
          '10:00:00',
        );

        const vouchers = [];
        const processedIds = new Set<number>();

        const result = service.matchTransaction(
          transaction,
          vouchers,
          processedIds,
        );

        expect(result.type).toBe('surplus');
        if (result.type === 'surplus') {
          expect(result.surplus.houseNumber).toBe(99);
          expect(result.surplus.requiresManualReview).toBe(true);
        }
      });
    });

    describe('Amount matching precision', () => {
      it('should match amounts within 0.01 tolerance', () => {
        const transaction = createTransaction(
          'tx1',
          500.154, // Rounded to 500.15
          new Date('2025-01-10T10:00:00'),
          '10:00:00',
        );

        const vouchers = [
          createVoucher(1, 500.15, new Date('2025-01-10T10:00:00')),
        ];

        const processedIds = new Set<number>();

        const result = service.matchTransaction(
          transaction,
          vouchers,
          processedIds,
        );

        expect(result.type).toBe('matched');
        if (result.type === 'matched') {
          expect(result.match.voucherId).toBe(1);
        }
      });

      it('should not match amounts outside tolerance', () => {
        const transaction = createTransaction(
          'tx1',
          500.15,
          new Date('2025-01-10T10:00:00'),
          '10:00:00',
        );

        const vouchers = [
          createVoucher(1, 500.2, new Date('2025-01-10T10:00:00')), // 0.05 difference
        ];

        const processedIds = new Set<number>();

        const result = service.matchTransaction(
          transaction,
          vouchers,
          processedIds,
        );

        expect(result.type).toBe('surplus');
      });
    });

    describe('Edge cases', () => {
      it('should handle empty vouchers list', () => {
        const transaction = createTransaction(
          'tx1',
          500.15,
          new Date('2025-01-10T10:00:00'),
          '10:00:00',
        );

        const vouchers: Voucher[] = [];
        const processedIds = new Set<number>();

        const result = service.matchTransaction(
          transaction,
          vouchers,
          processedIds,
        );

        expect(result.type).toBe('surplus');
        if (result.type === 'surplus') {
          expect(result.surplus.houseNumber).toBe(15);
        }
      });

      it('should handle all vouchers already processed', () => {
        const transaction = createTransaction(
          'tx1',
          500.15,
          new Date('2025-01-10T10:00:00'),
          '10:00:00',
        );

        const vouchers = [
          createVoucher(1, 500.15, new Date('2025-01-10T10:00:00')),
          createVoucher(2, 500.15, new Date('2025-01-10T11:00:00')),
        ];

        const processedIds = new Set<number>([1, 2]); // All processed

        const result = service.matchTransaction(
          transaction,
          vouchers,
          processedIds,
        );

        expect(result.type).toBe('surplus');
      });

      it('should calculate date difference correctly', () => {
        const transaction = createTransaction(
          'tx1',
          500.15,
          new Date('2025-01-10T10:00:00'),
          '10:00:00',
        );

        const vouchers = [
          createVoucher(1, 500.15, new Date('2025-01-10T10:05:00')), // 5 minutes after
        ];

        const processedIds = new Set<number>();

        const result = service.matchTransaction(
          transaction,
          vouchers,
          processedIds,
        );

        expect(result.type).toBe('matched');
        if (result.type === 'matched') {
          expect(result.match.dateDifferenceHours).toBeLessThanOrEqual(0.1); // ~5 minutes
        }
      });
    });
  });
});
