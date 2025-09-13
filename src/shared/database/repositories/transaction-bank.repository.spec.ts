import { TransactionBankRepository } from './transaction-bank.repository';
import { Repository } from 'typeorm';
import { TransactionBank } from '../entities/transaction-bank.entity';

describe('TransactionBankRepository - Date Handling', () => {
  let repository: TransactionBankRepository;
  let mockTypeOrmRepository: Partial<Repository<TransactionBank>>;

  beforeEach(() => {
    mockTypeOrmRepository = {
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
      findOne: jest.fn(),
    };

    repository = new TransactionBankRepository(
      mockTypeOrmRepository as Repository<TransactionBank>,
    );
  });

  describe('date conversion handling', () => {
    it('should handle ISO date strings correctly to avoid timezone offset', async () => {
      const mockTransaction = {
        id: 'test-id',
        date: new Date(2025, 6, 31), // July 31, 2025 in local timezone
        time: '10:30:00',
        concept: 'TEST',
        amount: 100,
        currency: 'MXN',
        is_deposit: false,
        bank_name: 'Test Bank',
        confirmation_status: false,
      };

      (mockTypeOrmRepository.create as jest.Mock).mockReturnValue(mockTransaction);
      (mockTypeOrmRepository.save as jest.Mock).mockResolvedValue(mockTransaction);

      const inputData = {
        date: '2025-07-31', // ISO string format
        time: '10:30:00',
        concept: 'TEST',
        amount: 100,
        currency: 'MXN',
        is_deposit: false,
        bank_name: 'Test Bank',
        validation_flag: false,
      };

      await repository.create(inputData);

      // Verify that create was called with a Date object that represents July 31 in local timezone
      const createCall = (mockTypeOrmRepository.create as jest.Mock).mock.calls[0][0];
      const createdDate = createCall.date;

      expect(createdDate).toBeInstanceOf(Date);
      expect(createdDate.getFullYear()).toBe(2025);
      expect(createdDate.getMonth()).toBe(6); // July = 6 (0-indexed)
      expect(createdDate.getDate()).toBe(31);
      
      // Verify the date represents July 31 in local timezone, not UTC
      expect(createdDate.toLocaleDateString()).toContain('7/31/2025');
    });

    it('should handle multiple transactions with ISO date strings correctly', async () => {
      const mockTransactions = [
        { id: '1', date: new Date(2025, 6, 31) },
        { id: '2', date: new Date(2025, 0, 15) },
      ];

      (mockTypeOrmRepository.create as jest.Mock)
        .mockReturnValueOnce(mockTransactions[0])
        .mockReturnValueOnce(mockTransactions[1]);
      (mockTypeOrmRepository.save as jest.Mock).mockResolvedValue(mockTransactions);

      const inputData = [
        {
          date: '2025-07-31',
          time: '10:30:00',
          concept: 'TEST 1',
          amount: 100,
          currency: 'MXN',
          is_deposit: false,
          bank_name: 'Test Bank',
          validation_flag: false,
        },
        {
          date: '2025-01-15',
          time: '14:30:00',
          concept: 'TEST 2',
          amount: 200,
          currency: 'MXN',
          is_deposit: true,
          bank_name: 'Test Bank',
          validation_flag: false,
        },
      ];

      await repository.createMany(inputData);

      // Verify both dates were converted correctly
      const createCalls = (mockTypeOrmRepository.create as jest.Mock).mock.calls;
      
      const firstDate = createCalls[0][0].date;
      expect(firstDate.getFullYear()).toBe(2025);
      expect(firstDate.getMonth()).toBe(6); // July
      expect(firstDate.getDate()).toBe(31);
      
      const secondDate = createCalls[1][0].date;
      expect(secondDate.getFullYear()).toBe(2025);
      expect(secondDate.getMonth()).toBe(0); // January
      expect(secondDate.getDate()).toBe(15);
    });

    it('should handle non-ISO date formats normally', async () => {
      const inputDate = new Date(2025, 6, 31);
      const mockTransaction = {
        id: 'test-id',
        date: inputDate,
      };

      (mockTypeOrmRepository.create as jest.Mock).mockReturnValue(mockTransaction);
      (mockTypeOrmRepository.save as jest.Mock).mockResolvedValue(mockTransaction);

      const inputData = {
        date: inputDate.toISOString().split('T')[0], // Convert to string for DTO
        time: '10:30:00',
        concept: 'TEST',
        amount: 100,
        currency: 'MXN',
        is_deposit: false,
        bank_name: 'Test Bank',
        validation_flag: false,
      };

      await repository.create(inputData);

      const createCall = (mockTypeOrmRepository.create as jest.Mock).mock.calls[0][0];
      // Since we convert the ISO string to local date, check that the date components match
      expect(createCall.date.getFullYear()).toBe(inputDate.getFullYear());
      expect(createCall.date.getMonth()).toBe(inputDate.getMonth());
      expect(createCall.date.getDate()).toBe(inputDate.getDate());
    });

    it('should handle update operations with ISO date strings correctly', async () => {
      const mockUpdatedTransaction = {
        id: 'test-id',
        date: new Date(2025, 6, 31),
      };

      (mockTypeOrmRepository.update as jest.Mock).mockResolvedValue(undefined);
      (mockTypeOrmRepository.findOne as jest.Mock).mockResolvedValue(mockUpdatedTransaction);

      const updateData = {
        date: '2025-07-31', // ISO string
        concept: 'UPDATED CONCEPT',
      };

      await repository.update('test-id', updateData);

      // Verify update was called with properly converted date
      const updateCall = (mockTypeOrmRepository.update as jest.Mock).mock.calls[0][1];
      const updatedDate = updateCall.date;

      expect(updatedDate).toBeInstanceOf(Date);
      expect(updatedDate.getFullYear()).toBe(2025);
      expect(updatedDate.getMonth()).toBe(6); // July
      expect(updatedDate.getDate()).toBe(31);
    });

    it('should preserve timezone for edge case dates', async () => {
      // Test dates that are prone to timezone issues
      const edgeCases = [
        '2025-02-28', // February 28
        '2024-02-29', // February 29 (leap year)
        '2025-12-31', // December 31
        '2025-01-01', // January 1
      ];

      for (const dateString of edgeCases) {
        const mockTransaction = { id: 'test', date: new Date() };
        (mockTypeOrmRepository.create as jest.Mock).mockReturnValue(mockTransaction);
        (mockTypeOrmRepository.save as jest.Mock).mockResolvedValue(mockTransaction);

        const inputData = {
          date: dateString,
          time: '10:30:00',
          concept: 'TEST',
          amount: 100,
          currency: 'MXN',
          is_deposit: false,
          bank_name: 'Test Bank',
          validation_flag: false,
        };

        await repository.create(inputData);

        const createCall = (mockTypeOrmRepository.create as jest.Mock).mock.calls.slice(-1)[0][0];
        const createdDate = createCall.date;
        
        const [year, month, day] = dateString.split('-').map(Number);
        expect(createdDate.getFullYear()).toBe(year);
        expect(createdDate.getMonth()).toBe(month - 1); // month is 0-indexed
        expect(createdDate.getDate()).toBe(day);
      }
    });
  });
});