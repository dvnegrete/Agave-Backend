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
});
