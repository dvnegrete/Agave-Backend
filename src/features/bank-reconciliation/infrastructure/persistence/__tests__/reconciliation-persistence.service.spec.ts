import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { ReconciliationPersistenceService } from '../reconciliation-persistence.service';
import { TransactionStatusRepository } from '@/shared/database/repositories/transaction-status.repository';
import { RecordRepository } from '@/shared/database/repositories/record.repository';
import { HouseRecordRepository } from '@/shared/database/repositories/house-record.repository';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { GcsCleanupService } from '@/shared/gcs/services/gcs-cleanup.service';
import { AllocatePaymentUseCase } from '@/features/payment-management/application';
import { TransactionBankRepository } from '@/shared/database/repositories/transaction-bank.repository';
import { EnsureHouseExistsService } from '@/features/user-management/infrastructure/services';

describe('ReconciliationPersistenceService', () => {
  let service: ReconciliationPersistenceService;
  let dataSource: jest.Mocked<DataSource>;
  let transactionStatusRepository: jest.Mocked<TransactionStatusRepository>;
  let recordRepository: jest.Mocked<RecordRepository>;
  let houseRecordRepository: jest.Mocked<HouseRecordRepository>;
  let houseRepository: jest.Mocked<HouseRepository>;
  let voucherRepository: jest.Mocked<VoucherRepository>;
  let gcsCleanupService: jest.Mocked<GcsCleanupService>;
  let allocatePaymentUseCase: jest.Mocked<AllocatePaymentUseCase>;
  let transactionBankRepository: jest.Mocked<TransactionBankRepository>;
  let ensureHouseExistsService: jest.Mocked<EnsureHouseExistsService>;

  const mockQueryRunner: Partial<QueryRunner> = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockTransactionBank = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    date: new Date('2026-02-14'),
    amount: 10000,
    is_deposit: true,
    confirmation_status: false,
  };

  const mockVoucher = {
    id: 1,
    confirmation_code: 'CODE123',
    url: 'https://bucket.com/receipt.pdf',
    confirmation_status: false,
  };

  const mockHouse = {
    id: 1,
    number_house: 42,
    user_id: 'user-uuid',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReconciliationPersistenceService,
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          },
        },
        {
          provide: TransactionStatusRepository,
          useValue: {
            create: jest.fn(),
            findByTransactionId: jest.fn(),
          },
        },
        {
          provide: RecordRepository,
          useValue: {
            create: jest.fn(),
            findOne: jest.fn(),
          },
        },
        {
          provide: HouseRecordRepository,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: HouseRepository,
          useValue: {
            findByNumberHouse: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: VoucherRepository,
          useValue: {
            findOne: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: GcsCleanupService,
          useValue: {
            deleteFile: jest.fn(),
          },
        },
        {
          provide: AllocatePaymentUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: TransactionBankRepository,
          useValue: {
            update: jest.fn(),
          },
        },
        {
          provide: EnsureHouseExistsService,
          useValue: {
            ensure: jest.fn(),
          },
        },
        {
          provide: Logger,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<ReconciliationPersistenceService>(
      ReconciliationPersistenceService,
    );
    dataSource = module.get(DataSource);
    transactionStatusRepository = module.get(TransactionStatusRepository);
    recordRepository = module.get(RecordRepository);
    houseRecordRepository = module.get(HouseRecordRepository);
    houseRepository = module.get(HouseRepository);
    voucherRepository = module.get(VoucherRepository);
    gcsCleanupService = module.get(GcsCleanupService);
    allocatePaymentUseCase = module.get(AllocatePaymentUseCase);
    transactionBankRepository = module.get(TransactionBankRepository);
    ensureHouseExistsService = module.get(EnsureHouseExistsService);
  });

  describe('persistReconciliation', () => {
    it('should reconcile with valid house number and voucher', async () => {
      const transactionId = mockTransactionBank.id;
      const houseNumber = 42;

      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      (mockQueryRunner.manager as any).create.mockReturnValue({
        validation_status: 'confirmed',
      });
      (mockQueryRunner.manager as any).save.mockResolvedValue({});
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      await service.persistReconciliation(
        transactionId,
        mockVoucher as any,
        houseNumber,
      );

      expect(dataSource.createQueryRunner).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should reconcile without voucher', async () => {
      const transactionId = mockTransactionBank.id;
      const houseNumber = 42;

      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      (mockQueryRunner.manager as any).create.mockReturnValue({
        validation_status: 'confirmed',
      });
      (mockQueryRunner.manager as any).save.mockResolvedValue({});
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      await service.persistReconciliation(transactionId, null, houseNumber);

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should reject invalid house number (< 1)', async () => {
      const transactionId = mockTransactionBank.id;
      const invalidHouseNumber = 0;

      await expect(
        service.persistReconciliation(transactionId, mockVoucher as any, invalidHouseNumber),
      ).rejects.toThrow();

      expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should reject invalid house number (> 66)', async () => {
      const transactionId = mockTransactionBank.id;
      const invalidHouseNumber = 67;

      await expect(
        service.persistReconciliation(transactionId, mockVoucher as any, invalidHouseNumber),
      ).rejects.toThrow();

      expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should set confirmation_status = true on transaction', async () => {
      const transactionId = mockTransactionBank.id;

      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      (mockQueryRunner.manager as any).create.mockReturnValue({});
      (mockQueryRunner.manager as any).save.mockResolvedValue({});
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      await service.persistReconciliation(
        transactionId,
        mockVoucher as any,
        42,
      );

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should clean up file from GCS if voucher has URL', async () => {
      const transactionId = mockTransactionBank.id;

      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      (mockQueryRunner.manager as any).create.mockReturnValue({});
      (mockQueryRunner.manager as any).save.mockResolvedValue({});
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      await service.persistReconciliation(
        transactionId,
        mockVoucher as any,
        42,
      );

      expect(gcsCleanupService.deleteFile).toHaveBeenCalledWith(
        mockVoucher.url,
      );
    });

    it('should handle allocation failure gracefully (not rollback)', async () => {
      const transactionId = mockTransactionBank.id;

      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      (mockQueryRunner.manager as any).create.mockReturnValue({});
      (mockQueryRunner.manager as any).save.mockResolvedValue({});
      allocatePaymentUseCase.execute.mockRejectedValue(
        new Error('Allocation failed'),
      );

      // Should not throw
      await service.persistReconciliation(
        transactionId,
        mockVoucher as any,
        42,
      );

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should rollback on transaction error', async () => {
      const transactionId = mockTransactionBank.id;

      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      (mockQueryRunner.manager as any).save.mockRejectedValue(
        new Error('Save failed'),
      );

      await expect(
        service.persistReconciliation(transactionId, mockVoucher as any, 42),
      ).rejects.toThrow();

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should handle house number boundary (1)', async () => {
      const transactionId = mockTransactionBank.id;

      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      (mockQueryRunner.manager as any).create.mockReturnValue({});
      (mockQueryRunner.manager as any).save.mockResolvedValue({});
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      await service.persistReconciliation(transactionId, mockVoucher as any, 1);

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should handle house number boundary (66)', async () => {
      const transactionId = mockTransactionBank.id;

      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      (mockQueryRunner.manager as any).create.mockReturnValue({});
      (mockQueryRunner.manager as any).save.mockResolvedValue({});
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      await service.persistReconciliation(transactionId, mockVoucher as any, 66);

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should create transaction status with CONFIRMED validation', async () => {
      const transactionId = mockTransactionBank.id;

      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      (mockQueryRunner.manager as any).create.mockReturnValue({
        validation_status: 'confirmed',
      });
      (mockQueryRunner.manager as any).save.mockResolvedValue({});
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      await service.persistReconciliation(
        transactionId,
        mockVoucher as any,
        42,
      );

      const createCall = (mockQueryRunner.manager as any).create.mock.calls[0];
      expect(createCall[1]).toEqual(
        expect.objectContaining({
          validation_status: 'confirmed',
        }),
      );
    });
  });

  describe('persistSurplus', () => {
    it('should create transaction status with CONFLICT for surplus', async () => {
      const transactionId = mockTransactionBank.id;
      const surplus = {
        reason: 'Conflicto en mapeo',
        transactionBankId: transactionId,
        amount: 5000,
      };

      (mockQueryRunner.manager as any).create.mockReturnValue({
        validation_status: 'conflict',
      });
      (mockQueryRunner.manager as any).save.mockResolvedValue({});

      await service.persistSurplus(transactionId, surplus as any);

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should create transaction status with NOT_FOUND for unmatched', async () => {
      const transactionId = mockTransactionBank.id;
      const surplus = {
        reason: 'No coincide con ninguna casa',
        transactionBankId: transactionId,
        amount: 5000,
      };

      (mockQueryRunner.manager as any).create.mockReturnValue({
        validation_status: 'not_found',
      });
      (mockQueryRunner.manager as any).save.mockResolvedValue({});

      await service.persistSurplus(transactionId, surplus as any);

      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });
  });

  describe('persistManualValidationCase', () => {
    it('should create transaction status with REQUIRES_MANUAL', async () => {
      const transactionId = mockTransactionBank.id;
      const manualCase = {
        transactionBankId: transactionId,
        possibleMatches: [
          { houseNumber: 10, confidence: 0.8 },
          { houseNumber: 20, confidence: 0.6 },
        ],
      };

      (mockQueryRunner.manager as any).create.mockReturnValue({
        validation_status: 'requires_manual',
      });
      (mockQueryRunner.manager as any).save.mockResolvedValue({});

      await service.persistManualValidationCase(transactionId, manualCase as any);

      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should save possible matches in metadata', async () => {
      const transactionId = mockTransactionBank.id;
      const manualCase = {
        transactionBankId: transactionId,
        possibleMatches: [{ houseNumber: 10, confidence: 0.8 }],
      };

      (mockQueryRunner.manager as any).create.mockReturnValue({
        validation_status: 'requires_manual',
      });
      (mockQueryRunner.manager as any).save.mockResolvedValue({});

      await service.persistManualValidationCase(transactionId, manualCase as any);

      const createCall = (mockQueryRunner.manager as any).create.mock.calls[0];
      expect(createCall[1]).toEqual(
        expect.objectContaining({
          validation_status: 'requires_manual',
        }),
      );
    });
  });
});
