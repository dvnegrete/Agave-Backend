import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { ManualValidationService } from '../manual-validation.service';
import { TransactionStatusRepository } from '@/shared/database/repositories/transaction-status.repository';
import { ReconciliationPersistenceService } from '../reconciliation-persistence.service';
import { ValidationStatus } from '@/shared/database/entities/enums';

describe('ManualValidationService', () => {
  let service: ManualValidationService;
  let dataSource: jest.Mocked<DataSource>;
  let transactionStatusRepository: jest.Mocked<TransactionStatusRepository>;
  let persistenceService: jest.Mocked<ReconciliationPersistenceService>;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    query: jest.fn(),
    manager: {
      findOne: jest.fn(),
      update: jest.fn(),
      save: jest.fn(),
    },
  };

  const mockTransactionBank = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    amount: 10042.42,
    date: new Date('2026-02-14'),
    is_deposit: true,
    confirmation_status: false,
  };

  const mockVoucher = {
    id: 1,
    amount: 10042.42,
    date: new Date('2026-02-14'),
  };

  const mockManualCase = {
    transactionId: mockTransactionBank.id,
    voucherId: mockVoucher.id,
    userId: 'user-uuid',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ManualValidationService,
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
            getRepository: jest.fn(),
            query: jest.fn(),
          },
        },
        {
          provide: TransactionStatusRepository,
          useValue: {
            findByTransactionId: jest.fn(),
          },
        },
        {
          provide: ReconciliationPersistenceService,
          useValue: {
            persistReconciliation: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ManualValidationService>(ManualValidationService);
    dataSource = module.get(DataSource);
    transactionStatusRepository = module.get(TransactionStatusRepository);
    persistenceService = module.get(ReconciliationPersistenceService);
  });

  describe('getPendingManualCases', () => {
    it('should return paginated pending manual cases', async () => {
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(50),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      const mockRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      dataSource.getRepository.mockReturnValue(mockRepository as any);

      const result = await service.getPendingManualCases();

      expect(result).toBeDefined();
      expect(result.totalCount).toBe(50);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should apply date filters when provided', async () => {
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      const mockRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      dataSource.getRepository.mockReturnValue(mockRepository as any);

      const startDate = new Date('2026-02-01');
      const endDate = new Date('2026-02-28');

      await service.getPendingManualCases(startDate, endDate);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should apply house number filter when provided', async () => {
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      const mockRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      dataSource.getRepository.mockReturnValue(mockRepository as any);

      await service.getPendingManualCases(undefined, undefined, 42);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should handle pagination correctly', async () => {
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(100),
        getRawMany: jest.fn().mockResolvedValue([]),
      };

      const mockRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      dataSource.getRepository.mockReturnValue(mockRepository as any);

      const result = await service.getPendingManualCases(
        undefined,
        undefined,
        undefined,
        2,
        20,
      );

      expect(result.page).toBe(2);
      expect(result.totalPages).toBe(5);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(20);
    });
  });

  describe('approveManualCase', () => {
    it('should approve manual case successfully', async () => {
      const transactionStatus = {
        id: 1,
        transactions_bank_id: mockTransactionBank.id,
        validation_status: ValidationStatus.REQUIRES_MANUAL,
        metadata: {
          possibleMatches: [
            {
              voucherId: mockVoucher.id,
              houseNumber: 42,
            },
          ],
        },
      };

      mockQueryRunner.query.mockResolvedValue([transactionStatus]);
      mockQueryRunner.manager.findOne.mockResolvedValue(mockTransactionBank);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 });
      mockQueryRunner.manager.save.mockResolvedValue({});
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);

      const result = await service.approveManualCase(
        mockTransactionBank.id,
        mockVoucher.id,
        'user-uuid',
        'Approved by admin',
      );

      expect(result).toBeDefined();
      expect(result.reconciliation.status).toBe(ValidationStatus.CONFIRMED);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if manual case not found', async () => {
      mockQueryRunner.query.mockResolvedValue([]);

      await expect(
        service.approveManualCase(
          'invalid-id',
          mockVoucher.id,
          'user-uuid',
        ),
      ).rejects.toThrow(NotFoundException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException if voucher not in candidates', async () => {
      const transactionStatus = {
        id: 1,
        transactions_bank_id: mockTransactionBank.id,
        validation_status: ValidationStatus.REQUIRES_MANUAL,
        metadata: {
          possibleMatches: [
            {
              voucherId: 999, // Different voucher
            },
          ],
        },
      };

      mockQueryRunner.query.mockResolvedValue([transactionStatus]);

      await expect(
        service.approveManualCase(
          mockTransactionBank.id,
          mockVoucher.id,
          'user-uuid',
        ),
      ).rejects.toThrow(BadRequestException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should handle rollback on error', async () => {
      mockQueryRunner.query.mockRejectedValue(new Error('DB error'));

      await expect(
        service.approveManualCase(
          mockTransactionBank.id,
          mockVoucher.id,
          'user-uuid',
        ),
      ).rejects.toThrow();

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });
  });

  describe('rejectManualCase', () => {
    it('should reject manual case successfully', async () => {
      const transactionStatus = {
        id: 1,
        transactions_bank_id: mockTransactionBank.id,
        validation_status: ValidationStatus.REQUIRES_MANUAL,
        metadata: {},
      };

      mockQueryRunner.query.mockResolvedValue([transactionStatus]);
      mockQueryRunner.manager.update.mockResolvedValue({ affected: 1 });
      mockQueryRunner.manager.save.mockResolvedValue({});
      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);

      const result = await service.rejectManualCase(
        mockTransactionBank.id,
        'user-uuid',
        'No coincide',
        'No suitable match found',
      );

      expect(result).toBeDefined();
      expect(result.newStatus).toBe(ValidationStatus.NOT_FOUND);
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw NotFoundException if case not found', async () => {
      mockQueryRunner.query.mockResolvedValue([]);

      await expect(
        service.rejectManualCase(
          'invalid-id',
          'user-uuid',
          'No match',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('getManualValidationStats', () => {
    it('should return validation stats', async () => {
      const mockQueryBuilder = {
        leftJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getCount: jest
          .fn()
          .mockResolvedValueOnce(10) // totalPending
          .mockResolvedValueOnce(5) // totalApproved
          .mockResolvedValueOnce(3) // totalRejected
          .mockResolvedValueOnce(2), // pendingLast24Hours
      };

      const mockRepository = {
        createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
      };

      dataSource.getRepository.mockReturnValue(mockRepository as any);

      dataSource.query = jest
        .fn()
        .mockResolvedValueOnce([{ avg_minutes: 30 }]) // avgApprovalTime
        .mockResolvedValueOnce([
          // distribution
          { house_range: '1-10', count: '2' },
          { house_range: '11-20', count: '3' },
        ]);

      const result = await service.getManualValidationStats();

      expect(result).toBeDefined();
      expect(result.totalPending).toBe(10);
      expect(result.totalApproved).toBe(5);
      expect(result.totalRejected).toBe(3);
      expect(result.pendingLast24Hours).toBe(2);
    });
  });
});
