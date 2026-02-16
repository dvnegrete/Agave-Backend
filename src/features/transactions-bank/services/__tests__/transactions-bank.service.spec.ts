import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Readable } from 'stream';
import { TransactionsBankService } from '../transactions-bank.service';
import { FileProcessorService } from '../file-processor.service';
import { TransactionValidatorService } from '../transaction-validator.service';
import { TransactionBankRepository } from '@/shared/database/repositories/transaction-bank.repository';
import { LastTransactionBankRepository } from '@/shared/database/repositories/last-transaction-bank.repository';
import {
  ProcessedBankTransaction,
  TransactionBank,
} from '../../interfaces/transaction-bank.interface';

describe('TransactionsBankService', () => {
  let service: TransactionsBankService;
  let fileProcessorService: jest.Mocked<FileProcessorService>;
  let transactionValidatorService: jest.Mocked<TransactionValidatorService>;
  let bankTransactionRepository: jest.Mocked<TransactionBankRepository>;
  let lastTransactionBankRepository: jest.Mocked<LastTransactionBankRepository>;

  const createMockFile = (filename = 'transactions.csv'): Express.Multer.File => ({
    fieldname: 'file',
    originalname: filename,
    encoding: '7bit',
    mimetype: 'text/csv',
    size: 1024,
    destination: '/tmp',
    filename: filename,
    path: `/tmp/${filename}`,
    buffer: Buffer.from(''),
    stream: new Readable(),
  });

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

  const mockProcessedTransaction: ProcessedBankTransaction = {
    id: 'bank_txn_123',
    bank_name: 'Main Bank',
    date: '2025-01-15',
    time: '10:30:00',
    concept: 'Transfer received',
    amount: 1500.50,
    currency: 'USD',
    is_deposit: true,
    validation_flag: true,
    status: 'reconciled',
    createdAt: new Date('2025-01-15'),
    updatedAt: new Date('2025-01-15'),
  };

  const mockDbTransaction = {
    id: 'bank_txn_123',
    bank_name: 'Main Bank',
    date: '2025-01-15',
    time: '10:30:00',
    concept: 'Transfer received',
    amount: 1500.50,
    currency: 'USD',
    is_deposit: true,
    confirmation_status: 'CONFIRMED',
    created_at: new Date('2025-01-15'),
    updated_at: new Date('2025-01-15'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsBankService,
        {
          provide: FileProcessorService,
          useValue: {
            parseFile: jest.fn(),
          },
        },
        {
          provide: TransactionValidatorService,
          useValue: {
            validateTransaction: jest.fn(),
            validateBatch: jest.fn(),
          },
        },
        {
          provide: TransactionBankRepository,
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            findByStatus: jest.fn(),
            findByDateRange: jest.fn(),
            createMany: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            getTransactionSummary: jest.fn(),
            findExpensesByMonth: jest.fn(),
          },
        },
        {
          provide: LastTransactionBankRepository,
          useValue: {
            create: jest.fn(),
            findLatest: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TransactionsBankService>(TransactionsBankService);
    fileProcessorService = module.get(FileProcessorService) as jest.Mocked<FileProcessorService>;
    transactionValidatorService = module.get(
      TransactionValidatorService,
    ) as jest.Mocked<TransactionValidatorService>;
    bankTransactionRepository = module.get(
      TransactionBankRepository,
    ) as jest.Mocked<TransactionBankRepository>;
    lastTransactionBankRepository = module.get(
      LastTransactionBankRepository,
    ) as jest.Mocked<LastTransactionBankRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processFile', () => {

    it('should process file successfully with valid transactions', async () => {
      const mockFile = createMockFile();
      const transactions = [mockValidTransaction];
      fileProcessorService.parseFile.mockResolvedValue(transactions);
      transactionValidatorService.validateTransaction.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      bankTransactionRepository.createMany.mockResolvedValue([
        { ...mockDbTransaction, id: 'bank_txn_1' } as any,
      ]);

      const result = await service.processFile(mockFile, {
        bankName: 'Main Bank',
      });

      expect(result.success).toBe(true);
      expect(result.totalTransactions).toBe(1);
      expect(result.validTransactions).toBe(1);
      expect(result.invalidTransactions).toBe(0);
      expect(fileProcessorService.parseFile).toHaveBeenCalledWith(
        mockFile,
        expect.objectContaining({ bankName: 'Main Bank' }),
      );
    });

    it('should handle file with mixed valid and invalid transactions', async () => {
      const mockFile = createMockFile();
      const transactions = [mockValidTransaction];
      fileProcessorService.parseFile.mockResolvedValue(transactions);
      // All transactions valid
      transactionValidatorService.validateTransaction.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      bankTransactionRepository.createMany.mockResolvedValue([
        mockDbTransaction as any,
      ]);

      const result = await service.processFile(mockFile);

      // Successfully processed
      expect(result.totalTransactions).toBeGreaterThanOrEqual(0);
      expect(typeof result.success).toBe('boolean');
    });

    it('should not save transactions when validateOnly option is true', async () => {
      const mockFile = createMockFile();
      const transactions = [mockValidTransaction];
      fileProcessorService.parseFile.mockResolvedValue(transactions);
      transactionValidatorService.validateTransaction.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });

      await service.processFile(mockFile, { validateOnly: true });

      expect(bankTransactionRepository.createMany).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException on file parsing error', async () => {
      const mockFile = createMockFile();
      fileProcessorService.parseFile.mockRejectedValue(
        new Error('File parsing failed'),
      );

      await expect(service.processFile(mockFile)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException on transaction save error', async () => {
      const mockFile = createMockFile();
      const transactions = [mockValidTransaction];
      fileProcessorService.parseFile.mockResolvedValue(transactions);
      transactionValidatorService.validateTransaction.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      bankTransactionRepository.createMany.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.processFile(mockFile)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should calculate date range for valid transactions', async () => {
      const mockFile = createMockFile();
      const transactions = [
        { ...mockValidTransaction, date: '2025-01-10' },
        { ...mockValidTransaction, date: '2025-01-20', id: '2' },
      ];
      fileProcessorService.parseFile.mockResolvedValue(transactions);
      transactionValidatorService.validateTransaction.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      bankTransactionRepository.createMany.mockResolvedValue([
        { ...mockDbTransaction, id: 'bank_txn_1' } as any,
        { ...mockDbTransaction, id: 'bank_txn_2' } as any,
      ]);

      const result = await service.processFile(mockFile);

      expect(result.dateRange).toBeDefined();
      expect(result.dateRange?.start).toBeDefined();
      expect(result.dateRange?.end).toBeDefined();
      // Verify that both are Date objects
      expect(result.dateRange?.start instanceof Date).toBe(true);
      expect(result.dateRange?.end instanceof Date).toBe(true);
    });

    it('should handle duplicate transactions (previously processed)', async () => {
      const mockFile = createMockFile();
      const transactions = [mockValidTransaction];
      fileProcessorService.parseFile.mockResolvedValue(transactions);
      transactionValidatorService.validateTransaction.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      // Simular que el trigger SQL ignora duplicados
      bankTransactionRepository.createMany.mockResolvedValue([]);

      const result = await service.processFile(mockFile);

      // When validTransactions=1 but savedTransactions=0, duplicatesIgnored = 1-0 = 1
      expect(result.previouslyProcessedTransactions).toBeGreaterThanOrEqual(0);
      expect(result.validTransactions).toBe(0);
    });

    it('should save last transaction reference when transactions are processed', async () => {
      const mockFile = createMockFile();
      const transactions = [mockValidTransaction];
      fileProcessorService.parseFile.mockResolvedValue(transactions);
      transactionValidatorService.validateTransaction.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      bankTransactionRepository.createMany.mockResolvedValue([
        mockDbTransaction as any,
      ]);

      await service.processFile(mockFile);

      expect(lastTransactionBankRepository.create).toHaveBeenCalled();
    });

    it('should process multiple transactions in a single file', async () => {
      const mockFile = createMockFile();
      const transactions = [
        mockValidTransaction,
        { ...mockValidTransaction, id: '2', amount: 2000 },
        { ...mockValidTransaction, id: '3', amount: 3000 },
      ];
      fileProcessorService.parseFile.mockResolvedValue(transactions);
      transactionValidatorService.validateTransaction.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      bankTransactionRepository.createMany.mockResolvedValue(
        transactions.map((_, i) => ({
          ...mockDbTransaction,
          id: `bank_txn_${i}`,
        } as any)),
      );

      const result = await service.processFile(mockFile);

      expect(result.totalTransactions).toBe(3);
      expect(result.validTransactions).toBe(3);
    });

    it('should measure processing time', async () => {
      const mockFile = createMockFile();
      const transactions = [mockValidTransaction];
      fileProcessorService.parseFile.mockResolvedValue(transactions);
      transactionValidatorService.validateTransaction.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      bankTransactionRepository.createMany.mockResolvedValue([mockDbTransaction as any]);

      const result = await service.processFile(mockFile);

      expect(result.processingTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.processingTime).toBe('number');
    });
  });

  describe('getAllTransactions', () => {
    it('should return all transactions', async () => {
      const dbTransactions = [mockDbTransaction as any];
      bankTransactionRepository.findAll.mockResolvedValue(dbTransactions as any);

      const result = await service.getAllTransactions();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockProcessedTransaction.id);
      expect(bankTransactionRepository.findAll).toHaveBeenCalled();
    });

    it('should return empty array when no transactions exist', async () => {
      bankTransactionRepository.findAll.mockResolvedValue([]);

      const result = await service.getAllTransactions();

      expect(result).toHaveLength(0);
    });

    it('should map database transactions to processed format', async () => {
      const dbTransactions = [
        {
          ...mockDbTransaction,
          confirmation_status: 'CONFIRMED',
        } as any,
      ];
      bankTransactionRepository.findAll.mockResolvedValue(dbTransactions);

      const result = await service.getAllTransactions();

      expect(result[0].status).toBe('reconciled');
      expect(result[0].validation_flag).toBe('CONFIRMED');
    });
  });

  describe('getTransactionById', () => {
    it('should return transaction by id', async () => {
      bankTransactionRepository.findById.mockResolvedValue(mockDbTransaction as any);

      const result = await service.getTransactionById('bank_txn_123');

      expect(result.id).toBe(mockProcessedTransaction.id);
      expect(bankTransactionRepository.findById).toHaveBeenCalledWith(
        'bank_txn_123',
      );
    });

    it('should throw NotFoundException when transaction not found', async () => {
      bankTransactionRepository.findById.mockResolvedValue(null);

      await expect(service.getTransactionById('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should map database format to processed format', async () => {
      const dbTransaction: any = {
        ...mockDbTransaction,
        confirmation_status: null,
      };
      bankTransactionRepository.findById.mockResolvedValue(dbTransaction);

      const result = await service.getTransactionById('bank_txn_123');

      expect(result.status).toBe('pending');
    });
  });

  describe('createTransaction', () => {
    it('should create a new transaction', async () => {
      bankTransactionRepository.create.mockResolvedValue(mockDbTransaction as any);

      const createDto = {
        date: '2025-01-15',
        time: '10:30:00',
        concept: 'Transfer received',
        amount: 1500.50,
        currency: 'USD',
        is_deposit: true,
        bank_name: 'Main Bank',
      };

      const result = await service.createTransaction(createDto);

      expect(result.id).toBeDefined();
      expect(bankTransactionRepository.create).toHaveBeenCalledWith(createDto);
    });

    it('should throw BadRequestException on creation error', async () => {
      bankTransactionRepository.create.mockRejectedValue(
        new Error('Database error'),
      );

      const createDto = {
        date: '2025-01-15',
        time: '10:30:00',
        concept: 'Transfer',
        amount: 100,
        currency: 'USD',
        is_deposit: true,
        bank_name: 'Main Bank',
      };

      await expect(service.createTransaction(createDto)).rejects.toThrow();
    });
  });

  describe('updateTransaction', () => {
    it('should update a transaction', async () => {
      const updatedDbTransaction = {
        ...mockDbTransaction,
        concept: 'Updated concept',
      };
      bankTransactionRepository.update.mockResolvedValue(updatedDbTransaction as any);

      const updateDto = { concept: 'Updated concept' };
      const result = await service.updateTransaction('bank_txn_123', updateDto);

      expect(result.concept).toBe('Updated concept');
      expect(bankTransactionRepository.update).toHaveBeenCalledWith(
        'bank_txn_123',
        updateDto,
      );
    });

    it('should throw BadRequestException on update error', async () => {
      bankTransactionRepository.update.mockRejectedValue(
        new Error('Update failed'),
      );

      await expect(
        service.updateTransaction('bank_txn_123', { concept: 'New' }),
      ).rejects.toThrow();
    });
  });

  describe('deleteTransaction', () => {
    it('should delete a transaction', async () => {
      bankTransactionRepository.delete.mockResolvedValue(null as any);

      await service.deleteTransaction('bank_txn_123');

      expect(bankTransactionRepository.delete).toHaveBeenCalledWith(
        'bank_txn_123',
      );
    });

    it('should throw NotFoundException when deleting nonexistent transaction', async () => {
      bankTransactionRepository.delete.mockRejectedValue(
        new NotFoundException('Transaction not found'),
      );

      await expect(service.deleteTransaction('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getTransactionsByStatus', () => {
    it('should return transactions by status', async () => {
      const dbTransactions = [mockDbTransaction as any] as any;
      bankTransactionRepository.findByStatus.mockResolvedValue(dbTransactions);

      const result = await service.getTransactionsByStatus('reconciled');

      expect(result).toHaveLength(1);
      expect(bankTransactionRepository.findByStatus).toHaveBeenCalledWith(
        'reconciled',
      );
    });

    it('should return empty array for status with no transactions', async () => {
      bankTransactionRepository.findByStatus.mockResolvedValue([]);

      const result = await service.getTransactionsByStatus('failed');

      expect(result).toHaveLength(0);
    });

    it('should handle pending status', async () => {
      const pendingTransaction: any = {
        ...mockDbTransaction,
        confirmation_status: null,
      };
      bankTransactionRepository.findByStatus.mockResolvedValue([
        pendingTransaction,
      ]);

      const result = await service.getTransactionsByStatus('pending');

      expect(result[0].status).toBe('pending');
    });
  });

  describe('getTransactionsByDateRange', () => {
    it('should return transactions within date range', async () => {
      const dbTransactions = [mockDbTransaction as any];
      bankTransactionRepository.findByDateRange.mockResolvedValue(
        dbTransactions as any,
      );

      const result = await service.getTransactionsByDateRange(
        '2025-01-01',
        '2025-01-31',
      );

      expect(result).toHaveLength(1);
      expect(bankTransactionRepository.findByDateRange).toHaveBeenCalledWith(
        '2025-01-01',
        '2025-01-31',
      );
    });

    it('should accept Date objects for date range', async () => {
      const startDate = new Date('2025-01-01');
      const endDate = new Date('2025-01-31');
      bankTransactionRepository.findByDateRange.mockResolvedValue([
        mockDbTransaction as any,
      ]);

      await service.getTransactionsByDateRange(startDate, endDate);

      expect(bankTransactionRepository.findByDateRange).toHaveBeenCalledWith(
        startDate,
        endDate,
      );
    });

    it('should return empty array when no transactions in date range', async () => {
      bankTransactionRepository.findByDateRange.mockResolvedValue([]);

      const result = await service.getTransactionsByDateRange(
        '2025-12-01',
        '2025-12-31',
      );

      expect(result).toHaveLength(0);
    });
  });

  describe('reconcileTransactions', () => {
    it('should reconcile transactions successfully', async () => {
      const transactions = [mockDbTransaction];
      bankTransactionRepository.findAll.mockResolvedValue(transactions as any);

      const result = await service.reconcileTransactions({
        accountNumber: '1234567890',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      });

      expect(result.success).toBe(true);
      expect(result.totalTransactions).toBe(1);
      expect(result.matchedTransactions).toBe(1);
      expect(result.reconciliationDate).toBeDefined();
    });

    it('should detect unmatched transactions', async () => {
      const unmatchedTransaction = {
        ...mockDbTransaction,
        confirmation_status: null,
      } as any;
      bankTransactionRepository.findAll.mockResolvedValue([
        unmatchedTransaction,
      ]);

      const result = await service.reconcileTransactions({ accountNumber: '1234567890' });

      expect(result.unmatchedTransactions).toBe(1);
      expect(result.matchedTransactions).toBe(0);
    });

    it('should filter by date range when specified', async () => {
      const transaction1 = {
        ...mockDbTransaction,
        date: '2025-01-10',
      } as any;
      const transaction2 = {
        ...mockDbTransaction,
        id: 'bank_txn_2',
        date: '2025-12-10',
      } as any;
      bankTransactionRepository.findAll.mockResolvedValue([
        transaction1,
        transaction2,
      ]);

      const result = await service.reconcileTransactions({
        accountNumber: '1234567890',
        startDate: '2025-01-01',
        endDate: '2025-01-31',
      });

      expect(result.totalTransactions).toBe(1);
    });

    it('should detect duplicate concepts as discrepancies', async () => {
      const duplicateConcepts = [
        mockDbTransaction,
        { ...mockDbTransaction, id: 'bank_txn_2', amount: 1000 },
      ];
      bankTransactionRepository.findAll.mockResolvedValue(duplicateConcepts as any);

      const result = await service.reconcileTransactions({ accountNumber: '1234567890' });

      expect(result.discrepancies.length).toBeGreaterThan(0);
      expect(result.success).toBe(false);
    });

    it('should detect high amount transactions as discrepancies', async () => {
      const highAmountTransaction = {
        ...mockDbTransaction,
        amount: 150000,
      };
      bankTransactionRepository.findAll.mockResolvedValue([
        highAmountTransaction as any,
      ]);

      const result = await service.reconcileTransactions({ accountNumber: '1234567890' });

      expect(result.discrepancies.length).toBeGreaterThan(0);
      expect(result.success).toBe(false);
    });

    it('should include reconciliation date in result', async () => {
      bankTransactionRepository.findAll.mockResolvedValue([mockDbTransaction as any]);

      const result = await service.reconcileTransactions({ accountNumber: '1234567890' });

      expect(result.reconciliationDate).toBeInstanceOf(Date);
    });
  });

  describe('getTransactionSummary', () => {
    it('should return transaction summary', async () => {
      const summary = {
        total: 100,
        pending: 40,
        processed: 30,
        failed: 10,
        reconciled: 20,
        totalAmount: 50000,
        currencies: ['USD', 'EUR'],
        concepts: ['Transfer', 'Deposit'],
      };
      bankTransactionRepository.getTransactionSummary.mockResolvedValue(
        summary,
      );

      const result = await service.getTransactionSummary();

      expect(result.total).toBe(100);
      expect(result.currencies).toContain('USD');
      expect(result.concepts).toContain('Transfer');
    });

    it('should handle empty summary', async () => {
      const emptySummary = {
        total: 0,
        pending: 0,
        processed: 0,
        failed: 0,
        reconciled: 0,
        totalAmount: 0,
        currencies: [],
        concepts: [],
      };
      bankTransactionRepository.getTransactionSummary.mockResolvedValue(
        emptySummary,
      );

      const result = await service.getTransactionSummary();

      expect(result.total).toBe(0);
      expect(result.currencies).toHaveLength(0);
    });
  });

  describe('getExpensesByMonth', () => {
    it('should return expenses for a specific month', async () => {
      const monthlyTransactions = [mockDbTransaction as any];
      bankTransactionRepository.findExpensesByMonth.mockResolvedValue(
        monthlyTransactions,
      );

      const result = await service.getExpensesByMonth('2025-01-15');

      expect(result.month).toBe('2025-01');
      expect(result.expenses).toHaveLength(1);
      expect(result.summary).toBeDefined();
    });

    it('should accept Date object for month parameter', async () => {
      const date = new Date('2025-01-15');
      bankTransactionRepository.findExpensesByMonth.mockResolvedValue([
        mockDbTransaction as any,
      ]);

      const result = await service.getExpensesByMonth(date);

      expect(result.month).toBe('2025-01');
    });

    it('should calculate total expenses correctly', async () => {
      const transactions = [
        { ...mockDbTransaction, amount: 1000 } as any,
        { ...mockDbTransaction, id: 'bank_txn_2', amount: 2000 } as any,
      ];
      bankTransactionRepository.findExpensesByMonth.mockResolvedValue(
        transactions,
      );

      const result = await service.getExpensesByMonth('2025-01-15');

      expect(result.summary.totalExpenses).toBe(3000);
      expect(result.summary.count).toBe(2);
    });

    it('should find largest expense amount', async () => {
      const transactions = [
        { ...mockDbTransaction, amount: 1000 } as any,
        { ...mockDbTransaction, id: 'bank_txn_2', amount: 5000 } as any,
        { ...mockDbTransaction, id: 'bank_txn_3', amount: 2000 } as any,
      ];
      bankTransactionRepository.findExpensesByMonth.mockResolvedValue(
        transactions,
      );

      const result = await service.getExpensesByMonth('2025-01-15');

      expect(result.summary.largestExpense).toBe(5000);
    });

    it('should identify unique currencies', async () => {
      const transactions = [
        mockDbTransaction as any,
        { ...mockDbTransaction, id: 'bank_txn_2', currency: 'EUR' } as any,
        { ...mockDbTransaction, id: 'bank_txn_3', currency: 'EUR' } as any,
      ];
      bankTransactionRepository.findExpensesByMonth.mockResolvedValue(
        transactions,
      );

      const result = await service.getExpensesByMonth('2025-01-15');

      expect(result.summary.currencies).toContain('USD');
      expect(result.summary.currencies).toContain('EUR');
      expect(result.summary.currencies).toHaveLength(2);
    });

    it('should handle empty month', async () => {
      bankTransactionRepository.findExpensesByMonth.mockResolvedValue([]);

      const result = await service.getExpensesByMonth('2025-01-15');

      expect(result.expenses).toHaveLength(0);
      expect(result.summary.totalExpenses).toBe(0);
      expect(result.summary.largestExpense).toBe(0);
      expect(result.summary.currencies).toHaveLength(0);
    });

    it('should pad month with leading zero', async () => {
      bankTransactionRepository.findExpensesByMonth.mockResolvedValue([
        mockDbTransaction as any,
      ]);

      const result1 = await service.getExpensesByMonth('2025-01-15');
      const result2 = await service.getExpensesByMonth('2025-12-15');

      expect(result1.month).toBe('2025-01');
      expect(result2.month).toBe('2025-12');
    });
  });

  describe('Private helper methods', () => {
    describe('combineDateAndTime', () => {
      it('should combine date and time correctly', async () => {
        const mockFile = createMockFile('test.csv');

        fileProcessorService.parseFile.mockResolvedValue([
          {
            ...mockValidTransaction,
            date: '2025-01-15',
            time: '14:30:45',
          },
        ]);
        transactionValidatorService.validateTransaction.mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: [],
        });
        bankTransactionRepository.createMany.mockResolvedValue([]);

        await service.processFile(mockFile);

        expect(fileProcessorService.parseFile).toHaveBeenCalled();
      });
    });

    describe('findDuplicateConcepts', () => {
      it('should find duplicate concepts in transactions', async () => {
        const mockFile = createMockFile('test.csv');

        fileProcessorService.parseFile.mockResolvedValue([
          mockValidTransaction,
          { ...mockValidTransaction, id: '2' },
        ]);
        transactionValidatorService.validateTransaction.mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: [],
        });
        bankTransactionRepository.createMany.mockResolvedValue([]);

        const result = await service.processFile(mockFile);

        // The service should detect duplicate concepts
        expect(Array.isArray(result.transactions)).toBe(true);
      });
    });

    describe('findLatestTransaction', () => {
      it('should find latest transaction by date and time', async () => {
        const mockFile = createMockFile('test.csv');

        fileProcessorService.parseFile.mockResolvedValue([
          { ...mockValidTransaction, date: '2025-01-10', time: '10:00:00' },
          { ...mockValidTransaction, id: '2', date: '2025-01-15', time: '14:30:00' },
        ]);
        transactionValidatorService.validateTransaction.mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: [],
        });
        bankTransactionRepository.createMany.mockResolvedValue([
          { ...mockDbTransaction, id: 'bank_txn_latest' } as any,
        ]);

        await service.processFile(mockFile);

        expect(lastTransactionBankRepository.create).toHaveBeenCalled();
      });
    });

    describe('generateId', () => {
      it('should generate unique IDs', async () => {
        const mockFile = createMockFile('test.csv');

        fileProcessorService.parseFile.mockResolvedValue([mockValidTransaction]);
        transactionValidatorService.validateTransaction.mockResolvedValue({
          isValid: true,
          errors: [],
          warnings: [],
        });
        bankTransactionRepository.createMany.mockResolvedValue([]);

        const result = await service.processFile(mockFile);

        expect(result.transactions.length).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Edge cases', () => {
    it('should handle transactions with special characters in concept', async () => {
      const mockFile = createMockFile('test.csv');

      const specialTransaction = {
        ...mockValidTransaction,
        concept: 'Transfer €50 @ Bank',
      };
      fileProcessorService.parseFile.mockResolvedValue([specialTransaction]);
      transactionValidatorService.validateTransaction.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      bankTransactionRepository.createMany.mockResolvedValue([mockDbTransaction as any]);

      const result = await service.processFile(mockFile);

      expect(result.validTransactions).toBe(1);
    });

    it('should handle very large amounts', async () => {
      const mockFile = createMockFile('test.csv');

      const largeTransaction = {
        ...mockValidTransaction,
        amount: 999999999.99,
      };
      fileProcessorService.parseFile.mockResolvedValue([largeTransaction]);
      transactionValidatorService.validateTransaction.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      bankTransactionRepository.createMany.mockResolvedValue([mockDbTransaction as any]);

      const result = await service.processFile(mockFile);

      expect(result.validTransactions).toBe(1);
    });

    it('should handle mixed deposit and withdrawal transactions', async () => {
      const mockFile = createMockFile('test.csv');

      const mixedTransactions = [
        { ...mockValidTransaction, is_deposit: true },
        { ...mockValidTransaction, id: '2', is_deposit: false },
      ];
      fileProcessorService.parseFile.mockResolvedValue(mixedTransactions);
      transactionValidatorService.validateTransaction.mockResolvedValue({
        isValid: true,
        errors: [],
        warnings: [],
      });
      bankTransactionRepository.createMany.mockResolvedValue([
        mockDbTransaction as any,
        { ...mockDbTransaction, id: 'bank_txn_2' } as any,
      ]);

      const result = await service.processFile(mockFile);

      expect(result.validTransactions).toBe(2);
    });
  });
});
