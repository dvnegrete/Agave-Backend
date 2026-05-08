import { Test, TestingModule } from '@nestjs/testing';
import { GetPeriodTransactionsUseCase } from '../get-period-transactions.use-case';
import { IRecordAllocationRepository } from '../../interfaces';
import { PeriodTransactionDto } from '../../dto/period-transactions.dto';

describe('GetPeriodTransactionsUseCase', () => {
  let useCase: GetPeriodTransactionsUseCase;
  let allocationRepo: jest.Mocked<IRecordAllocationRepository>;

  const tx1: PeriodTransactionDto = {
    transaction_id: 101,
    date: '2026-03-05',
    amount: 1150,
    allocated_to_period: 450,
    bank_name: 'BBVA',
    confirmation_status: true,
  };

  const tx2: PeriodTransactionDto = {
    transaction_id: 102,
    date: '2026-02-08',
    amount: 400,
    allocated_to_period: 400,
    bank_name: 'HSBC',
    confirmation_status: true,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPeriodTransactionsUseCase,
        {
          provide: 'IRecordAllocationRepository',
          useValue: {
            findTransactionsByHousePeriod: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get(GetPeriodTransactionsUseCase);
    allocationRepo = module.get('IRecordAllocationRepository');
  });

  it('retorna lista de transacciones agrupadas por tx con total correcto', async () => {
    allocationRepo.findTransactionsByHousePeriod.mockResolvedValue([tx1, tx2]);

    const result = await useCase.execute(34, 5);

    expect(result.house_id).toBe(34);
    expect(result.period_id).toBe(5);
    expect(result.transactions).toHaveLength(2);
    expect(result.total_allocated).toBe(850);
    expect(allocationRepo.findTransactionsByHousePeriod).toHaveBeenCalledWith(34, 5);
  });

  it('retorna lista vacía y total 0 cuando no hay allocations', async () => {
    allocationRepo.findTransactionsByHousePeriod.mockResolvedValue([]);

    const result = await useCase.execute(34, 99);

    expect(result.transactions).toEqual([]);
    expect(result.total_allocated).toBe(0);
  });

  it('total_allocated coincide con la suma de allocated_to_period', async () => {
    const txs: PeriodTransactionDto[] = [
      { ...tx1, allocated_to_period: 200 },
      { ...tx2, allocated_to_period: 250 },
      { ...tx1, transaction_id: 103, allocated_to_period: 600 },
    ];
    allocationRepo.findTransactionsByHousePeriod.mockResolvedValue(txs);

    const result = await useCase.execute(34, 5);

    expect(result.total_allocated).toBe(1050);
  });

  it('propaga el error si el repositorio falla', async () => {
    allocationRepo.findTransactionsByHousePeriod.mockRejectedValue(
      new Error('DB error'),
    );

    await expect(useCase.execute(34, 5)).rejects.toThrow('DB error');
  });
});
