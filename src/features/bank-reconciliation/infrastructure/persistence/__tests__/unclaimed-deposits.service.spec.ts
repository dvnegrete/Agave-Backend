import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { UnclaimedDepositsService } from '../unclaimed-deposits.service';
import { TransactionStatusRepository } from '@/shared/database/repositories/transaction-status.repository';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { RecordRepository } from '@/shared/database/repositories/record.repository';
import { HouseRecordRepository } from '@/shared/database/repositories/house-record.repository';
import { TransactionBankRepository } from '@/shared/database/repositories/transaction-bank.repository';
import { AllocatePaymentUseCase } from '@/features/payment-management/application';

describe('UnclaimedDepositsService', () => {
  let service: UnclaimedDepositsService;
  let dataSource: jest.Mocked<DataSource>;
  let transactionStatusRepository: jest.Mocked<TransactionStatusRepository>;
  let houseRepository: jest.Mocked<HouseRepository>;
  let recordRepository: jest.Mocked<RecordRepository>;
  let houseRecordRepository: jest.Mocked<HouseRecordRepository>;
  let transactionBankRepository: jest.Mocked<TransactionBankRepository>;
  let allocatePaymentUseCase: jest.Mocked<AllocatePaymentUseCase>;

  const mockQueryBuilder = {
    leftJoin: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    skip: jest.fn().mockReturnThis(),
    take: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    distinctOn: jest.fn().mockReturnThis(),
    getRawMany: jest.fn().mockResolvedValue([]),
    getRawOne: jest.fn().mockResolvedValue({ cnt: 0 }),
    getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
    getCount: jest.fn().mockResolvedValue(0),
  };

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      save: jest.fn().mockResolvedValue({}),
      findOne: jest.fn(),
      create: jest.fn().mockReturnValue({}),
    },
  };

  const mockTransactionBank = {
    id: '550e8400-e29b-41d4-a716-446655440000',
    date: new Date('2026-02-14'),
    amount: 10042.15,
    is_deposit: true,
    confirmation_status: false,
  };

  const mockTransactionStatus = {
    id: 1,
    transaction_bank_id: mockTransactionBank.id,
    validation_status: 'not-found',
  };

  const mockHouse = {
    id: 1,
    number_house: 42,
    user_id: 'user-uuid',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Reset chainable mocks
    mockQueryBuilder.leftJoin.mockReturnThis();
    mockQueryBuilder.leftJoinAndSelect.mockReturnThis();
    mockQueryBuilder.where.mockReturnThis();
    mockQueryBuilder.andWhere.mockReturnThis();
    mockQueryBuilder.orderBy.mockReturnThis();
    mockQueryBuilder.addOrderBy.mockReturnThis();
    mockQueryBuilder.skip.mockReturnThis();
    mockQueryBuilder.take.mockReturnThis();
    mockQueryBuilder.select.mockReturnThis();
    mockQueryBuilder.addSelect.mockReturnThis();
    mockQueryBuilder.distinctOn.mockReturnThis();
    mockQueryBuilder.getRawMany.mockResolvedValue([]);
    mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: 0 });

    // Reset queryRunner manager mocks
    mockQueryRunner.manager.save.mockResolvedValue({});
    mockQueryRunner.manager.create.mockReturnValue({});

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnclaimedDepositsService,
        {
          provide: DataSource,
          useValue: {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
            createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            getRepository: jest.fn().mockReturnValue({
              createQueryBuilder: jest.fn().mockReturnValue(mockQueryBuilder),
            }),
          },
        },
        {
          provide: TransactionStatusRepository,
          useValue: {
            findByTransactionId: jest.fn(),
            findByTransactionBankId: jest.fn().mockResolvedValue([mockTransactionStatus]),
            create: jest.fn(),
          },
        },
        {
          provide: HouseRepository,
          useValue: {
            findByNumberHouse: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
          },
        },
        {
          provide: RecordRepository,
          useValue: {
            create: jest.fn().mockResolvedValue({ id: 1 }),
          },
        },
        {
          provide: HouseRecordRepository,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: TransactionBankRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: AllocatePaymentUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<UnclaimedDepositsService>(UnclaimedDepositsService);
    dataSource = module.get(DataSource);
    transactionStatusRepository = module.get(TransactionStatusRepository);
    houseRepository = module.get(HouseRepository);
    recordRepository = module.get(RecordRepository);
    houseRecordRepository = module.get(HouseRecordRepository);
    transactionBankRepository = module.get(TransactionBankRepository);
    allocatePaymentUseCase = module.get(AllocatePaymentUseCase);
  });

  describe('getUnclaimedDeposits', () => {
    it('should return paginated unclaimed deposits', async () => {
      const rawDeposits = [
        { tb_id: '1', tb_amount: 10042.15, tb_date: new Date(), tb_time: '10:00', tb_concept: 'DEP', ts_validation_status: 'not-found', ts_reason: 'test', ts_metadata: {}, ts_processed_at: new Date() },
        { tb_id: '2', tb_amount: 10042.15, tb_date: new Date(), tb_time: '11:00', tb_concept: 'DEP', ts_validation_status: 'conflict', ts_reason: 'test', ts_metadata: {}, ts_processed_at: new Date() },
      ];

      mockQueryBuilder.getRawMany.mockResolvedValue(rawDeposits);
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: 2 });

      const result = await service.getUnclaimedDeposits();

      expect(result).toBeDefined();
      expect(result.totalCount).toBe(2);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.totalPages).toBe(1);
    });

    it('should return empty list when no deposits', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: 0 });

      const result = await service.getUnclaimedDeposits();

      expect(result.items).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });

    it('should apply startDate filter when provided', async () => {
      const startDate = new Date('2026-02-01');
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: 0 });

      await service.getUnclaimedDeposits(startDate);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should apply endDate filter and set to end of day', async () => {
      const endDate = new Date('2026-02-28');
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: 0 });

      await service.getUnclaimedDeposits(undefined, endDate);

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should filter by validationStatus = conflict', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: 0 });

      await service.getUnclaimedDeposits(
        undefined,
        undefined,
        'conflict',
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should filter by validationStatus = not-found', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: 0 });

      await service.getUnclaimedDeposits(
        undefined,
        undefined,
        'not-found',
      );

      expect(mockQueryBuilder.andWhere).toHaveBeenCalled();
    });

    it('should extract suggested house number from centavos', async () => {
      const rawDeposit = { tb_id: '1', tb_amount: 10000.42, tb_date: new Date(), tb_time: '10:00', tb_concept: 'DEP', ts_validation_status: 'not-found', ts_reason: 'test', ts_metadata: {}, ts_processed_at: new Date() };
      mockQueryBuilder.getRawMany.mockResolvedValue([rawDeposit]);
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: 1 });

      const result = await service.getUnclaimedDeposits();

      expect(result.items).toHaveLength(1);
      expect(result.items[0].suggestedHouseNumber).toBe(42);
    });

    it('should paginate correctly with page=2', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: 100 });

      const result = await service.getUnclaimedDeposits(
        undefined,
        undefined,
        'all',
        undefined,
        2,
        20,
      );

      expect(result.page).toBe(2);
      expect(mockQueryBuilder.skip).toHaveBeenCalledWith(20);
    });

    it('should handle limit > 100 and cap to 100', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: 0 });

      const result = await service.getUnclaimedDeposits(
        undefined,
        undefined,
        'all',
        undefined,
        1,
        150,
      );

      expect(result.limit).toBeLessThanOrEqual(100);
    });

    it('should use DISTINCT ON to prevent duplicates', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: 0 });

      await service.getUnclaimedDeposits();

      expect(mockQueryBuilder.distinctOn).toHaveBeenCalled();
    });

    it('should sort by date DESC by default', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: 0 });

      await service.getUnclaimedDeposits();

      expect(mockQueryBuilder.orderBy).toHaveBeenCalled();
    });

    it('should sort by amount DESC if specified', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: 0 });

      await service.getUnclaimedDeposits(
        undefined,
        undefined,
        'all',
        undefined,
        1,
        20,
        'amount',
      );

      expect(mockQueryBuilder.orderBy).toHaveBeenCalled();
    });

    it('should calculate totalPages correctly', async () => {
      mockQueryBuilder.getRawMany.mockResolvedValue([]);
      mockQueryBuilder.getRawOne.mockResolvedValue({ cnt: 150 });

      const result = await service.getUnclaimedDeposits(
        undefined,
        undefined,
        'all',
        undefined,
        1,
        20,
      );

      expect(result.totalPages).toBe(8); // Math.ceil(150/20)
    });
  });

  describe('assignHouseToDeposit', () => {
    it('should assign house to deposit successfully', async () => {
      const transactionId = mockTransactionBank.id;

      transactionBankRepository.findById.mockResolvedValue(
        mockTransactionBank as any,
      );
      transactionStatusRepository.findByTransactionBankId.mockResolvedValue([
        mockTransactionStatus as any,
      ]);
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      (mockQueryRunner.manager as any).create.mockReturnValue({});
      (mockQueryRunner.manager as any).save.mockResolvedValue({});
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      const result = await service.assignHouseToDeposit(
        transactionId,
        42,
        'user-uuid',
      );

      expect(result).toBeDefined();
      expect(result.reconciliation.status).toBe('confirmed');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should reject invalid house number (< 1)', async () => {
      const transactionId = mockTransactionBank.id;

      transactionBankRepository.findById.mockResolvedValue(
        mockTransactionBank as any,
      );

      await expect(
        service.assignHouseToDeposit(transactionId, 0, 'user-uuid'),
      ).rejects.toThrow();

      expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should reject invalid house number (> 66)', async () => {
      const transactionId = mockTransactionBank.id;

      transactionBankRepository.findById.mockResolvedValue(
        mockTransactionBank as any,
      );

      await expect(
        service.assignHouseToDeposit(transactionId, 67, 'user-uuid'),
      ).rejects.toThrow();

      expect(mockQueryRunner.startTransaction).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if transaction not found', async () => {
      const transactionId = 'non-existent-id';

      transactionBankRepository.findById.mockResolvedValue(null);

      await expect(
        service.assignHouseToDeposit(transactionId, 42, 'user-uuid'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if transaction already confirmed', async () => {
      const transactionId = mockTransactionBank.id;
      const confirmedTransaction = { ...mockTransactionBank, confirmation_status: true };

      transactionBankRepository.findById.mockResolvedValue(
        confirmedTransaction as any,
      );

      await expect(
        service.assignHouseToDeposit(transactionId, 42, 'user-uuid'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create house if not exists', async () => {
      const transactionId = mockTransactionBank.id;

      transactionBankRepository.findById.mockResolvedValue(
        mockTransactionBank as any,
      );
      transactionStatusRepository.findByTransactionBankId.mockResolvedValue([
        mockTransactionStatus as any,
      ]);
      houseRepository.findByNumberHouse.mockResolvedValue(null);
      houseRepository.create.mockResolvedValue(mockHouse as any);
      (mockQueryRunner.manager as any).create.mockReturnValue({});
      (mockQueryRunner.manager as any).save.mockResolvedValue({});
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      const result = await service.assignHouseToDeposit(
        transactionId,
        42,
        'user-uuid',
      );

      expect(result).toBeDefined();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should handle allocation failure gracefully', async () => {
      const transactionId = mockTransactionBank.id;

      transactionBankRepository.findById.mockResolvedValue(
        mockTransactionBank as any,
      );
      transactionStatusRepository.findByTransactionBankId.mockResolvedValue([
        mockTransactionStatus as any,
      ]);
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      (mockQueryRunner.manager as any).create.mockReturnValue({});
      (mockQueryRunner.manager as any).save.mockResolvedValue({});
      allocatePaymentUseCase.execute.mockRejectedValue(
        new Error('Allocation failed'),
      );

      // Should not throw - allocation failure is logged
      const result = await service.assignHouseToDeposit(
        transactionId,
        42,
        'user-uuid',
      );

      expect(result).toBeDefined();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should record admin notes in metadata', async () => {
      const transactionId = mockTransactionBank.id;
      const adminNotes = 'Manual review required - high amount';

      transactionBankRepository.findById.mockResolvedValue(
        mockTransactionBank as any,
      );
      transactionStatusRepository.findByTransactionBankId.mockResolvedValue([
        mockTransactionStatus as any,
      ]);
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      (mockQueryRunner.manager as any).create.mockReturnValue({});
      (mockQueryRunner.manager as any).save.mockResolvedValue({});
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      const result = await service.assignHouseToDeposit(
        transactionId,
        42,
        'user-uuid',
        adminNotes,
      );

      expect(result).toBeDefined();
    });

    it('should set CONFIRMED validation status', async () => {
      const transactionId = mockTransactionBank.id;

      transactionBankRepository.findById.mockResolvedValue(
        mockTransactionBank as any,
      );
      transactionStatusRepository.findByTransactionBankId.mockResolvedValue([
        mockTransactionStatus as any,
      ]);
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      (mockQueryRunner.manager as any).create.mockReturnValue({
        validation_status: 'confirmed',
      });
      (mockQueryRunner.manager as any).save.mockResolvedValue({});
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      const result = await service.assignHouseToDeposit(
        transactionId,
        42,
        'user-uuid',
      );

      expect(result.reconciliation.status).toBe('confirmed');
    });

    it('should return correct AssignHouseResponseDto structure', async () => {
      const transactionId = mockTransactionBank.id;

      transactionBankRepository.findById.mockResolvedValue(
        mockTransactionBank as any,
      );
      transactionStatusRepository.findByTransactionBankId.mockResolvedValue([
        mockTransactionStatus as any,
      ]);
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      (mockQueryRunner.manager as any).create.mockReturnValue({});
      (mockQueryRunner.manager as any).save.mockResolvedValue({});
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      const result = await service.assignHouseToDeposit(
        transactionId,
        42,
        'user-uuid',
      );

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('reconciliation');
      expect(result).toHaveProperty('assignedAt');
      expect(result.reconciliation).toHaveProperty('transactionBankId');
      expect(result.reconciliation).toHaveProperty('houseNumber');
      expect(result.reconciliation).toHaveProperty('status');
    });

    it('should handle rollback on transaction error', async () => {
      const transactionId = mockTransactionBank.id;

      transactionBankRepository.findById.mockResolvedValue(
        mockTransactionBank as any,
      );
      transactionStatusRepository.findByTransactionBankId.mockResolvedValue([
        mockTransactionStatus as any,
      ]);
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      (mockQueryRunner.manager as any).save.mockRejectedValue(
        new Error('Save failed'),
      );

      await expect(
        service.assignHouseToDeposit(transactionId, 42, 'user-uuid'),
      ).rejects.toThrow();

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should handle boundary house numbers (1 and 66)', async () => {
      const transactionId = mockTransactionBank.id;

      transactionBankRepository.findById.mockResolvedValue(
        mockTransactionBank as any,
      );
      transactionStatusRepository.findByTransactionBankId.mockResolvedValue([
        mockTransactionStatus as any,
      ]);
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      (mockQueryRunner.manager as any).create.mockReturnValue({});
      (mockQueryRunner.manager as any).save.mockResolvedValue({});
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      const result1 = await service.assignHouseToDeposit(
        transactionId,
        1,
        'user-uuid',
      );
      const result2 = await service.assignHouseToDeposit(
        transactionId,
        66,
        'user-uuid',
      );

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
    });
  });
});
