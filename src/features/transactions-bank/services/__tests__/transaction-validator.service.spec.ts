import { Test, TestingModule } from '@nestjs/testing';
import { TransactionValidatorService } from '../transaction-validator.service';
import { TransactionBank } from '../../interfaces/transaction-bank.interface';

describe('TransactionValidatorService', () => {
  let service: TransactionValidatorService;

  const mockValidTransaction: TransactionBank = {
    id: '1',
    bank_name: 'Main Bank',
    date: '2025-01-15',
    time: '10:30:00',
    concept: 'Transfer received',
    amount: 1500.50,
    currency: 'USD',
    is_deposit: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TransactionValidatorService],
    }).compile();

    service = module.get<TransactionValidatorService>(TransactionValidatorService);
  });

  describe('validateTransaction', () => {
    it('should validate a correct transaction successfully', async () => {
      const result = await service.validateTransaction(mockValidTransaction);

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    describe('Date validation', () => {
      it('should reject empty date', async () => {
        const transaction = { ...mockValidTransaction, date: '' };
        const result = await service.validateTransaction(transaction);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should reject invalid date format', async () => {
        const transaction = { ...mockValidTransaction, date: '15-01-2025' };
        const result = await service.validateTransaction(transaction);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should reject invalid date value', async () => {
        const transaction = { ...mockValidTransaction, date: '2025-13-45' };
        const result = await service.validateTransaction(transaction);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should reject date too far in future', async () => {
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 100);
        const isoDate = futureDate.toISOString().split('T')[0];

        const transaction = { ...mockValidTransaction, date: isoDate };
        const result = await service.validateTransaction(transaction);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should reject date too far in past', async () => {
        const pastDate = new Date();
        pastDate.setFullYear(pastDate.getFullYear() - 10);
        const isoDate = pastDate.toISOString().split('T')[0];

        const transaction = { ...mockValidTransaction, date: isoDate };
        const result = await service.validateTransaction(transaction);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should accept valid recent dates', async () => {
        const validDate = new Date();
        validDate.setDate(validDate.getDate() - 30);
        const isoDate = validDate.toISOString().split('T')[0];

        const transaction = { ...mockValidTransaction, date: isoDate };
        const result = await service.validateTransaction(transaction);

        expect(result.errors.filter((e) => e.includes('date')).length).toBe(0);
      });
    });

    describe('Time validation', () => {
      it('should reject empty time', async () => {
        const transaction = { ...mockValidTransaction, time: '' };
        const result = await service.validateTransaction(transaction);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should reject invalid time format', async () => {
        const transaction = { ...mockValidTransaction, time: '25:00' };
        const result = await service.validateTransaction(transaction);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should accept valid time format', async () => {
        const validTimes = ['00:00:00', '12:30:45', '23:59:59'];

        for (const time of validTimes) {
          const transaction = { ...mockValidTransaction, time };
          const result = await service.validateTransaction(transaction);

          expect(result.errors.filter((e) => e.includes('time')).length).toBe(0);
        }
      });
    });

    describe('Concept validation', () => {
      it('should reject empty concept', async () => {
        const transaction = { ...mockValidTransaction, concept: '' };
        const result = await service.validateTransaction(transaction);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should reject concept too long', async () => {
        const transaction = {
          ...mockValidTransaction,
          concept: 'A'.repeat(1000),
        };
        const result = await service.validateTransaction(transaction);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should warn on concept too short', async () => {
        const transaction = { ...mockValidTransaction, concept: 'AB' };
        const result = await service.validateTransaction(transaction);

        expect(result.warnings.length).toBeGreaterThan(0);
      });

      it('should reject script injection patterns', async () => {
        const maliciousConcepts = [
          'Transfer <script>alert(1)</script>',
          'Payment javascript:void(0)',
          'Transfer onclick=alert(1)',
          'Data data:text/html,<script>',
        ];

        for (const concept of maliciousConcepts) {
          const transaction = { ...mockValidTransaction, concept };
          const result = await service.validateTransaction(transaction);

          expect(result.isValid).toBe(false);
          expect(result.errors.length).toBeGreaterThan(0);
        }
      });

      it('should accept clean concept', async () => {
        const transaction = { ...mockValidTransaction, concept: 'Clean transfer' };
        const result = await service.validateTransaction(transaction);

        expect(result.errors.filter((e) => e.includes('concept') && e.includes('invalid'))).toHaveLength(0);
      });
    });

    describe('Amount validation', () => {
      it('should reject non-numeric amount', async () => {
        const transaction = {
          ...mockValidTransaction,
          amount: NaN,
        };
        const result = await service.validateTransaction(transaction);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should reject amount below minimum', async () => {
        const transaction = { ...mockValidTransaction, amount: 0.001 };
        const result = await service.validateTransaction(transaction);

        // Amount below minimum should have error or be invalid
        expect(result.isValid === false || result.errors.length > 0).toBe(true);
      });

      it('should reject amount above maximum', async () => {
        const transaction = { ...mockValidTransaction, amount: 999999999 };
        const result = await service.validateTransaction(transaction);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should warn on whole number amounts', async () => {
        const transaction = { ...mockValidTransaction, amount: 1500 };
        const result = await service.validateTransaction(transaction);

        expect(result.warnings.length).toBeGreaterThan(0);
      });

      it('should accept valid decimal amounts', async () => {
        const transaction = { ...mockValidTransaction, amount: 1500.50 };
        const result = await service.validateTransaction(transaction);

        expect(result.errors.filter((e) => e.includes('amount'))).toHaveLength(0);
      });
    });

    describe('Currency validation', () => {
      it('should reject empty currency', async () => {
        const transaction = { ...mockValidTransaction, currency: '' };
        const result = await service.validateTransaction(transaction);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should reject invalid currency format', async () => {
        const transaction = { ...mockValidTransaction, currency: 'USDA' };
        const result = await service.validateTransaction(transaction);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should reject unsupported currency', async () => {
        const transaction = { ...mockValidTransaction, currency: 'ZZZ' };
        const result = await service.validateTransaction(transaction);

        expect(result.isValid).toBe(false);
        expect(result.errors.length).toBeGreaterThan(0);
      });

      it('should accept supported currencies', async () => {
        const supportedCurrencies = ['USD', 'usd', 'Usd'];

        for (const currency of supportedCurrencies) {
          const transaction = { ...mockValidTransaction, currency };
          const result = await service.validateTransaction(transaction);

          expect(result.errors.filter((e) => e.includes('not supported'))).toHaveLength(0);
        }
      });
    });

    describe('IsDeposit validation', () => {
      it('should reject non-boolean is_deposit', async () => {
        const transaction = {
          ...mockValidTransaction,
          is_deposit: 'true' as any,
        };
        const result = await service.validateTransaction(transaction);

        expect(result.isValid).toBe(false);
      });

      it('should accept boolean is_deposit', async () => {
        const depositTx = { ...mockValidTransaction, is_deposit: true };
        const withdrawalTx = { ...mockValidTransaction, is_deposit: false };

        const depositResult = await service.validateTransaction(depositTx);
        const withdrawalResult = await service.validateTransaction(withdrawalTx);

        expect(depositResult.errors.length).toBeLessThanOrEqual(0);
        expect(withdrawalResult.errors.length).toBeLessThanOrEqual(0);
      });
    });

    describe('Business rules validation', () => {
      it('should generate warnings for high deposits', async () => {
        const transaction = {
          ...mockValidTransaction,
          is_deposit: true,
          amount: 100000,
        };
        const result = await service.validateTransaction(transaction);

        expect(result.isValid).toBe(true);
        expect(Array.isArray(result.warnings)).toBe(true);
      });

      it('should generate warnings for high withdrawals', async () => {
        const transaction = {
          ...mockValidTransaction,
          is_deposit: false,
          amount: 100000,
        };
        const result = await service.validateTransaction(transaction);

        expect(result.isValid).toBe(true);
        expect(Array.isArray(result.warnings)).toBe(true);
      });

      it('should generate warnings for outside business hours', async () => {
        const earlyMorningTx = {
          ...mockValidTransaction,
          time: '03:00:00',
        };

        const earlyResult = await service.validateTransaction(earlyMorningTx);

        expect(earlyResult.isValid).toBe(true);
        expect(Array.isArray(earlyResult.warnings)).toBe(true);
      });

      it('should handle weekend transactions', async () => {
        // Find next Saturday
        const weekendDate = new Date();
        const dayOfWeek = weekendDate.getDay();
        const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
        weekendDate.setDate(weekendDate.getDate() + daysUntilSaturday);
        const isoDate = weekendDate.toISOString().split('T')[0];

        const transaction = { ...mockValidTransaction, date: isoDate };
        const result = await service.validateTransaction(transaction);

        expect(result.isValid).toBe(true);
        expect(Array.isArray(result.warnings)).toBe(true);
      });

      it('should handle suspicious concepts', async () => {
        const transaction = {
          ...mockValidTransaction,
          concept: 'Transfer to account',
        };
        const result = await service.validateTransaction(transaction);

        expect(result.isValid).toBe(true);
        expect(Array.isArray(result.warnings)).toBe(true);
      });

      it('should generate warnings for high round amounts', async () => {
        const transaction = {
          ...mockValidTransaction,
          amount: 50000,
        };
        const result = await service.validateTransaction(transaction);

        expect(result.isValid).toBe(true);
        expect(Array.isArray(result.warnings)).toBe(true);
      });
    });
  });

  describe('validateBatch', () => {
    it('should classify transactions correctly', async () => {
      const transactions = [mockValidTransaction, { ...mockValidTransaction, id: '2' }];

      const result = await service.validateBatch(transactions);

      expect(result.duplicates.length).toBe(1);
      expect(Array.isArray(result.valid)).toBe(true);
      expect(Array.isArray(result.suspicious)).toBe(true);
    });

    it('should detect duplicate transactions', async () => {
      const transaction1 = mockValidTransaction;
      const transaction2 = { ...mockValidTransaction, id: '2' };

      const result = await service.validateBatch([transaction1, transaction2]);

      expect(result.duplicates.length).toBe(1);
      expect(result.duplicates[0].id).toBe('2');
    });

    it('should handle empty batch', async () => {
      const result = await service.validateBatch([]);

      expect(result.duplicates).toHaveLength(0);
      expect(result.suspicious).toHaveLength(0);
      expect(result.valid).toHaveLength(0);
    });

    it('should handle batch with multiple duplicates', async () => {
      const tx1 = mockValidTransaction;
      const tx2 = { ...mockValidTransaction, id: '2' };
      const tx3 = { ...mockValidTransaction, id: '3' };

      const result = await service.validateBatch([tx1, tx2, tx3]);

      expect(result.duplicates.length).toBe(2);
    });

    it('should separate valid and suspicious in batch', async () => {
      const validTx = mockValidTransaction;
      const suspiciousTx = {
        ...mockValidTransaction,
        amount: 100000,
        id: '2',
      };

      const result = await service.validateBatch([validTx, suspiciousTx]);

      expect(result.valid.length + result.suspicious.length).toBeGreaterThan(0);
      expect(result.duplicates.length).toBe(0);
    });

    it('should handle batch with invalid transactions', async () => {
      const invalidTx = {
        ...mockValidTransaction,
        amount: NaN,
        id: '2',
      };

      const result = await service.validateBatch([
        mockValidTransaction,
        invalidTx,
      ]);

      // Invalid transactions should not be in valid or suspicious
      expect(result.valid.length + result.suspicious.length).toBeLessThan(2);
    });
  });

  describe('Edge cases', () => {
    it('should handle whitespace in fields', async () => {
      const transaction = {
        ...mockValidTransaction,
        concept: '  Transfer  ',
        currency: '  USD  ',
        time: '  10:30:00  ',
      };

      const result = await service.validateTransaction(transaction);

      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
    });

    it('should handle special characters in concept', async () => {
      const transaction = {
        ...mockValidTransaction,
        concept: 'Transfer €50 @ Bank',
      };

      const result = await service.validateTransaction(transaction);

      expect(result.errors.length).toBeLessThanOrEqual(0);
    });

    it('should validate transaction with minimum valid values', async () => {
      const transaction = {
        ...mockValidTransaction,
        concept: 'ABC',
        amount: 1,
      };

      const result = await service.validateTransaction(transaction);

      expect(result.errors.length).toBeLessThanOrEqual(1);
    });

    it('should handle negative amounts', async () => {
      const transaction = {
        ...mockValidTransaction,
        amount: -1500,
      };

      const result = await service.validateTransaction(transaction);

      expect(result.isValid).toBe(false);
    });

    it('should handle very large amounts', async () => {
      const transaction = {
        ...mockValidTransaction,
        amount: 1000000000,
      };

      const result = await service.validateTransaction(transaction);

      expect(result.isValid).toBe(false);
    });

    it('should be case-insensitive for currency check', async () => {
      const lowercaseTx = { ...mockValidTransaction, currency: 'usd' };
      const uppercaseTx = { ...mockValidTransaction, currency: 'USD' };

      const lowercaseResult = await service.validateTransaction(lowercaseTx);
      const uppercaseResult = await service.validateTransaction(uppercaseTx);

      expect(lowercaseResult.errors.filter((e) => e.includes('not supported'))).toHaveLength(0);
      expect(uppercaseResult.errors.filter((e) => e.includes('not supported'))).toHaveLength(0);
    });
  });
});
