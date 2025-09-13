import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsBankService } from './transactions-bank.service';
import { FileProcessorService } from './file-processor.service';
import { TransactionValidatorService } from './transaction-validator.service';
import { TransactionBankRepository } from '../../../shared/database/repositories/transaction-bank.repository';
import { LastTransactionBankRepository } from '../../../shared/database/repositories/last-transaction-bank.repository';

describe('TransactionsBankService', () => {
  let service: TransactionsBankService;
  let mockFileProcessor: Partial<FileProcessorService>;
  let mockValidator: Partial<TransactionValidatorService>;
  let mockTransactionRepo: Partial<TransactionBankRepository>;
  let mockLastTransactionRepo: Partial<LastTransactionBankRepository>;

  beforeEach(async () => {
    mockFileProcessor = {
      parseFile: jest.fn(),
    };
    mockValidator = {
      validateTransaction: jest.fn(),
    };
    mockTransactionRepo = {
      createMany: jest.fn(),
      findAll: jest.fn(),
      findById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByStatus: jest.fn(),
      findByDateRange: jest.fn(),
      getTransactionSummary: jest.fn(),
      findTransactionsByDateAndBank: jest.fn(),
    };
    mockLastTransactionRepo = {
      create: jest.fn(),
      findLatest: jest.fn(),
      findRecent: jest.fn(),
      findByTransactionId: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsBankService,
        {
          provide: FileProcessorService,
          useValue: mockFileProcessor,
        },
        {
          provide: TransactionValidatorService,
          useValue: mockValidator,
        },
        {
          provide: TransactionBankRepository,
          useValue: mockTransactionRepo,
        },
        {
          provide: LastTransactionBankRepository,
          useValue: mockLastTransactionRepo,
        },
      ],
    }).compile();

    service = module.get<TransactionsBankService>(TransactionsBankService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('findLatestTransaction', () => {
    it('should find the transaction with the latest date and time', () => {
      const transactions = [
        {
          id: '1',
          date: new Date('2025-01-15T00:00:00.000Z'),
          time: '10:30:00',
          concept: 'Transaction 1',
          amount: 100,
        },
        {
          id: '2',
          date: new Date('2025-01-15T00:00:00.000Z'),
          time: '14:45:00',
          concept: 'Transaction 2',
          amount: 200,
        },
        {
          id: '3',
          date: new Date('2025-01-14T00:00:00.000Z'),
          time: '16:00:00',
          concept: 'Transaction 3',
          amount: 300,
        },
      ];

      // Usando reflexión para acceder al método privado
      const result = (service as any).findLatestTransaction(transactions);

      expect(result.id).toBe('2'); // La transacción del 15 de enero a las 14:45
    });

    it('should handle transactions on different dates', () => {
      const transactions = [
        {
          id: '1',
          date: new Date('2025-01-15T00:00:00.000Z'),
          time: '10:30:00',
          concept: 'Transaction 1',
          amount: 100,
        },
        {
          id: '2',
          date: new Date('2025-01-16T00:00:00.000Z'),
          time: '09:00:00',
          concept: 'Transaction 2',
          amount: 200,
        },
      ];

      const result = (service as any).findLatestTransaction(transactions);

      expect(result.id).toBe('2'); // La transacción más reciente por fecha
    });

    it('should return null for empty array', () => {
      const result = (service as any).findLatestTransaction([]);
      expect(result).toBeNull();
    });

    it('should return null for null/undefined input', () => {
      expect((service as any).findLatestTransaction(null)).toBeNull();
      expect((service as any).findLatestTransaction(undefined)).toBeNull();
    });
  });

  describe('combineDateAndTime', () => {
    it('should combine date and time correctly', () => {
      const date = new Date('2025-01-15T00:00:00.000Z');
      const time = '14:30:25';

      const result = (service as any).combineDateAndTime(date, time);

      expect(result.getFullYear()).toBe(2025);
      expect(result.getMonth()).toBe(0); // Enero = 0
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
      expect(result.getSeconds()).toBe(25);
    });

    it('should handle string dates', () => {
      const date = '2025-01-15T00:00:00.000Z';
      const time = '09:15:10';

      const result = (service as any).combineDateAndTime(date, time);

      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(15);
      expect(result.getSeconds()).toBe(10);
    });

    it('should handle incomplete time formats', () => {
      const date = new Date('2025-01-15T00:00:00.000Z');
      const time = '14:30'; // Sin segundos

      const result = (service as any).combineDateAndTime(date, time);

      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
      expect(result.getSeconds()).toBe(0);
    });
  });

  describe('isTransactionAfterLastProcessed', () => {
    it('should return true when no last processed transaction exists', () => {
      const transaction = {
        date: '2025-01-15',
        time: '10:30:00',
        concept: 'Test Transaction',
        amount: 100,
        currency: 'MXN',
        is_deposit: false,
        bank_name: 'Test Bank',
      };

      const result = (service as any).isTransactionAfterLastProcessed(transaction, null, 'Santander');
      expect(result).toBe(true);
    });

    it('should return true when transaction is on same day or after last processed (same bank)', () => {
      const transaction = {
        date: '2025-01-15',
        time: '14:30:00',
        concept: 'New Transaction',
        amount: 100,
        currency: 'MXN',
        is_deposit: false,
        bank_name: 'Santander',
      };

      const lastProcessed = {
        date: new Date('2025-01-15T00:00:00.000Z'),
        time: '10:00:00',
        concept: 'Previous Transaction',
        bank_name: 'Santander',
      };

      const result = (service as any).isTransactionAfterLastProcessed(transaction, lastProcessed, 'Santander');
      expect(result).toBe(true);
    });

    it('should return false when transaction is before last processed date (same bank)', () => {
      const transaction = {
        date: '2025-01-14',
        time: '10:00:00',
        concept: 'Old Transaction',
        amount: 100,
        currency: 'MXN',
        is_deposit: false,
        bank_name: 'Santander',
      };

      const lastProcessed = {
        date: new Date('2025-01-15T00:00:00.000Z'),
        time: '14:30:00',
        concept: 'Last Processed Transaction',
        bank_name: 'Santander',
      };

      const result = (service as any).isTransactionAfterLastProcessed(transaction, lastProcessed, 'Santander');
      expect(result).toBe(false);
    });

    it('should return true when transaction has same date as last processed (same bank)', () => {
      const transaction = {
        date: '2025-01-15',
        time: '10:30:00',
        concept: 'Same Date Transaction',
        amount: 100,
        currency: 'MXN',
        is_deposit: false,
        bank_name: 'Santander',
      };

      const lastProcessed = {
        date: new Date('2025-01-15T00:00:00.000Z'),
        time: '10:30:00',
        concept: 'Last Processed Transaction',
        bank_name: 'Santander',
      };

      const result = (service as any).isTransactionAfterLastProcessed(transaction, lastProcessed, 'Santander');
      expect(result).toBe(true);
    });

    it('should handle different dates correctly (same bank)', () => {
      const transaction = {
        date: '2025-01-16',
        time: '09:00:00',
        concept: 'Next Day Transaction',
        amount: 100,
        currency: 'MXN',
        is_deposit: false,
        bank_name: 'Santander',
      };

      const lastProcessed = {
        date: new Date('2025-01-15T00:00:00.000Z'),
        time: '23:59:59',
        concept: 'Previous Day Transaction',
        bank_name: 'Santander',
      };

      const result = (service as any).isTransactionAfterLastProcessed(transaction, lastProcessed, 'Santander');
      expect(result).toBe(true);
    });

    it('should return true when bank name is different', () => {
      const transaction = {
        date: '2025-01-15',
        time: '10:00:00',
        concept: 'Different Bank Transaction',
        amount: 100,
        currency: 'MXN',
        is_deposit: false,
        bank_name: 'BBVA',
      };

      const lastProcessed = {
        date: new Date('2025-01-15T00:00:00.000Z'),
        time: '14:30:00',
        concept: 'Last Processed Transaction',
        bank_name: 'Santander',
      };

      const result = (service as any).isTransactionAfterLastProcessed(transaction, lastProcessed, 'BBVA');
      expect(result).toBe(true);
    });

    it('should return true when current bank is empty and last processed has bank', () => {
      const transaction = {
        date: '2025-01-15',
        time: '10:00:00',
        concept: 'No Bank Transaction',
        amount: 100,
        currency: 'MXN',
        is_deposit: false,
        bank_name: '',
      };

      const lastProcessed = {
        date: new Date('2025-01-15T00:00:00.000Z'),
        time: '14:30:00',
        concept: 'Last Processed Transaction',
        bank_name: 'Santander',
      };

      const result = (service as any).isTransactionAfterLastProcessed(transaction, lastProcessed, '');
      expect(result).toBe(true);
    });

    it('should return true when last processed bank is empty and current has bank', () => {
      const transaction = {
        date: '2025-01-15',
        time: '10:00:00',
        concept: 'Current Bank Transaction',
        amount: 100,
        currency: 'MXN',
        is_deposit: false,
        bank_name: 'Banorte',
      };

      const lastProcessed = {
        date: new Date('2025-01-15T00:00:00.000Z'),
        time: '14:30:00',
        concept: 'Last Processed Transaction',
        bank_name: '',
      };

      const result = (service as any).isTransactionAfterLastProcessed(transaction, lastProcessed, 'Banorte');
      expect(result).toBe(true);
    });

    it('should return true on error to avoid losing data', () => {
      const transaction = {
        date: 'invalid-date',
        time: 'invalid-time',
        concept: 'Invalid Transaction',
        amount: 100,
        currency: 'MXN',
        is_deposit: false,
        bank_name: 'Test Bank',
      };

      const lastProcessed = {
        date: 'invalid-date-too',
        time: '10:30:00',
        concept: 'Valid Transaction',
        bank_name: 'Test Bank',
      };

      const result = (service as any).isTransactionAfterLastProcessed(transaction, lastProcessed, 'Test Bank');
      expect(result).toBe(true);
    });
  });

  describe('getReferenceTransactionForBank', () => {
    it('should find matching bank in recent records', async () => {
      const recentRecords = [
        {
          transactionBank: {
            id: '1',
            bank_name: 'BBVA',
            date: new Date('2025-01-15T00:00:00.000Z'),
            time: '10:00:00',
          },
        },
        {
          transactionBank: {
            id: '2',
            bank_name: 'Santander',
            date: new Date('2025-01-14T00:00:00.000Z'),
            time: '15:00:00',
          },
        },
        {
          transactionBank: {
            id: '3',
            bank_name: 'Banorte',
            date: new Date('2025-01-13T00:00:00.000Z'),
            time: '12:00:00',
          },
        },
      ];

      (mockLastTransactionRepo.findRecent as jest.Mock).mockResolvedValue(recentRecords);

      const result = await (service as any).getReferenceTransactionForBank('Santander');

      expect(mockLastTransactionRepo.findRecent).toHaveBeenCalledWith(7);
      expect(result.id).toBe('2');
      expect(result.bank_name).toBe('Santander');
    });

    it('should return most recent when no matching bank found', async () => {
      const recentRecords = [
        {
          transactionBank: {
            id: '1',
            bank_name: 'BBVA',
            date: new Date('2025-01-15T00:00:00.000Z'),
            time: '10:00:00',
          },
        },
        {
          transactionBank: {
            id: '2',
            bank_name: 'Banorte',
            date: new Date('2025-01-14T00:00:00.000Z'),
            time: '15:00:00',
          },
        },
      ];

      (mockLastTransactionRepo.findRecent as jest.Mock).mockResolvedValue(recentRecords);

      const result = await (service as any).getReferenceTransactionForBank('Santander');

      expect(result.id).toBe('1'); // Should return the most recent
      expect(result.bank_name).toBe('BBVA');
    });

    it('should return null when no records exist', async () => {
      (mockLastTransactionRepo.findRecent as jest.Mock).mockResolvedValue([]);

      const result = await (service as any).getReferenceTransactionForBank('Santander');

      expect(result).toBeNull();
    });

    it('should return null on error', async () => {
      (mockLastTransactionRepo.findRecent as jest.Mock).mockRejectedValue(new Error('Database error'));

      const result = await (service as any).getReferenceTransactionForBank('Santander');

      expect(result).toBeNull();
    });

    it('should find bank match in position other than first', async () => {
      const recentRecords = [
        {
          transactionBank: {
            id: '1',
            bank_name: 'BBVA',
            date: new Date('2025-01-15T00:00:00.000Z'),
            time: '10:00:00',
          },
        },
        {
          transactionBank: {
            id: '2',
            bank_name: 'Banorte',
            date: new Date('2025-01-14T00:00:00.000Z'),
            time: '15:00:00',
          },
        },
        {
          transactionBank: {
            id: '3',
            bank_name: 'Santander',
            date: new Date('2025-01-13T00:00:00.000Z'),
            time: '12:00:00',
          },
        },
        {
          transactionBank: {
            id: '4',
            bank_name: 'HSBC',
            date: new Date('2025-01-12T00:00:00.000Z'),
            time: '09:00:00',
          },
        },
      ];

      (mockLastTransactionRepo.findRecent as jest.Mock).mockResolvedValue(recentRecords);

      const result = await (service as any).getReferenceTransactionForBank('Santander');

      expect(result.id).toBe('3');
      expect(result.bank_name).toBe('Santander');
    });

    it('should handle records without transactionBank', async () => {
      const recentRecords = [
        {
          transactionBank: null,
        },
        {
          transactionBank: {
            id: '2',
            bank_name: 'Santander',
            date: new Date('2025-01-14T00:00:00.000Z'),
            time: '15:00:00',
          },
        },
      ];

      (mockLastTransactionRepo.findRecent as jest.Mock).mockResolvedValue(recentRecords);

      const result = await (service as any).getReferenceTransactionForBank('Santander');

      expect(result.id).toBe('2');
      expect(result.bank_name).toBe('Santander');
    });
  });

  describe('isDuplicateInFile', () => {
    it('should detect duplicate in file with exact match', () => {
      const transaction = {
        date: '2025-01-15',
        time: '10:30:00',
        concept: 'PAGO SERVICIOS',
        amount: 100.25,
        currency: 'MXN',
        is_deposit: false,
        bank_name: 'Santander',
      };

      const fileTransactions = [
        {
          date: '2025-01-15',
          time: '10:30:00',
          concept: 'PAGO SERVICIOS',
          amount: 100.25,
          currency: 'MXN',
          is_deposit: false,
          bank_name: 'Santander',
        },
      ];

      const result = (service as any).isDuplicateInFile(transaction, fileTransactions);
      expect(result).toBe(true);
    });

    it('should not detect duplicate when time is different', () => {
      const transaction = {
        date: '2025-01-15',
        time: '10:30:00',
        concept: 'PAGO SERVICIOS',
        amount: 100.25,
        bank_name: 'Santander',
      };

      const fileTransactions = [
        {
          date: '2025-01-15',
          time: '11:30:00', // Different time
          concept: 'PAGO SERVICIOS',
          amount: 100.25,
          bank_name: 'Santander',
        },
      ];

      const result = (service as any).isDuplicateInFile(transaction, fileTransactions);
      expect(result).toBe(false);
    });

    it('should not detect duplicate when amount has small difference', () => {
      const transaction = {
        date: '2025-01-15',
        time: '10:30:00',
        concept: 'PAGO SERVICIOS',
        amount: 100.25,
        bank_name: 'Santander',
      };

      const fileTransactions = [
        {
          date: '2025-01-15',
          time: '10:30:00',
          concept: 'PAGO SERVICIOS',
          amount: 100.26, // Different amount
          bank_name: 'Santander',
        },
      ];

      const result = (service as any).isDuplicateInFile(transaction, fileTransactions);
      expect(result).toBe(false);
    });
  });

  describe('isDuplicateInDatabase', () => {
    it('should detect duplicate in database with exact match', () => {
      const transaction = {
        date: '2025-01-15',
        time: '10:30:00',
        concept: 'PAGO SERVICIOS',
        amount: 100.25,
        bank_name: 'Santander',
      };

      const dbTransactions = [
        {
          date: new Date('2025-01-15T00:00:00.000Z'),
          time: '10:30:00',
          concept: 'PAGO SERVICIOS',
          amount: 100.25,
          bank_name: 'Santander',
        },
      ];

      const result = (service as any).isDuplicateInDatabase(transaction, dbTransactions, 'Santander');
      expect(result).toBe(true);
    });

    it('should not detect duplicate when concept is different', () => {
      const transaction = {
        date: '2025-01-15',
        time: '10:30:00',
        concept: 'PAGO SERVICIOS',
        amount: 100.25,
        bank_name: 'Santander',
      };

      const dbTransactions = [
        {
          date: new Date('2025-01-15T00:00:00.000Z'),
          time: '10:30:00',
          concept: 'DIFFERENT CONCEPT',
          amount: 100.25,
          bank_name: 'Santander',
        },
      ];

      const result = (service as any).isDuplicateInDatabase(transaction, dbTransactions, 'Santander');
      expect(result).toBe(false);
    });

    it('should return false when no database transactions exist', () => {
      const transaction = {
        date: '2025-01-15',
        time: '10:30:00',
        concept: 'PAGO SERVICIOS',
        amount: 100.25,
        bank_name: 'Santander',
      };

      const result = (service as any).isDuplicateInDatabase(transaction, [], 'Santander');
      expect(result).toBe(false);
    });

    it('should return false on error to avoid data loss', () => {
      const transaction = {
        date: 'invalid-date',
        time: '10:30:00',
        concept: 'PAGO SERVICIOS',
        amount: 100,
        bank_name: 'Santander',
      };

      const dbTransactions = [
        {
          date: new Date('2025-01-15T00:00:00.000Z'),
          time: '10:30:00',
          concept: 'PAGO SERVICIOS',
          amount: 100,
          bank_name: 'Santander',
        },
      ];

      const result = (service as any).isDuplicateInDatabase(transaction, dbTransactions, 'Santander');
      expect(result).toBe(false);
    });
  });
});