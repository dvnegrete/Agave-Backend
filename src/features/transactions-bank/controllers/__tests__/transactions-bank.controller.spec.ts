import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { TransactionsBankController } from '../transactions-bank.controller';
import { TransactionsBankService } from '../../services/transactions-bank.service';
import {
  CreateTransactionBankDto,
  UpdateTransactionBankDto,
  ReconciliationDto,
} from '../../dto/transaction-bank.dto';
import { UploadFileDto } from '../../dto/upload-file.dto';
import { ProcessedBankTransaction } from '../../interfaces/transaction-bank.interface';
import { AuthGuard } from '@/shared/auth/guards/auth.guard';

describe('TransactionsBankController', () => {
  let controller: TransactionsBankController;
  let service: jest.Mocked<TransactionsBankService>;

  const mockTransaction: ProcessedBankTransaction = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    date: '2026-02-14',
    time: '14:30:00',
    concept: 'Depósito cliente',
    amount: 500000,
    is_deposit: true,
    currency: 'COP',
    bank_name: 'Banco Santander',
    status: 'processed',
    createdAt: new Date('2026-02-14'),
    updatedAt: new Date('2026-02-14'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TransactionsBankController],
      providers: [
        {
          provide: TransactionsBankService,
          useValue: {
            processFile: jest.fn(),
            getAllTransactions: jest.fn(),
            getTransactionsByStatus: jest.fn(),
            getTransactionsByDateRange: jest.fn(),
            getTransactionSummary: jest.fn(),
            getExpensesByMonth: jest.fn(),
            getTransactionById: jest.fn(),
            createTransaction: jest.fn(),
            updateTransaction: jest.fn(),
            deleteTransaction: jest.fn(),
            reconcileTransactions: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<TransactionsBankController>(
      TransactionsBankController,
    );
    service = module.get(TransactionsBankService) as jest.Mocked<
      TransactionsBankService
    >;
  });

  describe('uploadFile', () => {
    it('should process file successfully', async () => {
      const mockFile = {
        fieldname: 'file',
        originalname: 'bank_statement.xlsx',
        encoding: '7bit',
        mimetype: 'application/vnd.ms-excel',
        size: 5000,
        buffer: Buffer.from('mock'),
        destination: '',
        filename: '',
        path: '',
      } as Express.Multer.File;

      const uploadDto: UploadFileDto = { bankName: 'Santander' };

      service.processFile.mockResolvedValue({
        success: true,
        totalTransactions: 10,
        validTransactions: 10,
        invalidTransactions: 0,
        previouslyProcessedTransactions: 0,
        transactions: [],
        errors: [],
        processingTime: 100,
      });

      const result = await controller.uploadFile(mockFile, uploadDto);

      expect(result).toBeDefined();
      expect(result.validTransactions).toBe(10);
      expect(service.processFile).toHaveBeenCalled();
    });

    it('should handle file processing errors', async () => {
      const mockFile = {
        fieldname: 'file',
        originalname: 'invalid.txt',
        mimetype: 'text/plain',
        size: 1000,
        buffer: Buffer.from('mock'),
      } as Express.Multer.File;

      const uploadDto: UploadFileDto = { bankName: 'Unknown' };

      service.processFile.mockRejectedValue(
        new Error('Formato de archivo no soportado'),
      );

      await expect(
        controller.uploadFile(mockFile, uploadDto),
      ).rejects.toThrow(BadRequestException);
    });

    it('should combine bankName from query and DTO', async () => {
      const mockFile = {
        fieldname: 'file',
        originalname: 'bank_statement.xlsx',
        mimetype: 'application/vnd.ms-excel',
        size: 5000,
        buffer: Buffer.from('mock'),
      } as Express.Multer.File;

      const uploadDto: UploadFileDto = { bankName: 'Default' };

      service.processFile.mockResolvedValue({
        success: true,
        totalTransactions: 5,
        validTransactions: 5,
        invalidTransactions: 0,
        previouslyProcessedTransactions: 0,
        transactions: [],
        errors: [],
        processingTime: 100,
      });

      const result = await controller.uploadFile(
        mockFile,
        uploadDto,
        'Santander',
      );

      expect(result).toBeDefined();
      expect(service.processFile).toHaveBeenCalledWith(mockFile, {
        bankName: 'Santander',
      });
    });
  });

  describe('getAllTransactions', () => {
    it('should return all transactions', async () => {
      service.getAllTransactions.mockResolvedValue([mockTransaction]);

      const result = await controller.getAllTransactions();

      expect(result.transactions).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(service.getAllTransactions).toHaveBeenCalled();
    });

    it('should filter transactions by status', async () => {
      service.getTransactionsByStatus.mockResolvedValue([mockTransaction]);

      const result = await controller.getAllTransactions('processed');

      expect(result.transactions).toHaveLength(1);
      expect(service.getTransactionsByStatus).toHaveBeenCalledWith(
        'processed',
      );
    });

    it('should filter transactions by date range', async () => {
      service.getTransactionsByDateRange.mockResolvedValue([mockTransaction]);

      const result = await controller.getAllTransactions(
        undefined,
        '2026-02-01',
        '2026-02-28',
      );

      expect(result.transactions).toHaveLength(1);
      expect(service.getTransactionsByDateRange).toHaveBeenCalledWith(
        '2026-02-01',
        '2026-02-28',
      );
    });

    it('should return empty list when no transactions', async () => {
      service.getAllTransactions.mockResolvedValue([]);

      const result = await controller.getAllTransactions();

      expect(result.transactions).toEqual([]);
      expect(result.total).toBe(0);
    });
  });

  describe('getTransactionSummary', () => {
    it('should return transaction summary', async () => {
      const mockSummary = {
        total: 10,
        pending: 2,
        processed: 8,
        failed: 0,
        reconciled: 0,
        totalAmount: 5000000,
        currencies: ['COP'],
        concepts: ['Depósito'],
      };

      service.getTransactionSummary.mockResolvedValue(mockSummary);

      const result = await controller.getTransactionSummary();

      expect(result).toEqual(mockSummary);
      expect(service.getTransactionSummary).toHaveBeenCalled();
    });
  });

  describe('getExpenses', () => {
    it('should return expenses for given month', async () => {
      const mockExpensesResponse = {
        month: '2026-02',
        expenses: [mockTransaction],
        summary: {
          totalExpenses: 500000,
          count: 1,
          currencies: ['COP'],
          largestExpense: 500000,
        },
      };

      service.getExpensesByMonth.mockResolvedValue(mockExpensesResponse);

      const result = await controller.getExpenses('2026-02');

      expect(result).toEqual(mockExpensesResponse);
      expect(service.getExpensesByMonth).toHaveBeenCalledWith('2026-02');
    });

    it('should throw error if date is not provided', async () => {
      await expect(controller.getExpenses()).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle invalid date format', async () => {
      service.getExpensesByMonth.mockRejectedValue(
        new Error('Formato de fecha inválido'),
      );

      await expect(controller.getExpenses('invalid-date')).rejects.toThrow();
    });
  });

  describe('getTransactionById', () => {
    it('should return transaction by id', async () => {
      service.getTransactionById.mockResolvedValue(mockTransaction);

      const result = await controller.getTransactionById(
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(result).toEqual(mockTransaction);
      expect(service.getTransactionById).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
      );
    });

    it('should handle transaction not found', async () => {
      service.getTransactionById.mockRejectedValue(
        new Error('Transacción no encontrada'),
      );

      await expect(
        controller.getTransactionById('invalid-id'),
      ).rejects.toThrow();
    });
  });

  describe('createTransaction', () => {
    it('should create new transaction', async () => {
      const createDto: CreateTransactionBankDto = {
        date: '2026-02-14',
        time: '14:30:00',
        concept: 'Depósito cliente',
        amount: 500000,
        is_deposit: true,
        currency: 'COP',
        bank_name: 'Santander',
      };

      service.createTransaction.mockResolvedValue(mockTransaction);

      const result = await controller.createTransaction(createDto);

      expect(result).toEqual(mockTransaction);
      expect(service.createTransaction).toHaveBeenCalledWith(createDto);
    });

    it('should handle invalid transaction data', async () => {
      const createDto = { amount: -100 } as CreateTransactionBankDto;

      service.createTransaction.mockRejectedValue(
        new Error('Monto debe ser positivo'),
      );

      await expect(controller.createTransaction(createDto)).rejects.toThrow();
    });
  });

  describe('updateTransaction', () => {
    it('should update transaction', async () => {
      const updateDto: UpdateTransactionBankDto = {
        concept: 'Depósito actualizado',
        amount: 600000,
      };

      service.updateTransaction.mockResolvedValue({
        ...mockTransaction,
        concept: 'Depósito actualizado',
        amount: 600000,
      });

      const result = await controller.updateTransaction(
        '550e8400-e29b-41d4-a716-446655440000',
        updateDto,
      );

      expect(result.concept).toBe('Depósito actualizado');
      expect(result.amount).toBe(600000);
      expect(service.updateTransaction).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
        updateDto,
      );
    });

    it('should handle transaction not found on update', async () => {
      const updateDto: UpdateTransactionBankDto = { concept: 'Updated' };

      service.updateTransaction.mockRejectedValue(
        new Error('Transacción no encontrada'),
      );

      await expect(
        controller.updateTransaction('invalid-id', updateDto),
      ).rejects.toThrow();
    });
  });

  describe('deleteTransaction', () => {
    it('should delete transaction successfully', async () => {
      service.deleteTransaction.mockResolvedValue(undefined);

      const result = await controller.deleteTransaction(
        '550e8400-e29b-41d4-a716-446655440000',
      );

      expect(result.message).toBe('Transacción bancaria eliminada exitosamente');
      expect(service.deleteTransaction).toHaveBeenCalledWith(
        '550e8400-e29b-41d4-a716-446655440000',
      );
    });

    it('should handle transaction not found on delete', async () => {
      service.deleteTransaction.mockRejectedValue(
        new Error('Transacción no encontrada'),
      );

      await expect(
        controller.deleteTransaction('invalid-id'),
      ).rejects.toThrow();
    });
  });

  describe('createBatchTransactions', () => {
    it('should create batch of transactions', async () => {
      const createDtos: CreateTransactionBankDto[] = [
        {
          date: '2026-02-14',
          time: '14:30:00',
          concept: 'Depósito 1',
          amount: 500000,
          is_deposit: true,
          currency: 'COP',
          bank_name: 'Santander',
        },
        {
          date: '2026-02-14',
          time: '15:00:00',
          concept: 'Depósito 2',
          amount: 300000,
          is_deposit: true,
          currency: 'COP',
          bank_name: 'Santander',
        },
      ];

      service.createTransaction
        .mockResolvedValueOnce(mockTransaction)
        .mockResolvedValueOnce({ ...mockTransaction, concept: 'Depósito 2' });

      const result = await controller.createBatchTransactions(createDtos);

      expect(result).toHaveLength(2);
      expect(service.createTransaction).toHaveBeenCalledTimes(2);
    });

    it('should handle partial batch failures', async () => {
      const createDtos: CreateTransactionBankDto[] = [
        {
          date: '2026-02-14',
          time: '14:30:00',
          concept: 'Depósito válido',
          amount: 500000,
          is_deposit: true,
          currency: 'COP',
          bank_name: 'Santander',
        },
        {
          date: '2026-02-14',
          time: '15:00:00',
          concept: 'Depósito inválido',
          amount: -100,
          is_deposit: true,
          currency: 'COP',
          bank_name: 'Santander',
        },
      ];

      service.createTransaction
        .mockResolvedValueOnce(mockTransaction)
        .mockRejectedValueOnce(new Error('Monto inválido'));

      await expect(
        controller.createBatchTransactions(createDtos),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('reconcileTransactions', () => {
    it('should reconcile transactions successfully', async () => {
      const reconciliationDto: ReconciliationDto = {
        accountNumber: '123456789',
        bankName: 'Santander',
        startDate: '2026-02-01',
        endDate: '2026-02-28',
        autoReconcile: true,
      };

      service.reconcileTransactions.mockResolvedValue({
        success: true,
        matchedTransactions: 2,
        unmatchedTransactions: 0,
        totalTransactions: 2,
        reconciliationDate: new Date('2026-02-14'),
        discrepancies: [],
      });

      const result = await controller.reconcileTransactions(reconciliationDto);

      expect(result).toBeDefined();
      expect(result.matchedTransactions).toBe(2);
      expect(service.reconcileTransactions).toHaveBeenCalledWith(
        reconciliationDto,
      );
    });

    it('should handle reconciliation errors', async () => {
      const reconciliationDto: ReconciliationDto = {
        accountNumber: 'invalid-account',
      };

      service.reconcileTransactions.mockRejectedValue(
        new Error('Error en reconciliación'),
      );

      await expect(
        controller.reconcileTransactions(reconciliationDto),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('exportToCSV', () => {
    it('should export transactions to CSV', async () => {
      service.getAllTransactions.mockResolvedValue([mockTransaction]);

      const result = await controller.exportToCSV();

      expect(result).toBeDefined();
      expect(result.content).toBeDefined();
      expect(result.filename).toContain('bank_transactions_');
      expect(result.count).toBe(1);
    });

    it('should export CSV with status filter', async () => {
      service.getTransactionsByStatus.mockResolvedValue([mockTransaction]);

      const result = await controller.exportToCSV(undefined, undefined, 'processed');

      expect(result.count).toBe(1);
      expect(service.getTransactionsByStatus).toHaveBeenCalledWith(
        'processed',
      );
    });

    it('should export CSV with date range', async () => {
      service.getTransactionsByDateRange.mockResolvedValue([mockTransaction]);

      const result = await controller.exportToCSV(
        '2026-02-01',
        '2026-02-28',
      );

      expect(result.count).toBe(1);
      expect(service.getTransactionsByDateRange).toHaveBeenCalled();
    });
  });

  describe('exportToJSON', () => {
    it('should export transactions to JSON', async () => {
      service.getAllTransactions.mockResolvedValue([mockTransaction]);

      const result = await controller.exportToJSON();

      expect(result).toBeDefined();
      expect(result.transactions).toHaveLength(1);
      expect(result.exportDate).toBeDefined();
      expect(result.count).toBe(1);
    });

    it('should export JSON with status filter', async () => {
      service.getTransactionsByStatus.mockResolvedValue([mockTransaction]);

      const result = await controller.exportToJSON(undefined, undefined, 'pending');

      expect(result.count).toBe(1);
      expect(service.getTransactionsByStatus).toHaveBeenCalledWith('pending');
    });
  });
});
