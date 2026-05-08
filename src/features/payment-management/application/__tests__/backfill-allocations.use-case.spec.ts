import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { BackfillAllocationsUseCase } from '../backfill-allocations.use-case';
import {
  IRecordAllocationRepository,
  IHousePeriodChargeRepository,
} from '../../interfaces';
import { AllocatePaymentUseCase } from '../allocate-payment.use-case';
import { EnsurePeriodExistsUseCase } from '../ensure-period-exists.use-case';
import { ApplyCreditToPeriodsUseCase } from '../apply-credit-to-periods.use-case';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { HouseStatusSnapshotService } from '../../infrastructure/services/house-status-snapshot.service';
import { AllocationConceptType } from '@/shared/database/entities/enums';

describe('BackfillAllocationsUseCase', () => {
  let useCase: BackfillAllocationsUseCase;
  let dataSource: jest.Mocked<DataSource>;
  let recordAllocationRepository: jest.Mocked<IRecordAllocationRepository>;
  let housePeriodChargeRepository: jest.Mocked<IHousePeriodChargeRepository>;
  let allocatePaymentUseCase: jest.Mocked<AllocatePaymentUseCase>;
  let ensurePeriodExistsUseCase: jest.Mocked<EnsurePeriodExistsUseCase>;
  let applyCreditToPeriodsUseCase: jest.Mocked<ApplyCreditToPeriodsUseCase>;
  let houseRepository: jest.Mocked<HouseRepository>;
  let snapshotService: jest.Mocked<HouseStatusSnapshotService>;

  const mockOrphanRecords = [
    {
      record_id: 1,
      house_id: 42,
      house_number: 42,
      transaction_date: '2025-01-15',
      amount: 800,
    },
    {
      record_id: 2,
      house_id: 15,
      house_number: 15,
      transaction_date: '2025-01-20',
      amount: 950,
    },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BackfillAllocationsUseCase,
        {
          provide: DataSource,
          useValue: {
            query: jest.fn(),
          },
        },
        {
          provide: 'IRecordAllocationRepository',
          useValue: {
            findByRecordId: jest.fn(),
            findOverpaidBuckets: jest.fn().mockResolvedValue([]),
            findRecordIdsContributingToBuckets: jest.fn().mockResolvedValue([]),
            deleteByRecordIds: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: 'IHousePeriodChargeRepository',
          useValue: {
            deleteAutoPenaltyChargesByHouse: jest.fn().mockResolvedValue(0),
          },
        },
        {
          provide: AllocatePaymentUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: EnsurePeriodExistsUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
        {
          provide: ApplyCreditToPeriodsUseCase,
          useValue: {
            execute: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: HouseRepository,
          useValue: {
            findByNumberHouse: jest.fn(),
          },
        },
        {
          provide: HouseStatusSnapshotService,
          useValue: {
            invalidateByHouseId: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<BackfillAllocationsUseCase>(BackfillAllocationsUseCase);
    dataSource = module.get(DataSource) as jest.Mocked<DataSource>;
    recordAllocationRepository = module.get(
      'IRecordAllocationRepository',
    ) as jest.Mocked<IRecordAllocationRepository>;
    housePeriodChargeRepository = module.get(
      'IHousePeriodChargeRepository',
    ) as jest.Mocked<IHousePeriodChargeRepository>;
    allocatePaymentUseCase = module.get(
      AllocatePaymentUseCase,
    ) as jest.Mocked<AllocatePaymentUseCase>;
    ensurePeriodExistsUseCase = module.get(
      EnsurePeriodExistsUseCase,
    ) as jest.Mocked<EnsurePeriodExistsUseCase>;
    applyCreditToPeriodsUseCase = module.get(
      ApplyCreditToPeriodsUseCase,
    ) as jest.Mocked<ApplyCreditToPeriodsUseCase>;
    houseRepository = module.get(
      HouseRepository,
    ) as jest.Mocked<HouseRepository>;
    snapshotService = module.get(
      HouseStatusSnapshotService,
    ) as jest.Mocked<HouseStatusSnapshotService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute (global mode, no houseNumber)', () => {
    it('should backfill all orphan records successfully', async () => {
      dataSource.query.mockResolvedValue(mockOrphanRecords);
      recordAllocationRepository.findByRecordId.mockResolvedValue([]);
      ensurePeriodExistsUseCase.execute.mockResolvedValue({ id: 1 } as any);
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      const result = await useCase.execute();

      expect(result.total_records_found).toBe(2);
      expect(result.processed).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.mode).toBe('global');
      expect(allocatePaymentUseCase.execute).toHaveBeenCalledTimes(2);
    });

    it('should NOT call reset/apply-credit/invalidate-snapshot in global mode', async () => {
      dataSource.query.mockResolvedValue([]);

      await useCase.execute();

      expect(recordAllocationRepository.findOverpaidBuckets).not.toHaveBeenCalled();
      expect(recordAllocationRepository.deleteByRecordIds).not.toHaveBeenCalled();
      expect(housePeriodChargeRepository.deleteAutoPenaltyChargesByHouse).not.toHaveBeenCalled();
      expect(applyCreditToPeriodsUseCase.execute).not.toHaveBeenCalled();
      expect(snapshotService.invalidateByHouseId).not.toHaveBeenCalled();
    });

    it('should NOT include reset_records / fixed_buckets fields in global mode response', async () => {
      dataSource.query.mockResolvedValue([]);

      const result = await useCase.execute();

      expect(result.reset_records).toBeUndefined();
      expect(result.fixed_buckets).toBeUndefined();
    });

    it('should skip records that already have allocations', async () => {
      dataSource.query.mockResolvedValue(mockOrphanRecords);
      recordAllocationRepository.findByRecordId
        .mockResolvedValueOnce([{ id: 1 } as any])
        .mockResolvedValueOnce([]);
      ensurePeriodExistsUseCase.execute.mockResolvedValue({ id: 1 } as any);
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      const result = await useCase.execute();

      expect(result.processed).toBe(1);
      expect(result.skipped).toBe(1);
      expect(allocatePaymentUseCase.execute).toHaveBeenCalledTimes(1);
    });

    it('should handle allocation errors gracefully', async () => {
      dataSource.query.mockResolvedValue([mockOrphanRecords[0]]);
      recordAllocationRepository.findByRecordId.mockResolvedValue([]);
      ensurePeriodExistsUseCase.execute.mockResolvedValue({ id: 1 } as any);
      allocatePaymentUseCase.execute.mockRejectedValue(
        new Error('Allocation failed'),
      );

      const result = await useCase.execute();

      expect(result.processed).toBe(0);
      expect(result.failed).toBe(1);
      expect(result.results[0].status).toBe('failed');
      expect(result.results[0].error).toBe('Allocation failed');
    });

    it('should ensure period exists before allocating (period-aware mode)', async () => {
      dataSource.query.mockResolvedValue([mockOrphanRecords[0]]);
      recordAllocationRepository.findByRecordId.mockResolvedValue([]);
      ensurePeriodExistsUseCase.execute.mockResolvedValue({ id: 1 } as any);
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      await useCase.execute();

      expect(ensurePeriodExistsUseCase.execute).toHaveBeenCalledWith(2025, 1);
      // El use case ahora pasa transaction_date para activar el modo period-aware
      expect(allocatePaymentUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          record_id: 1,
          house_id: 42,
          amount_to_distribute: 800,
          transaction_date: expect.any(Date),
        }),
      );
    });

    it('should return empty result when no orphan records found', async () => {
      dataSource.query.mockResolvedValue([]);

      const result = await useCase.execute();

      expect(result.total_records_found).toBe(0);
      expect(result.processed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results).toEqual([]);
      expect(result.mode).toBe('global');
    });
  });

  describe('execute (house-fix mode, with houseNumber)', () => {
    const mockHouse = { id: 34, number_house: 42 } as any;

    it('should set mode=house-fix when houseNumber is provided', async () => {
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse);
      dataSource.query.mockResolvedValue([]);

      const result = await useCase.execute(42);

      expect(result.mode).toBe('house-fix');
      expect(result.reset_records).toBe(0);
      expect(result.fixed_buckets).toBe(0);
    });

    it('should reset allocations and apply credit when overpaid buckets exist', async () => {
      const buckets = [
        {
          period_id: 1,
          concept_type: AllocationConceptType.MAINTENANCE,
          total_allocated: 800,
          current_charge: 600,
        },
        {
          period_id: 2,
          concept_type: AllocationConceptType.MAINTENANCE,
          total_allocated: 800,
          current_charge: 600,
        },
      ];

      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse);
      recordAllocationRepository.findOverpaidBuckets.mockResolvedValue(buckets);
      recordAllocationRepository.findRecordIdsContributingToBuckets.mockResolvedValue(
        [34, 89, 155],
      );
      recordAllocationRepository.deleteByRecordIds.mockResolvedValue(6);
      housePeriodChargeRepository.deleteAutoPenaltyChargesByHouse.mockResolvedValue(
        2,
      );
      // Tras el reset, los records reseteados aparecen como orphans
      dataSource.query.mockResolvedValue([mockOrphanRecords[0]]);
      recordAllocationRepository.findByRecordId.mockResolvedValue([]);
      ensurePeriodExistsUseCase.execute.mockResolvedValue({ id: 1 } as any);
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      const result = await useCase.execute(42);

      expect(recordAllocationRepository.findOverpaidBuckets).toHaveBeenCalledWith(34);
      expect(
        recordAllocationRepository.findRecordIdsContributingToBuckets,
      ).toHaveBeenCalledWith(34, [
        { period_id: 1, concept_type: AllocationConceptType.MAINTENANCE },
        { period_id: 2, concept_type: AllocationConceptType.MAINTENANCE },
      ]);
      expect(recordAllocationRepository.deleteByRecordIds).toHaveBeenCalledWith(
        [34, 89, 155],
      );
      expect(
        housePeriodChargeRepository.deleteAutoPenaltyChargesByHouse,
      ).toHaveBeenCalledWith(34);
      expect(applyCreditToPeriodsUseCase.execute).toHaveBeenCalledWith(34);
      expect(snapshotService.invalidateByHouseId).toHaveBeenCalledWith(34);

      expect(result.mode).toBe('house-fix');
      expect(result.reset_records).toBe(3);
      expect(result.fixed_buckets).toBe(2);
    });

    it('should NOT call reset/apply-credit/invalidate when house has no overpaid buckets', async () => {
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse);
      recordAllocationRepository.findOverpaidBuckets.mockResolvedValue([]);
      dataSource.query.mockResolvedValue([]);

      const result = await useCase.execute(42);

      expect(
        recordAllocationRepository.findRecordIdsContributingToBuckets,
      ).not.toHaveBeenCalled();
      expect(recordAllocationRepository.deleteByRecordIds).not.toHaveBeenCalled();
      expect(
        housePeriodChargeRepository.deleteAutoPenaltyChargesByHouse,
      ).not.toHaveBeenCalled();
      expect(applyCreditToPeriodsUseCase.execute).not.toHaveBeenCalled();
      expect(snapshotService.invalidateByHouseId).not.toHaveBeenCalled();
      expect(result.reset_records).toBe(0);
      expect(result.fixed_buckets).toBe(0);
    });

    it('should skip reset gracefully when houseNumber does not match any house', async () => {
      houseRepository.findByNumberHouse.mockResolvedValue(null);
      dataSource.query.mockResolvedValue([]);

      const result = await useCase.execute(999);

      expect(recordAllocationRepository.findOverpaidBuckets).not.toHaveBeenCalled();
      expect(result.mode).toBe('house-fix');
      expect(result.reset_records).toBe(0);
      expect(result.fixed_buckets).toBe(0);
    });

    it('should still complete backfill even if applyCreditToPeriods throws', async () => {
      const buckets = [
        {
          period_id: 1,
          concept_type: AllocationConceptType.MAINTENANCE,
          total_allocated: 800,
          current_charge: 600,
        },
      ];

      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse);
      recordAllocationRepository.findOverpaidBuckets.mockResolvedValue(buckets);
      recordAllocationRepository.findRecordIdsContributingToBuckets.mockResolvedValue(
        [34],
      );
      recordAllocationRepository.deleteByRecordIds.mockResolvedValue(2);
      housePeriodChargeRepository.deleteAutoPenaltyChargesByHouse.mockResolvedValue(
        1,
      );
      dataSource.query.mockResolvedValue([]);
      applyCreditToPeriodsUseCase.execute.mockRejectedValue(
        new Error('Credit apply failed'),
      );

      const result = await useCase.execute(42);

      // El error de applyCredit no rompe el flujo
      expect(result.reset_records).toBe(1);
      expect(result.fixed_buckets).toBe(1);
      // El snapshot igual se invalida
      expect(snapshotService.invalidateByHouseId).toHaveBeenCalledWith(34);
    });

    it('should filter orphan-records query by house number when provided', async () => {
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse);
      dataSource.query.mockResolvedValue([]);

      await useCase.execute(42);

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('h.number_house = $1'),
        [42],
      );
    });
  });
});
