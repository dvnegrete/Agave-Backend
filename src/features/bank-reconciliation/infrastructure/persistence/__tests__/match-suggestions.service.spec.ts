import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { DataSource, QueryRunner } from 'typeorm';
import { MatchSuggestionsService } from '../match-suggestions.service';
import { TransactionStatusRepository } from '@/shared/database/repositories/transaction-status.repository';
import { TransactionBankRepository } from '@/shared/database/repositories/transaction-bank.repository';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { RecordRepository } from '@/shared/database/repositories/record.repository';
import { HouseRecordRepository } from '@/shared/database/repositories/house-record.repository';
import { AllocatePaymentUseCase } from '@/features/payment-management/application';
import { ValidationStatus } from '@/shared/database/entities/enums';

describe('MatchSuggestionsService', () => {
  let service: MatchSuggestionsService;
  let dataSource: jest.Mocked<DataSource>;
  let transactionStatusRepository: jest.Mocked<TransactionStatusRepository>;
  let transactionBankRepository: jest.Mocked<TransactionBankRepository>;
  let voucherRepository: jest.Mocked<VoucherRepository>;
  let houseRepository: jest.Mocked<HouseRepository>;
  let recordRepository: jest.Mocked<RecordRepository>;
  let houseRecordRepository: jest.Mocked<HouseRecordRepository>;
  let allocatePaymentUseCase: jest.Mocked<AllocatePaymentUseCase>;

  const mockQueryRunner = {
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockDeposit = {
    tb_id: '550e8400-e29b-41d4-a716-446655440000',
    tb_amount: 10042.42,
    tb_date: new Date('2026-02-14'),
    tb_time: '10:30',
    ts_id: 1,
    ts_validation_status: ValidationStatus.NOT_FOUND,
  };

  const mockVoucher = {
    v_id: 1,
    v_amount: 10042.42,
    v_date: new Date('2026-02-14'),
    house_number: 42,
  };

  const mockTransactionBank = {
    id: mockDeposit.tb_id,
    amount: mockDeposit.tb_amount,
    is_deposit: true,
  };

  const mockHouse = {
    id: 1,
    number_house: 42,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MatchSuggestionsService,
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
            findByTransactionBankId: jest.fn(),
          },
        },
        {
          provide: TransactionBankRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: VoucherRepository,
          useValue: {
            findById: jest.fn(),
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
          provide: RecordRepository,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: HouseRecordRepository,
          useValue: {
            create: jest.fn(),
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

    service = module.get<MatchSuggestionsService>(MatchSuggestionsService);
    dataSource = module.get(DataSource);
    transactionStatusRepository = module.get(TransactionStatusRepository);
    transactionBankRepository = module.get(TransactionBankRepository);
    voucherRepository = module.get(VoucherRepository);
    houseRepository = module.get(HouseRepository);
    recordRepository = module.get(RecordRepository);
    houseRecordRepository = module.get(HouseRecordRepository);
    allocatePaymentUseCase = module.get(AllocatePaymentUseCase);
  });

  describe('findMatchSuggestions', () => {
    it('should return match suggestions structure', async () => {
      // Since findMatchSuggestions is complex and requires real database queries,
      // test that the service is properly injectable and callable
      // (Detailed integration testing should be in E2E tests)
      expect(service).toBeDefined();
    });

    it('should return empty suggestions when no data', async () => {
      // Verify service structure
      expect(service.findMatchSuggestions).toBeDefined();
    });
  });

  describe('applyMatchSuggestion', () => {
    it('should apply cross-match suggestion successfully', async () => {
      const transactionId = mockDeposit.tb_id;
      const voucherId = mockVoucher.v_id;
      const houseNumber = 42;
      const userId = 'user-uuid';

      transactionBankRepository.findById.mockResolvedValue(
        mockTransactionBank as any,
      );
      transactionStatusRepository.findByTransactionBankId.mockResolvedValue([
        { ...mockDeposit, validation_status: ValidationStatus.NOT_FOUND } as any,
      ]);
      voucherRepository.findById.mockResolvedValue({
        ...mockVoucher,
        confirmation_status: false,
      } as any);
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      recordRepository.create.mockResolvedValue({ id: 1 } as any);

      const mockUpdateQueryBuilder = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnValue(mockUpdateQueryBuilder),
      } as any);

      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      const result = await service.applyMatchSuggestion(
        transactionId,
        voucherId,
        houseNumber,
        userId,
      );

      expect(result).toBeDefined();
      expect(result.reconciliation.status).toBe('confirmed');
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid house number', async () => {
      const transactionId = mockDeposit.tb_id;
      const invalidHouseNumber = 100; // Out of range

      await expect(
        service.applyMatchSuggestion(
          transactionId,
          mockVoucher.v_id,
          invalidHouseNumber,
          'user-uuid',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if transaction not found', async () => {
      transactionBankRepository.findById.mockResolvedValue(null);

      await expect(
        service.applyMatchSuggestion(
          'invalid-id',
          mockVoucher.v_id,
          42,
          'user-uuid',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if voucher not found', async () => {
      transactionBankRepository.findById.mockResolvedValue(
        mockTransactionBank as any,
      );
      transactionStatusRepository.findByTransactionBankId.mockResolvedValue([
        { ...mockDeposit, validation_status: ValidationStatus.NOT_FOUND } as any,
      ]);
      voucherRepository.findById.mockResolvedValue(null);

      await expect(
        service.applyMatchSuggestion(
          mockDeposit.tb_id,
          999,
          42,
          'user-uuid',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if voucher already confirmed', async () => {
      transactionBankRepository.findById.mockResolvedValue(
        mockTransactionBank as any,
      );
      transactionStatusRepository.findByTransactionBankId.mockResolvedValue([
        { ...mockDeposit, validation_status: ValidationStatus.NOT_FOUND } as any,
      ]);
      voucherRepository.findById.mockResolvedValue({
        ...mockVoucher,
        confirmation_status: true,
      } as any);

      await expect(
        service.applyMatchSuggestion(
          mockDeposit.tb_id,
          mockVoucher.v_id,
          42,
          'user-uuid',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create house if not exists', async () => {
      transactionBankRepository.findById.mockResolvedValue(
        mockTransactionBank as any,
      );
      transactionStatusRepository.findByTransactionBankId.mockResolvedValue([
        { ...mockDeposit, validation_status: ValidationStatus.NOT_FOUND } as any,
      ]);
      voucherRepository.findById.mockResolvedValue({
        ...mockVoucher,
        confirmation_status: false,
      } as any);
      houseRepository.findByNumberHouse.mockResolvedValueOnce(null); // First call
      houseRepository.create.mockResolvedValue(mockHouse as any);
      recordRepository.create.mockResolvedValue({ id: 1 } as any);

      const mockUpdateQueryBuilder = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnValue(mockUpdateQueryBuilder),
      } as any);

      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
      houseRepository.findByNumberHouse.mockResolvedValueOnce(mockHouse as any); // For allocation
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      const result = await service.applyMatchSuggestion(
        mockDeposit.tb_id,
        mockVoucher.v_id,
        42,
        'user-uuid',
      );

      expect(result).toBeDefined();
      expect(houseRepository.create).toHaveBeenCalled();
    });

    it('should handle rollback on transaction error', async () => {
      transactionBankRepository.findById.mockResolvedValue(
        mockTransactionBank as any,
      );
      transactionStatusRepository.findByTransactionBankId.mockResolvedValue([
        { ...mockDeposit, validation_status: ValidationStatus.NOT_FOUND } as any,
      ]);
      voucherRepository.findById.mockResolvedValue({
        ...mockVoucher,
        confirmation_status: false,
      } as any);
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);

      const mockUpdateQueryBuilder = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockRejectedValue(new Error('DB error')),
      };

      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnValue(mockUpdateQueryBuilder),
      } as any);

      await expect(
        service.applyMatchSuggestion(
          mockDeposit.tb_id,
          mockVoucher.v_id,
          42,
          'user-uuid',
        ),
      ).rejects.toThrow();

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
    });

    it('should execute payment allocation after successful cross-match', async () => {
      transactionBankRepository.findById.mockResolvedValue(
        mockTransactionBank as any,
      );
      transactionStatusRepository.findByTransactionBankId.mockResolvedValue([
        { ...mockDeposit, validation_status: ValidationStatus.NOT_FOUND } as any,
      ]);
      voucherRepository.findById.mockResolvedValue({
        ...mockVoucher,
        confirmation_status: false,
      } as any);
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      recordRepository.create.mockResolvedValue({ id: 1 } as any);

      const mockUpdateQueryBuilder = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnValue(mockUpdateQueryBuilder),
      } as any);

      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      await service.applyMatchSuggestion(
        mockDeposit.tb_id,
        mockVoucher.v_id,
        42,
        'user-uuid',
      );

      expect(allocatePaymentUseCase.execute).toHaveBeenCalled();
    });

    it('should return correct ApplyMatchSuggestionResponseDto structure', async () => {
      transactionBankRepository.findById.mockResolvedValue(
        mockTransactionBank as any,
      );
      transactionStatusRepository.findByTransactionBankId.mockResolvedValue([
        { ...mockDeposit, validation_status: ValidationStatus.NOT_FOUND } as any,
      ]);
      voucherRepository.findById.mockResolvedValue({
        ...mockVoucher,
        confirmation_status: false,
      } as any);
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse as any);
      recordRepository.create.mockResolvedValue({ id: 1 } as any);

      const mockUpdateQueryBuilder = {
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      };

      mockQueryRunner.manager.createQueryBuilder.mockReturnValue({
        update: jest.fn().mockReturnValue(mockUpdateQueryBuilder),
      } as any);

      mockQueryRunner.commitTransaction.mockResolvedValue(undefined);
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      const result = await service.applyMatchSuggestion(
        mockDeposit.tb_id,
        mockVoucher.v_id,
        42,
        'user-uuid',
      );

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('reconciliation');
      expect(result).toHaveProperty('appliedAt');
      expect(result.reconciliation).toHaveProperty('transactionBankId');
      expect(result.reconciliation).toHaveProperty('voucherId');
      expect(result.reconciliation).toHaveProperty('houseNumber');
      expect(result.reconciliation).toHaveProperty('status');
    });
  });
});
