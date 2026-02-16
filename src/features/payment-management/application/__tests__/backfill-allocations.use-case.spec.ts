import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { BackfillAllocationsUseCase } from '../backfill-allocations.use-case';
import { IRecordAllocationRepository } from '../../interfaces';
import { AllocatePaymentUseCase } from '../allocate-payment.use-case';
import { EnsurePeriodExistsUseCase } from '../ensure-period-exists.use-case';

describe('BackfillAllocationsUseCase', () => {
  let useCase: BackfillAllocationsUseCase;
  let dataSource: jest.Mocked<DataSource>;
  let recordAllocationRepository: jest.Mocked<IRecordAllocationRepository>;
  let allocatePaymentUseCase: jest.Mocked<AllocatePaymentUseCase>;
  let ensurePeriodExistsUseCase: jest.Mocked<EnsurePeriodExistsUseCase>;

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
      ],
    }).compile();

    useCase = module.get<BackfillAllocationsUseCase>(BackfillAllocationsUseCase);
    dataSource = module.get(DataSource) as jest.Mocked<DataSource>;
    recordAllocationRepository = module.get(
      'IRecordAllocationRepository',
    ) as jest.Mocked<IRecordAllocationRepository>;
    allocatePaymentUseCase = module.get(
      AllocatePaymentUseCase,
    ) as jest.Mocked<AllocatePaymentUseCase>;
    ensurePeriodExistsUseCase = module.get(
      EnsurePeriodExistsUseCase,
    ) as jest.Mocked<EnsurePeriodExistsUseCase>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should backfill all orphan records successfully', async () => {
      dataSource.query.mockResolvedValue(mockOrphanRecords);
      recordAllocationRepository.findByRecordId.mockResolvedValue([]);
      ensurePeriodExistsUseCase.execute.mockResolvedValue({ id: 1 } as any);
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      const result = await useCase.execute();

      expect(dataSource.query).toHaveBeenCalled();
      expect(result.total_records_found).toBe(2);
      expect(result.processed).toBe(2);
      expect(result.skipped).toBe(0);
      expect(result.failed).toBe(0);
      expect(allocatePaymentUseCase.execute).toHaveBeenCalledTimes(2);
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

    it('should filter by house number when provided', async () => {
      dataSource.query.mockResolvedValue([mockOrphanRecords[0]]);
      recordAllocationRepository.findByRecordId.mockResolvedValue([]);
      ensurePeriodExistsUseCase.execute.mockResolvedValue({ id: 1 } as any);
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      const result = await useCase.execute(42);

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('h.number_house = $1'),
        [42],
      );
      expect(result.total_records_found).toBe(1);
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

    it('should ensure period exists before allocating', async () => {
      dataSource.query.mockResolvedValue([mockOrphanRecords[0]]);
      recordAllocationRepository.findByRecordId.mockResolvedValue([]);
      ensurePeriodExistsUseCase.execute.mockResolvedValue({ id: 1 } as any);
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      await useCase.execute();

      expect(ensurePeriodExistsUseCase.execute).toHaveBeenCalledWith(2025, 1);
    });

    it('should return empty result when no orphan records found', async () => {
      dataSource.query.mockResolvedValue([]);

      const result = await useCase.execute();

      expect(result.total_records_found).toBe(0);
      expect(result.processed).toBe(0);
      expect(result.skipped).toBe(0);
      expect(result.failed).toBe(0);
      expect(result.results).toEqual([]);
    });

    it('should allocate with FIFO mode (no period_id)', async () => {
      dataSource.query.mockResolvedValue([mockOrphanRecords[0]]);
      recordAllocationRepository.findByRecordId.mockResolvedValue([]);
      ensurePeriodExistsUseCase.execute.mockResolvedValue({ id: 1 } as any);
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      await useCase.execute();

      expect(allocatePaymentUseCase.execute).toHaveBeenCalledWith({
        record_id: 1,
        house_id: 42,
        amount_to_distribute: 800,
      });
    });

    it('should process records in chronological order', async () => {
      const unorderedRecords = [mockOrphanRecords[1], mockOrphanRecords[0]];
      dataSource.query.mockResolvedValue(unorderedRecords);
      recordAllocationRepository.findByRecordId.mockResolvedValue([]);
      ensurePeriodExistsUseCase.execute.mockResolvedValue({ id: 1 } as any);
      allocatePaymentUseCase.execute.mockResolvedValue({} as any);

      await useCase.execute();

      expect(dataSource.query).toHaveBeenCalledWith(
        expect.stringContaining('ORDER BY tb.date ASC'),
        [],
      );
    });
  });
});
