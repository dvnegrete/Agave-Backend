import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UnfundedVouchersService } from './unfunded-vouchers.service';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { TransactionBankRepository } from '@/shared/database/repositories/transaction-bank.repository';
import { ReconciliationPersistenceService } from './reconciliation-persistence.service';
import { ValidationStatus } from '@/shared/database/entities/enums';

describe('UnfundedVouchersService', () => {
  let service: UnfundedVouchersService;
  let mockDataSource: any;
  let mockVoucherRepository: jest.Mocked<VoucherRepository>;
  let mockTransactionBankRepository: jest.Mocked<TransactionBankRepository>;
  let mockPersistenceService: jest.Mocked<ReconciliationPersistenceService>;
  let mockQueryBuilder: any;

  const mockVoucher = {
    id: 1,
    amount: 1500.5,
    date: new Date('2026-02-14T10:00:00'),
    url: 'gs://bucket/voucher1.jpg',
    confirmation_status: false,
    authorization_number: 'AUTH123',
  };

  const mockTransactionBank = {
    id: 'bank_txn_123',
    amount: 1500.5,
    date: '2026-02-14',
    is_deposit: true,
    confirmation_status: false,
  };

  beforeEach(async () => {
    // Mock QueryBuilder
    mockQueryBuilder = {
      leftJoin: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      distinctOn: jest.fn().mockReturnThis(),
      getRawOne: jest.fn(),
      getRawMany: jest.fn(),
    };

    // Mock Repository
    const mockRepository = {
      createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
    };

    // Mock DataSource
    mockDataSource = {
      getRepository: jest.fn().mockReturnValue(mockRepository),
    };

    // Mock VoucherRepository
    mockVoucherRepository = {
      findById: jest.fn(),
    } as any;

    // Mock TransactionBankRepository
    mockTransactionBankRepository = {
      findById: jest.fn(),
    } as any;

    // Mock ReconciliationPersistenceService
    mockPersistenceService = {
      persistReconciliation: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnfundedVouchersService,
        {
          provide: DataSource,
          useValue: mockDataSource,
        },
        {
          provide: VoucherRepository,
          useValue: mockVoucherRepository,
        },
        {
          provide: TransactionBankRepository,
          useValue: mockTransactionBankRepository,
        },
        {
          provide: ReconciliationPersistenceService,
          useValue: mockPersistenceService,
        },
      ],
    }).compile();

    service = module.get<UnfundedVouchersService>(UnfundedVouchersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUnfundedVouchers', () => {
    it('should return paginated unfunded vouchers', async () => {
      const mockItems = [
        {
          v_id: 1,
          v_amount: 1500.5,
          v_date: new Date('2026-02-14'),
          v_url: 'gs://bucket/voucher1.jpg',
        },
        {
          v_id: 2,
          v_amount: 2000.0,
          v_date: new Date('2026-02-13'),
          v_url: 'gs://bucket/voucher2.jpg',
        },
      ];

      const mockHouseNumbers = [
        { voucher_id: 1, number_house: 15 },
        { voucher_id: 2, number_house: 20 },
      ];

      // Mock count query
      mockQueryBuilder.getRawOne.mockResolvedValueOnce({ cnt: '2' });

      // Mock items query
      mockQueryBuilder.getRawMany.mockResolvedValueOnce(mockItems);

      // Mock house numbers query
      mockQueryBuilder.getRawMany.mockResolvedValueOnce(mockHouseNumbers);

      const result = await service.getUnfundedVouchers(
        undefined,
        undefined,
        1,
        20,
        'date',
      );

      expect(result).toBeDefined();
      expect(result.totalCount).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({
        voucherId: 1,
        amount: 1500.5,
        date: expect.any(Date),
        houseNumber: 15,
        url: 'gs://bucket/voucher1.jpg',
      });
    });

    it('should filter by date range', async () => {
      const startDate = new Date('2026-02-01');
      const endDate = new Date('2026-02-28');

      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: '0' });
      mockQueryBuilder.getRawMany.mockResolvedValue([]);

      await service.getUnfundedVouchers(startDate, endDate, 1, 20);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'v.date >= :startDate',
        { startDate },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith(
        'v.date <= :endDate',
        expect.objectContaining({ endDate: expect.any(Date) }),
      );
    });

    it('should sort by amount when specified', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: '1' });
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([
        {
          v_id: 1,
          v_amount: 1500.5,
          v_date: new Date('2026-02-14'),
          v_url: null,
        },
      ]);
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);

      await service.getUnfundedVouchers(undefined, undefined, 1, 20, 'amount');

      expect(mockQueryBuilder.orderBy).toHaveBeenCalledWith('v.amount', 'DESC');
    });

    it('should handle pagination correctly', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: '50' });
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);

      const result = await service.getUnfundedVouchers(
        undefined,
        undefined,
        2,
        20,
      );

      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(20);
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(20);
      expect(result.totalPages).toBe(3);
    });

    it('should default to page 1 if page < 1', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: '0' });
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);

      const result = await service.getUnfundedVouchers(
        undefined,
        undefined,
        0,
        20,
      );

      expect(result.page).toBe(1);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(0);
    });

    it('should limit to 20 if limit is invalid', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: '0' });
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);

      const result = await service.getUnfundedVouchers(
        undefined,
        undefined,
        1,
        150,
      );

      expect(result.limit).toBe(20);
    });

    it('should return empty items when no unfunded vouchers', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: '0' });
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);

      const result = await service.getUnfundedVouchers();

      expect(result.totalCount).toBe(0);
      expect(result.items).toEqual([]);
      expect(result.totalPages).toBe(0);
    });

    it('should handle vouchers without house numbers', async () => {
      const mockItems = [
        {
          v_id: 1,
          v_amount: 1500.5,
          v_date: new Date('2026-02-14'),
          v_url: 'gs://bucket/voucher1.jpg',
        },
      ];

      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: '1' });
      mockQueryBuilder.getRawMany.mockResolvedValueOnce(mockItems);
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);

      const result = await service.getUnfundedVouchers();

      expect(result.items[0].houseNumber).toBeNull();
    });
  });

  describe('matchVoucherToDeposit', () => {
    const voucherId = 1;
    const transactionBankId = 'bank_txn_123';
    const houseNumber = 15;
    const userId = 'user-uuid-123';

    it('should successfully match voucher to deposit', async () => {
      mockVoucherRepository.findById.mockResolvedValue(mockVoucher as any);
      mockTransactionBankRepository.findById.mockResolvedValue(
        mockTransactionBank as any,
      );
      mockPersistenceService.persistReconciliation.mockResolvedValue(
        undefined,
      );

      const result = await service.matchVoucherToDeposit(
        voucherId,
        transactionBankId,
        houseNumber,
        userId,
        'Manual match by admin',
      );

      expect(result).toBeDefined();
      expect(result.message).toContain('conciliado exitosamente');
      expect(result.reconciliation).toEqual({
        voucherId,
        transactionBankId,
        houseNumber,
        status: 'confirmed',
      });
      expect(result.matchedAt).toBeInstanceOf(Date);
      expect(mockPersistenceService.persistReconciliation).toHaveBeenCalledWith(
        transactionBankId,
        mockVoucher,
        houseNumber,
      );
    });

    it('should throw NotFoundException if voucher not found', async () => {
      mockVoucherRepository.findById.mockResolvedValue(null);

      await expect(
        service.matchVoucherToDeposit(
          voucherId,
          transactionBankId,
          houseNumber,
          userId,
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.matchVoucherToDeposit(
          voucherId,
          transactionBankId,
          houseNumber,
          userId,
        ),
      ).rejects.toThrow('Voucher no encontrado');
    });

    it('should throw BadRequestException if voucher already confirmed', async () => {
      const confirmedVoucher = { ...mockVoucher, confirmation_status: true };
      mockVoucherRepository.findById.mockResolvedValue(confirmedVoucher as any);

      await expect(
        service.matchVoucherToDeposit(
          voucherId,
          transactionBankId,
          houseNumber,
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.matchVoucherToDeposit(
          voucherId,
          transactionBankId,
          houseNumber,
          userId,
        ),
      ).rejects.toThrow('ya fue conciliado previamente');
    });

    it('should throw NotFoundException if transaction not found', async () => {
      mockVoucherRepository.findById.mockResolvedValue(mockVoucher as any);
      mockTransactionBankRepository.findById.mockResolvedValue(null);

      await expect(
        service.matchVoucherToDeposit(
          voucherId,
          transactionBankId,
          houseNumber,
          userId,
        ),
      ).rejects.toThrow(NotFoundException);
      await expect(
        service.matchVoucherToDeposit(
          voucherId,
          transactionBankId,
          houseNumber,
          userId,
        ),
      ).rejects.toThrow('Transacción bancaria no encontrada');
    });

    it('should throw BadRequestException if transaction already confirmed', async () => {
      const confirmedTransaction = {
        ...mockTransactionBank,
        confirmation_status: true,
      };
      mockVoucherRepository.findById.mockResolvedValue(mockVoucher as any);
      mockTransactionBankRepository.findById.mockResolvedValue(
        confirmedTransaction as any,
      );

      await expect(
        service.matchVoucherToDeposit(
          voucherId,
          transactionBankId,
          houseNumber,
          userId,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.matchVoucherToDeposit(
          voucherId,
          transactionBankId,
          houseNumber,
          userId,
        ),
      ).rejects.toThrow('ya fue conciliado previamente');
    });

    it('should handle persistence errors gracefully', async () => {
      mockVoucherRepository.findById.mockResolvedValue(mockVoucher as any);
      mockTransactionBankRepository.findById.mockResolvedValue(
        mockTransactionBank as any,
      );
      mockPersistenceService.persistReconciliation.mockRejectedValue(
        new Error('Database connection error'),
      );

      await expect(
        service.matchVoucherToDeposit(
          voucherId,
          transactionBankId,
          houseNumber,
          userId,
        ),
      ).rejects.toThrow('Database connection error');
    });

    it('should work without admin notes', async () => {
      mockVoucherRepository.findById.mockResolvedValue(mockVoucher as any);
      mockTransactionBankRepository.findById.mockResolvedValue(
        mockTransactionBank as any,
      );
      mockPersistenceService.persistReconciliation.mockResolvedValue(
        undefined,
      );

      const result = await service.matchVoucherToDeposit(
        voucherId,
        transactionBankId,
        houseNumber,
        userId,
      );

      expect(result).toBeDefined();
      expect(result.reconciliation.status).toBe('confirmed');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty voucher IDs array in getHouseNumbersForVouchers', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: '0' });
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);

      const result = await service.getUnfundedVouchers();

      expect(result.items).toEqual([]);
    });

    it('should build query with confirmation_status filter', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: '0' });
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);

      await service.getUnfundedVouchers();

      expect(mockQueryBuilder.where).toHaveBeenCalledWith(
        'v.confirmation_status = :status',
        { status: false },
      );
    });

    it('should filter out confirmed vouchers via TransactionStatus join', async () => {
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: '0' });
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);
      mockQueryBuilder.getRawMany.mockResolvedValueOnce([]);

      await service.getUnfundedVouchers();

      expect(mockQueryBuilder.leftJoin).toHaveBeenCalledWith(
        expect.anything(),
        'ts',
        'ts.vouchers_id = v.id AND ts.validation_status = :confirmedStatus',
        { confirmedStatus: ValidationStatus.CONFIRMED },
      );
      expect(mockQueryBuilder.andWhere).toHaveBeenCalledWith('ts.id IS NULL');
    });
  });
});
