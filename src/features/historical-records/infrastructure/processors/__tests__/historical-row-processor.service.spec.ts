import { Test, TestingModule } from '@nestjs/testing';
import { HistoricalRowProcessorService } from '../historical-row-processor.service';
import { EnsurePeriodExistsUseCase } from '@/features/payment-management/application/ensure-period-exists.use-case';
import { CtaRecordCreatorService } from '../cta-record-creator.service';
import { RecordRepository } from '@/shared/database/repositories/record.repository';
import { HouseRecordRepository } from '@/shared/database/repositories/house-record.repository';
import { TransactionBankRepository } from '@/shared/database/repositories/transaction-bank.repository';
import { TransactionStatusRepository } from '@/shared/database/repositories/transaction-status.repository';
import { EnsureHouseExistsService } from '@/shared/database/services/ensure-house-exists.service';
import { TransactionalRetryService } from '@/shared/database/services/transactional-retry.service';
import { HistoricalRecordRow } from '../../../domain/historical-record-row.entity';
import { ValidationStatus } from '@/shared/database/entities/enums';

describe('HistoricalRowProcessorService', () => {
  let service: HistoricalRowProcessorService;
  let ensurePeriodExistsUseCase: jest.Mocked<EnsurePeriodExistsUseCase>;
  let ctaRecordCreatorService: jest.Mocked<CtaRecordCreatorService>;
  let recordRepository: jest.Mocked<RecordRepository>;
  let houseRecordRepository: jest.Mocked<HouseRecordRepository>;
  let transactionBankRepository: jest.Mocked<TransactionBankRepository>;
  let transactionStatusRepository: jest.Mocked<TransactionStatusRepository>;
  let ensureHouseExistsService: jest.Mocked<EnsureHouseExistsService>;
  let transactionalRetryService: jest.Mocked<TransactionalRetryService>;

  const mockPeriod = { id: 1, year: 2025, month: 1 };
  const mockHouse = { id: 42, number_house: 42, user_id: 'user123' };
  const mockTransactionBank = {
    id: 'bank_txn_123',
    date: '2025-01-15',
    amount: 1500.0,
  };
  const mockTransactionStatus = { id: 1, validation_status: ValidationStatus.CONFIRMED };
  const mockRecord = { id: 1 };
  const mockHouseRecord = { id: 1, house_id: 42, record_id: 1 };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HistoricalRowProcessorService,
        {
          provide: EnsurePeriodExistsUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: CtaRecordCreatorService,
          useValue: {
            createCtaRecords: jest.fn(),
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
          provide: TransactionBankRepository,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: TransactionStatusRepository,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: EnsureHouseExistsService,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: TransactionalRetryService,
          useValue: {
            executeWithRetry: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<HistoricalRowProcessorService>(
      HistoricalRowProcessorService,
    );
    ensurePeriodExistsUseCase = module.get(
      EnsurePeriodExistsUseCase,
    ) as jest.Mocked<EnsurePeriodExistsUseCase>;
    ctaRecordCreatorService = module.get(
      CtaRecordCreatorService,
    ) as jest.Mocked<CtaRecordCreatorService>;
    recordRepository = module.get(RecordRepository) as jest.Mocked<
      RecordRepository
    >;
    houseRecordRepository = module.get(HouseRecordRepository) as jest.Mocked<
      HouseRecordRepository
    >;
    transactionBankRepository = module.get(
      TransactionBankRepository,
    ) as jest.Mocked<TransactionBankRepository>;
    transactionStatusRepository = module.get(
      TransactionStatusRepository,
    ) as jest.Mocked<TransactionStatusRepository>;
    ensureHouseExistsService = module.get(
      EnsureHouseExistsService,
    ) as jest.Mocked<EnsureHouseExistsService>;
    transactionalRetryService = module.get(
      TransactionalRetryService,
    ) as jest.Mocked<TransactionalRetryService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('processRow', () => {
    it('should successfully process identified payment row (casa > 0)', async () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago mensual',
        deposito: 1500.42,
        casa: 42,
        cuotaExtra: 100,
        mantto: 800,
        penalizacion: 50,
        agua: 550,
        rowNumber: 2,
      });

      const mockQueryRunner = {
        manager: {
          create: jest.fn().mockReturnValue(mockTransactionBank),
          save: jest.fn().mockResolvedValue(mockTransactionBank),
        },
      };

      ensurePeriodExistsUseCase.execute.mockResolvedValue(mockPeriod as any);
      transactionalRetryService.executeWithRetry.mockImplementation(
        async (callback: any) => {
          return await callback(mockQueryRunner);
        },
      );
      transactionStatusRepository.create.mockResolvedValue(mockTransactionStatus as any);
      ctaRecordCreatorService.createCtaRecords.mockResolvedValue({});
      recordRepository.create.mockResolvedValue(mockRecord as any);
      ensureHouseExistsService.execute.mockResolvedValue({
        house: mockHouse,
        wasCreated: false,
      } as any);
      houseRecordRepository.create.mockResolvedValue(mockHouseRecord as any);

      const result = await service.processRow(row, 'BBVA');

      expect(ensurePeriodExistsUseCase.execute).toHaveBeenCalledWith(2025, 1);
      expect(transactionalRetryService.executeWithRetry).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });

    it('should successfully process unidentified payment row (casa = 0)', async () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago sin identificar',
        deposito: 1500.0,
        casa: 0,
        cuotaExtra: 0,
        mantto: 0,
        penalizacion: 0,
        agua: 0,
        rowNumber: 2,
      });

      const mockQueryRunner = {
        manager: {
          create: jest.fn().mockReturnValue(mockTransactionBank),
          save: jest.fn().mockResolvedValue(mockTransactionBank),
        },
      };

      ensurePeriodExistsUseCase.execute.mockResolvedValue(mockPeriod as any);
      transactionalRetryService.executeWithRetry.mockImplementation(
        async (callback: any) => {
          return await callback(mockQueryRunner);
        },
      );
      transactionStatusRepository.create.mockResolvedValue(mockTransactionStatus as any);
      ctaRecordCreatorService.createCtaRecords.mockResolvedValue({});

      const result = await service.processRow(row, 'BBVA');

      expect(result.success).toBe(true);
      expect(result.recordId).toBeUndefined();
    });

    it('should return validation error for invalid row', async () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: '',
        deposito: -100,
        casa: 42,
        cuotaExtra: 0,
        mantto: 0,
        penalizacion: 0,
        agua: 0,
        rowNumber: 2,
      });

      const result = await service.processRow(row, 'BBVA');

      expect(result.success).toBe(false);
      expect(result.error?.error_type).toBe('validation');
      expect(ensurePeriodExistsUseCase.execute).not.toHaveBeenCalled();
    });

    it('should handle transactional errors gracefully', async () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago mensual',
        deposito: 1350.0,
        casa: 42,
        cuotaExtra: 0,
        mantto: 800,
        penalizacion: 0,
        agua: 550,
        rowNumber: 2,
      });

      ensurePeriodExistsUseCase.execute.mockResolvedValue(mockPeriod as any);
      transactionalRetryService.executeWithRetry.mockRejectedValue(
        new Error('Database connection error'),
      );

      const result = await service.processRow(row, 'BBVA');

      expect(result.success).toBe(false);
      expect(result.error?.error_type).toBe('database');
      expect(result.error?.message).toBe('Database connection error');
    });

    it('should handle period creation errors', async () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago mensual',
        deposito: 1350.0,
        casa: 42,
        cuotaExtra: 0,
        mantto: 800,
        penalizacion: 0,
        agua: 550,
        rowNumber: 2,
      });

      ensurePeriodExistsUseCase.execute.mockRejectedValue(
        new Error('Failed to create period'),
      );

      await expect(service.processRow(row, 'BBVA')).rejects.toThrow(
        'Failed to create period',
      );
    });

    it('should include error details in failed result', async () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago problemático',
        deposito: 1500.0,
        casa: 99,
        cuotaExtra: 0,
        mantto: 0,
        penalizacion: 0,
        agua: 0,
        rowNumber: 5,
      });

      ensurePeriodExistsUseCase.execute.mockResolvedValue(mockPeriod as any);
      transactionalRetryService.executeWithRetry.mockRejectedValue(
        new Error('Casa 99 no existe'),
      );

      const result = await service.processRow(row, 'BBVA');

      expect(result.success).toBe(false);
      expect(result.error?.row_number).toBe(5);
      expect(result.error?.details).toEqual({
        concepto: 'Pago problemático',
        deposito: 1500.0,
        casa: 99,
      });
    });

    it('should handle unknown errors', async () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago',
        deposito: 800.0,
        casa: 42,
        cuotaExtra: 0,
        mantto: 800,
        penalizacion: 0,
        agua: 0,
        rowNumber: 2,
      });

      ensurePeriodExistsUseCase.execute.mockResolvedValue(mockPeriod as any);
      transactionalRetryService.executeWithRetry.mockRejectedValue(
        'Unknown error',
      );

      const result = await service.processRow(row, 'BBVA');

      expect(result.success).toBe(false);
      expect(result.error?.message).toBe('Error desconocido al procesar la fila');
    });

    it('should process row with different bank names', async () => {
      const row = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago',
        deposito: 800.0,
        casa: 15,
        cuotaExtra: 0,
        mantto: 800,
        penalizacion: 0,
        agua: 0,
        rowNumber: 2,
      });

      const mockQueryRunner = {
        manager: {
          create: jest.fn().mockReturnValue(mockTransactionBank),
          save: jest.fn().mockResolvedValue(mockTransactionBank),
        },
      };

      ensurePeriodExistsUseCase.execute.mockResolvedValue(mockPeriod as any);
      transactionalRetryService.executeWithRetry.mockImplementation(
        async (callback: any) => {
          return await callback(mockQueryRunner);
        },
      );
      transactionStatusRepository.create.mockResolvedValue(mockTransactionStatus as any);
      ctaRecordCreatorService.createCtaRecords.mockResolvedValue({});
      recordRepository.create.mockResolvedValue(mockRecord as any);
      ensureHouseExistsService.execute.mockResolvedValue({
        house: mockHouse,
        wasCreated: false,
      } as any);
      houseRecordRepository.create.mockResolvedValue(mockHouseRecord as any);

      await service.processRow(row, 'BBVA');
      await service.processRow(row, 'Santander');
      await service.processRow(row, 'BanRegio');

      expect(transactionalRetryService.executeWithRetry).toHaveBeenCalledTimes(
        3,
      );
    });

    it('should validate amount distribution correctly', async () => {
      const invalidRow = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago con monto incorrecto',
        deposito: 1500.0,
        casa: 42,
        cuotaExtra: 100,
        mantto: 800,
        penalizacion: 0,
        agua: 500,
        rowNumber: 2,
      });

      const result = await service.processRow(invalidRow, 'BBVA');

      expect(result.success).toBe(false);
      expect(result.error?.error_type).toBe('validation');
      expect(result.error?.message).toContain('Amount distribution error');
    });
  });
});
