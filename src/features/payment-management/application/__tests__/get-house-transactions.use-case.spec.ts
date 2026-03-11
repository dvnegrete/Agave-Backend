import { Test, TestingModule } from '@nestjs/testing';
import { GetHouseTransactionsUseCase } from '../get-house-transactions.use-case';
import { TransactionBankRepository } from '@/shared/database/repositories/transaction-bank.repository';
import { GetHouseUnreconciledVouchersUseCase } from '../get-house-unreconciled-vouchers.use-case';
import { House } from '@/shared/database/entities';

describe('GetHouseTransactionsUseCase', () => {
  let useCase: GetHouseTransactionsUseCase;
  let transactionBankRepository: jest.Mocked<TransactionBankRepository>;
  let getHouseUnreconciledVouchersUseCase: jest.Mocked<GetHouseUnreconciledVouchersUseCase>;

  const mockHouse = {
    id: 42,
    number_house: 42,
    user_id: 'user123',
  } as House;

  const mockTransactions = [
    {
      id: 'tx1',
      date: '2025-01-15',
      time: '10:30:00',
      concept: 'Pago mensual',
      amount: 800,
      currency: 'MXN',
      bank_name: 'BBVA',
      confirmation_status: true,
    },
    {
      id: 'tx2',
      date: '2025-01-10',
      time: '14:00:00',
      concept: 'Pago agua',
      amount: 150,
      currency: 'MXN',
      bank_name: 'Santander',
      confirmation_status: false,
    },
  ];

  const mockUnreconciledVouchers = {
    total_count: 1,
    vouchers: [
      {
        id: 1,
        date: '2025-01-20',
        amount: 800,
        confirmation_status: false,
        confirmation_code: null,
        created_at: new Date(),
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetHouseTransactionsUseCase,
        {
          provide: TransactionBankRepository,
          useValue: {
            findByHouseNumberHouse: jest.fn(),
          },
        },
        {
          provide: GetHouseUnreconciledVouchersUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<GetHouseTransactionsUseCase>(
      GetHouseTransactionsUseCase,
    );
    transactionBankRepository = module.get(
      TransactionBankRepository,
    ) as jest.Mocked<TransactionBankRepository>;
    getHouseUnreconciledVouchersUseCase = module.get(
      GetHouseUnreconciledVouchersUseCase,
    ) as jest.Mocked<GetHouseUnreconciledVouchersUseCase>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return house transactions with statistics', async () => {
      transactionBankRepository.findByHouseNumberHouse.mockResolvedValue(
        mockTransactions as any,
      );
      getHouseUnreconciledVouchersUseCase.execute.mockResolvedValue(
        mockUnreconciledVouchers as any,
      );

      const result = await useCase.execute(mockHouse);

      expect(transactionBankRepository.findByHouseNumberHouse).toHaveBeenCalledWith(
        42,
      );
      expect(result.house_id).toBe(42);
      expect(result.house_number).toBe(42);
      expect(result.total_transactions).toBe(2);
      expect(result.total_amount).toBe(950);
      expect(result.confirmed_transactions).toBe(1);
      expect(result.pending_transactions).toBe(1);
    });

    it('should return empty result when no transactions exist', async () => {
      transactionBankRepository.findByHouseNumberHouse.mockResolvedValue([]);
      getHouseUnreconciledVouchersUseCase.execute.mockResolvedValue({
        total_count: 0,
        vouchers: [],
      } as any);

      const result = await useCase.execute(mockHouse);

      expect(result.total_transactions).toBe(0);
      expect(result.total_amount).toBe(0);
      expect(result.transactions).toEqual([]);
    });

    it('should sort transactions by date descending', async () => {
      transactionBankRepository.findByHouseNumberHouse.mockResolvedValue(
        mockTransactions as any,
      );
      getHouseUnreconciledVouchersUseCase.execute.mockResolvedValue({
        total_count: 0,
        vouchers: [],
      } as any);

      const result = await useCase.execute(mockHouse);

      expect(result.transactions[0].date).toBe('2025-01-15');
      expect(result.transactions[1].date).toBe('2025-01-10');
    });

    it('should include unreconciled vouchers', async () => {
      transactionBankRepository.findByHouseNumberHouse.mockResolvedValue([]);
      getHouseUnreconciledVouchersUseCase.execute.mockResolvedValue(
        mockUnreconciledVouchers as any,
      );

      const result = await useCase.execute(mockHouse);

      expect(result.unreconciled_vouchers.total_count).toBe(1);
      expect(result.unreconciled_vouchers.vouchers).toHaveLength(1);
    });

    it('should handle transactions without optional fields', async () => {
      const transactionsWithNulls = [
        {
          id: 'tx1',
          date: '2025-01-15',
          time: null,
          concept: null,
          amount: 800,
          currency: null,
          bank_name: null,
          confirmation_status: true,
        },
      ];

      transactionBankRepository.findByHouseNumberHouse.mockResolvedValue(
        transactionsWithNulls as any,
      );
      getHouseUnreconciledVouchersUseCase.execute.mockResolvedValue({
        total_count: 0,
        vouchers: [],
      } as any);

      const result = await useCase.execute(mockHouse);

      expect(result.transactions[0].concept).toBeNull();
      expect(result.transactions[0].currency).toBeNull();
      expect(result.transactions[0].bank_name).toBeNull();
    });
  });
});
