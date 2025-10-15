import { Test, TestingModule } from '@nestjs/testing';
import { ReconciliationDataService } from './reconciliation-data.service';
import { TransactionBankRepository } from '@/shared/database/repositories/transaction-bank.repository';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { TransactionBank } from '@/shared/database/entities/transaction-bank.entity';
import { Voucher } from '@/shared/database/entities/voucher.entity';

describe('ReconciliationDataService', () => {
  let service: ReconciliationDataService;
  let transactionBankRepository: jest.Mocked<TransactionBankRepository>;
  let voucherRepository: jest.Mocked<VoucherRepository>;

  beforeEach(async () => {
    const mockTransactionBankRepo = {
      findAll: jest.fn(),
    };

    const mockVoucherRepo = {
      findByConfirmationStatus: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationDataService,
        {
          provide: TransactionBankRepository,
          useValue: mockTransactionBankRepo,
        },
        {
          provide: VoucherRepository,
          useValue: mockVoucherRepo,
        },
      ],
    }).compile();

    service = module.get<ReconciliationDataService>(ReconciliationDataService);
    transactionBankRepository = module.get(TransactionBankRepository);
    voucherRepository = module.get(VoucherRepository);
  });

  describe('getPendingTransactions', () => {
    const createMockTransaction = (
      id: string,
      amount: number,
      date: Date,
      isDeposit: boolean,
      confirmationStatus: boolean,
    ): TransactionBank => {
      return {
        id,
        amount,
        date,
        time: '10:00:00',
        is_deposit: isDeposit,
        confirmation_status: confirmationStatus,
      } as TransactionBank;
    };

    it('should return only pending deposit transactions', async () => {
      const mockTransactions = [
        createMockTransaction('1', 500, new Date('2025-01-10'), true, false), // Pending deposit ✓
        createMockTransaction('2', 600, new Date('2025-01-11'), true, true), // Confirmed deposit ✗
        createMockTransaction('3', 700, new Date('2025-01-12'), false, false), // Pending withdrawal ✗
        createMockTransaction('4', 800, new Date('2025-01-13'), true, false), // Pending deposit ✓
      ];

      transactionBankRepository.findAll.mockResolvedValue(mockTransactions);

      const result = await service.getPendingTransactions();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('4');
      expect(transactionBankRepository.findAll).toHaveBeenCalledTimes(1);
    });

    it('should filter by date range when provided', async () => {
      const mockTransactions = [
        createMockTransaction('1', 500, new Date('2025-01-05'), true, false), // Before range
        createMockTransaction('2', 600, new Date('2025-01-10'), true, false), // In range ✓
        createMockTransaction('3', 700, new Date('2025-01-15'), true, false), // In range ✓
        createMockTransaction('4', 800, new Date('2025-01-25'), true, false), // After range
      ];

      transactionBankRepository.findAll.mockResolvedValue(mockTransactions);

      const startDate = new Date('2025-01-10');
      const endDate = new Date('2025-01-20');

      const result = await service.getPendingTransactions(startDate, endDate);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('2');
      expect(result[1].id).toBe('3');
    });

    it('should return all pending deposits when no date range provided', async () => {
      const mockTransactions = [
        createMockTransaction('1', 500, new Date('2024-01-01'), true, false),
        createMockTransaction('2', 600, new Date('2025-12-31'), true, false),
      ];

      transactionBankRepository.findAll.mockResolvedValue(mockTransactions);

      const result = await service.getPendingTransactions();

      expect(result).toHaveLength(2);
    });

    it('should return empty array when no pending deposits found', async () => {
      const mockTransactions = [
        createMockTransaction('1', 500, new Date('2025-01-10'), true, true), // All confirmed
        createMockTransaction('2', 600, new Date('2025-01-11'), true, true),
      ];

      transactionBankRepository.findAll.mockResolvedValue(mockTransactions);

      const result = await service.getPendingTransactions();

      expect(result).toHaveLength(0);
    });

    it('should handle empty transactions list', async () => {
      transactionBankRepository.findAll.mockResolvedValue([]);

      const result = await service.getPendingTransactions();

      expect(result).toEqual([]);
    });

    it('should handle date range boundary correctly', async () => {
      const mockTransactions = [
        createMockTransaction(
          '1',
          500,
          new Date('2025-01-10T00:00:00'),
          true,
          false,
        ), // Exactly start date ✓
        createMockTransaction(
          '2',
          600,
          new Date('2025-01-20T23:59:59'),
          true,
          false,
        ), // Exactly end date ✓
      ];

      transactionBankRepository.findAll.mockResolvedValue(mockTransactions);

      const startDate = new Date('2025-01-10');
      const endDate = new Date('2025-01-20');

      const result = await service.getPendingTransactions(startDate, endDate);

      expect(result).toHaveLength(2);
    });
  });

  describe('getPendingVouchers', () => {
    const createMockVoucher = (
      id: number,
      amount: number,
      date: Date,
      confirmationStatus: boolean,
    ): Voucher => {
      return {
        id,
        amount,
        date,
        confirmation_status: confirmationStatus,
      } as Voucher;
    };

    it('should return only pending vouchers', async () => {
      const mockVouchers = [
        createMockVoucher(1, 500, new Date('2025-01-10'), false), // Pending ✓
        createMockVoucher(2, 600, new Date('2025-01-11'), false), // Pending ✓
        createMockVoucher(3, 700, new Date('2025-01-12'), true), // Confirmed (shouldn't be in list)
      ];

      voucherRepository.findByConfirmationStatus.mockResolvedValue(
        mockVouchers.filter((v) => !v.confirmation_status),
      );

      const result = await service.getPendingVouchers();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[1].id).toBe(2);
      expect(voucherRepository.findByConfirmationStatus).toHaveBeenCalledWith(
        false,
      );
    });

    it('should filter by date range when provided', async () => {
      const mockVouchers = [
        createMockVoucher(1, 500, new Date('2025-01-05'), false), // Before range
        createMockVoucher(2, 600, new Date('2025-01-10'), false), // In range ✓
        createMockVoucher(3, 700, new Date('2025-01-15'), false), // In range ✓
        createMockVoucher(4, 800, new Date('2025-01-25'), false), // After range
      ];

      voucherRepository.findByConfirmationStatus.mockResolvedValue(
        mockVouchers,
      );

      const startDate = new Date('2025-01-10');
      const endDate = new Date('2025-01-20');

      const result = await service.getPendingVouchers(startDate, endDate);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(2);
      expect(result[1].id).toBe(3);
    });

    it('should return all pending vouchers when no date range provided', async () => {
      const mockVouchers = [
        createMockVoucher(1, 500, new Date('2024-01-01'), false),
        createMockVoucher(2, 600, new Date('2025-12-31'), false),
      ];

      voucherRepository.findByConfirmationStatus.mockResolvedValue(
        mockVouchers,
      );

      const result = await service.getPendingVouchers();

      expect(result).toHaveLength(2);
    });

    it('should return empty array when no pending vouchers found', async () => {
      voucherRepository.findByConfirmationStatus.mockResolvedValue([]);

      const result = await service.getPendingVouchers();

      expect(result).toHaveLength(0);
    });

    it('should handle date range boundary correctly', async () => {
      const mockVouchers = [
        createMockVoucher(1, 500, new Date('2025-01-10T00:00:00'), false), // Exactly start date ✓
        createMockVoucher(2, 600, new Date('2025-01-20T23:59:59'), false), // Exactly end date ✓
      ];

      voucherRepository.findByConfirmationStatus.mockResolvedValue(
        mockVouchers,
      );

      const startDate = new Date('2025-01-10');
      const endDate = new Date('2025-01-20');

      const result = await service.getPendingVouchers(startDate, endDate);

      expect(result).toHaveLength(2);
    });
  });
});
