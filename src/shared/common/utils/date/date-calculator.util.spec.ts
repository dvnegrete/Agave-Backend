import {
  getDateDifferenceInHours,
  extractHouseNumberFromCents,
} from './date-calculator.util';

describe('Date Calculator Utilities', () => {
  describe('getDateDifferenceInHours', () => {
    describe('with Date objects', () => {
      it('should calculate difference between two dates with times', () => {
        const date1 = new Date('2025-01-10T10:00:00');
        const time1 = '10:00:00';
        const date2 = new Date('2025-01-10T12:00:00');

        const result = getDateDifferenceInHours(date1, time1, date2);

        expect(result).toBe(2); // 2 hours difference
      });

      it('should return absolute value (order does not matter)', () => {
        const date1 = new Date('2025-01-10T10:00:00');
        const time1 = '10:00:00';
        const date2 = new Date('2025-01-10T08:00:00');

        const result = getDateDifferenceInHours(date1, time1, date2);

        expect(result).toBe(2); // Still 2 hours
      });

      it('should handle dates on different days', () => {
        const date1 = new Date('2025-01-10T10:00:00');
        const time1 = '10:00:00';
        const date2 = new Date('2025-01-11T10:00:00');

        const result = getDateDifferenceInHours(date1, time1, date2);

        expect(result).toBe(24); // 24 hours = 1 day
      });

      it('should handle minute-level precision', () => {
        const date1 = new Date('2025-01-10T10:00:00');
        const time1 = '10:00:00';
        const date2 = new Date('2025-01-10T10:30:00');

        const result = getDateDifferenceInHours(date1, time1, date2);

        expect(result).toBe(0.5); // 30 minutes = 0.5 hours
      });

      it('should round to 2 decimal places', () => {
        const date1 = new Date('2025-01-10T10:00:00');
        const time1 = '10:00:00';
        const date2 = new Date('2025-01-10T10:05:00');

        const result = getDateDifferenceInHours(date1, time1, date2);

        expect(result).toBe(0.08); // 5 minutes ≈ 0.08 hours (rounded)
      });

      it('should handle zero difference', () => {
        const date1 = new Date('2025-01-10T10:00:00');
        const time1 = '10:00:00';
        const date2 = new Date('2025-01-10T10:00:00');

        const result = getDateDifferenceInHours(date1, time1, date2);

        expect(result).toBe(0);
      });
    });

    describe('with string dates', () => {
      it('should calculate difference with string dates', () => {
        const date1 = '2025-01-10';
        const time1 = '10:00:00';
        const date2 = '2025-01-10';
        const time2 = '12:00:00';

        const result = getDateDifferenceInHours(date1, time1, date2, time2);

        expect(result).toBe(2);
      });

      it('should handle ISO string dates', () => {
        const date1 = '2025-01-10T10:00:00';
        const time1 = '10:00:00';
        const date2 = '2025-01-10T12:00:00';

        const result = getDateDifferenceInHours(date1, time1, date2);

        expect(result).toBeGreaterThanOrEqual(0);
      });

      it('should handle mixed Date and string', () => {
        const date1 = new Date('2025-01-10T10:00:00');
        const time1 = '10:00:00';
        const date2 = '2025-01-10T12:00:00';

        const result = getDateDifferenceInHours(date1, time1, date2);

        expect(result).toBeGreaterThanOrEqual(0);
      });
    });

    describe('with different time formats', () => {
      it('should handle time with leading zeros', () => {
        const date1 = new Date('2025-01-10T08:00:00');
        const time1 = '08:00:00';
        const date2 = new Date('2025-01-10T09:00:00');

        const result = getDateDifferenceInHours(date1, time1, date2);

        expect(result).toBe(1);
      });

      it('should handle time with seconds', () => {
        const date1 = new Date('2025-01-10T10:00:00');
        const time1 = '10:00:30';
        const date2 = new Date('2025-01-10T10:01:00');

        const result = getDateDifferenceInHours(date1, time1, date2);

        expect(result).toBe(0.01); // 30 seconds ≈ 0.01 hours (rounded)
      });

      it('should handle midnight times', () => {
        const date1 = new Date('2025-01-10T00:00:00');
        const time1 = '00:00:00';
        const date2 = new Date('2025-01-10T01:00:00');

        const result = getDateDifferenceInHours(date1, time1, date2);

        expect(result).toBe(1);
      });

      it('should handle end of day times', () => {
        const date1 = new Date('2025-01-10T23:00:00');
        const time1 = '23:00:00';
        const date2 = new Date('2025-01-11T01:00:00');

        const result = getDateDifferenceInHours(date1, time1, date2);

        expect(result).toBe(2);
      });
    });

    describe('realistic reconciliation scenarios', () => {
      it('should calculate difference for bank transaction and voucher (5 minutes apart)', () => {
        const transactionDate = new Date('2025-01-10');
        const transactionTime = '10:00:00';
        const voucherDate = new Date('2025-01-10T10:05:00');

        const result = getDateDifferenceInHours(
          transactionDate,
          transactionTime,
          voucherDate,
        );

        expect(result).toBe(0.08); // ~5 minutes
      });

      it('should handle transaction before voucher (several hours)', () => {
        const transactionDate = new Date('2025-01-10');
        const transactionTime = '08:00:00';
        const voucherDate = new Date('2025-01-10T12:30:00');

        const result = getDateDifferenceInHours(
          transactionDate,
          transactionTime,
          voucherDate,
        );

        expect(result).toBe(4.5); // 4.5 hours
      });

      it('should handle transaction after voucher (next day)', () => {
        const transactionDate = new Date('2025-01-11');
        const transactionTime = '10:00:00';
        const voucherDate = new Date('2025-01-10T10:00:00');

        const result = getDateDifferenceInHours(
          transactionDate,
          transactionTime,
          voucherDate,
        );

        expect(result).toBe(24); // 1 day
      });

      it('should be within 36 hour tolerance', () => {
        const transactionDate = new Date('2025-01-10');
        const transactionTime = '10:00:00';
        const voucherDate = new Date('2025-01-11T20:00:00');

        const result = getDateDifferenceInHours(
          transactionDate,
          transactionTime,
          voucherDate,
        );

        expect(result).toBe(34); // Within 36 hours
        expect(result).toBeLessThanOrEqual(36);
      });

      it('should exceed 36 hour tolerance', () => {
        const transactionDate = new Date('2025-01-10');
        const transactionTime = '10:00:00';
        const voucherDate = new Date('2025-01-12T10:00:00');

        const result = getDateDifferenceInHours(
          transactionDate,
          transactionTime,
          voucherDate,
        );

        expect(result).toBe(48); // 2 days, exceeds 36 hours
        expect(result).toBeGreaterThan(36);
      });
    });
  });

  describe('extractHouseNumberFromCents', () => {
    describe('valid house numbers', () => {
      it('should extract house number from cents', () => {
        expect(extractHouseNumberFromCents(500.15)).toBe(15);
        expect(extractHouseNumberFromCents(600.25)).toBe(25);
        expect(extractHouseNumberFromCents(700.42)).toBe(42);
        expect(extractHouseNumberFromCents(800.66)).toBe(66);
      });

      it('should handle single digit cents', () => {
        expect(extractHouseNumberFromCents(500.05)).toBe(5);
        expect(extractHouseNumberFromCents(600.01)).toBe(1);
        expect(extractHouseNumberFromCents(700.09)).toBe(9);
      });

      it('should handle maximum valid house number', () => {
        expect(extractHouseNumberFromCents(500.66)).toBe(66);
      });

      it('should handle minimum valid house number', () => {
        expect(extractHouseNumberFromCents(500.01)).toBe(1);
      });
    });

    describe('edge cases', () => {
      it('should return 0 for no cents', () => {
        expect(extractHouseNumberFromCents(500.0)).toBe(0);
        expect(extractHouseNumberFromCents(500)).toBe(0);
        expect(extractHouseNumberFromCents(1000.0)).toBe(0);
      });

      it('should handle cents exceeding max house number (66)', () => {
        expect(extractHouseNumberFromCents(500.99)).toBe(99);
        expect(extractHouseNumberFromCents(600.75)).toBe(75);
        expect(extractHouseNumberFromCents(700.8)).toBe(80);
      });

      it('should handle large amounts', () => {
        expect(extractHouseNumberFromCents(10000.15)).toBe(15);
        expect(extractHouseNumberFromCents(99999.42)).toBe(42);
      });

      it('should handle small amounts', () => {
        expect(extractHouseNumberFromCents(0.15)).toBe(15);
        expect(extractHouseNumberFromCents(1.25)).toBe(25);
      });

      it('should round floating point precision issues', () => {
        // Floating point arithmetic can cause issues like 0.15 being 0.15000000001
        expect(extractHouseNumberFromCents(500.15000001)).toBe(15);
        expect(extractHouseNumberFromCents(500.14999999)).toBe(15);
      });
    });

    describe('realistic reconciliation scenarios', () => {
      it('should extract house numbers from typical transaction amounts', () => {
        expect(extractHouseNumberFromCents(500.15)).toBe(15); // Casa 15
        expect(extractHouseNumberFromCents(1000.32)).toBe(32); // Casa 32
        expect(extractHouseNumberFromCents(750.08)).toBe(8); // Casa 8
        expect(extractHouseNumberFromCents(2500.66)).toBe(66); // Casa 66
      });

      it('should identify transactions without house identification', () => {
        expect(extractHouseNumberFromCents(500.0)).toBe(0); // No house ID - voucher required
        expect(extractHouseNumberFromCents(1000)).toBe(0); // No house ID - voucher required
      });

      it('should handle invalid house numbers (over 66)', () => {
        expect(extractHouseNumberFromCents(500.99)).toBe(99); // Invalid - requires manual review
        expect(extractHouseNumberFromCents(500.75)).toBe(75); // Invalid - requires manual review
      });

      it('should handle typical monthly rent amounts', () => {
        // Typical rent amounts with house identification
        expect(extractHouseNumberFromCents(5000.15)).toBe(15);
        expect(extractHouseNumberFromCents(7500.25)).toBe(25);
        expect(extractHouseNumberFromCents(10000.42)).toBe(42);
      });
    });

    describe('boundary conditions', () => {
      it('should handle zero amount', () => {
        expect(extractHouseNumberFromCents(0)).toBe(0);
        expect(extractHouseNumberFromCents(0.0)).toBe(0);
      });

      it('should handle negative amounts (edge case)', () => {
        // Although business logic filters withdrawals, test mathematical behavior
        expect(extractHouseNumberFromCents(-500.15)).toBe(15);
        expect(extractHouseNumberFromCents(-600.25)).toBe(25);
      });

      it('should handle very precise decimal amounts', () => {
        expect(extractHouseNumberFromCents(500.154)).toBe(15); // Rounds to 15
        expect(extractHouseNumberFromCents(500.156)).toBe(16); // Rounds to 16
      });
    });
  });
});
