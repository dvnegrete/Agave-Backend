import { Test, TestingModule } from '@nestjs/testing';
import { GetHouseBalanceUseCase } from '../get-house-balance.use-case';
import { IHouseBalanceRepository } from '../../interfaces';
import { House } from '@/shared/database/entities';

describe('GetHouseBalanceUseCase', () => {
  let useCase: GetHouseBalanceUseCase;
  let houseBalanceRepository: jest.Mocked<IHouseBalanceRepository>;

  const mockHouse = {
    id: 42,
    number_house: 42,
    user_id: 'user-uuid',
    created_at: new Date(),
    updated_at: new Date(),
  } as House;

  const mockBalance = {
    id: 1,
    house_id: 42,
    accumulated_cents: 0.75,
    credit_balance: 10000,
    debit_balance: 5000,
    updated_at: new Date(),
    house: null,
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetHouseBalanceUseCase,
        {
          provide: 'IHouseBalanceRepository',
          useValue: {
            findByHouseId: jest.fn(),
            create: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<GetHouseBalanceUseCase>(GetHouseBalanceUseCase);
    houseBalanceRepository = module.get('IHouseBalanceRepository');
  });

  describe('execute', () => {
    it('should get existing house balance', async () => {
      jest.spyOn(houseBalanceRepository, 'findByHouseId').mockResolvedValue(mockBalance);

      const result = await useCase.execute(42, mockHouse);

      expect(result.house_id).toBe(42);
      expect(result.house_number).toBe(42);
      expect(result.accumulated_cents).toBe(0.75);
      expect(result.credit_balance).toBe(10000);
      expect(result.debit_balance).toBe(5000);
      expect(houseBalanceRepository.findByHouseId).toHaveBeenCalledWith(42);
    });

    it('should create new balance if not exists', async () => {
      const newBalance = {
        id: 2,
        house_id: 99,
        accumulated_cents: 0,
        credit_balance: 0,
        debit_balance: 0,
        updated_at: new Date(),
        house: null,
      } as any;

      jest.spyOn(houseBalanceRepository, 'findByHouseId').mockResolvedValue(null);
      jest.spyOn(houseBalanceRepository, 'create').mockResolvedValue(newBalance);

      const result = await useCase.execute(99, { ...mockHouse, id: 99 });

      expect(result.house_id).toBe(99);
      expect(result.accumulated_cents).toBe(0);
      expect(result.credit_balance).toBe(0);
      expect(result.debit_balance).toBe(0);
      expect(houseBalanceRepository.create).toHaveBeenCalledWith(99);
    });

    it('should calculate net balance correctly', async () => {
      const balanceWithCredit = {
        ...mockBalance,
        credit_balance: 20000,
        debit_balance: 5000,
      } as any;

      jest.spyOn(houseBalanceRepository, 'findByHouseId').mockResolvedValue(balanceWithCredit);

      const result = await useCase.execute(42, mockHouse);

      expect(result.net_balance).toBe(15000);
    });

    it('should calculate net balance as negative when in debt', async () => {
      const balanceInDebt = {
        ...mockBalance,
        credit_balance: 5000,
        debit_balance: 20000,
      } as any;

      jest.spyOn(houseBalanceRepository, 'findByHouseId').mockResolvedValue(balanceInDebt);

      const result = await useCase.execute(42, mockHouse);

      expect(result.net_balance).toBe(-15000);
    });
  });

  describe('status determination', () => {
    it('should mark status as in-debt when debit_balance > 0', async () => {
      const debtBalance = {
        ...mockBalance,
        debit_balance: 10000,
        credit_balance: 0,
      } as any;

      jest.spyOn(houseBalanceRepository, 'findByHouseId').mockResolvedValue(debtBalance);

      const result = await useCase.execute(42, mockHouse);

      expect(result.status).toBe('in-debt');
    });

    it('should mark status as credited when credit_balance > 0', async () => {
      const creditBalance = {
        ...mockBalance,
        debit_balance: 0,
        credit_balance: 10000,
      } as any;

      jest.spyOn(houseBalanceRepository, 'findByHouseId').mockResolvedValue(creditBalance);

      const result = await useCase.execute(42, mockHouse);

      expect(result.status).toBe('credited');
    });

    it('should mark status as balanced when both credit and debit are 0', async () => {
      const balancedBalance = {
        ...mockBalance,
        debit_balance: 0,
        credit_balance: 0,
      } as any;

      jest.spyOn(houseBalanceRepository, 'findByHouseId').mockResolvedValue(balancedBalance);

      const result = await useCase.execute(42, mockHouse);

      expect(result.status).toBe('balanced');
    });

    it('should prioritize in-debt status when both credit and debit > 0', async () => {
      const mixedBalance = {
        ...mockBalance,
        debit_balance: 10000,
        credit_balance: 5000,
      } as any;

      jest.spyOn(houseBalanceRepository, 'findByHouseId').mockResolvedValue(mixedBalance);

      const result = await useCase.execute(42, mockHouse);

      expect(result.status).toBe('in-debt');
    });
  });

  describe('response fields', () => {
    it('should include all required fields in response', async () => {
      jest.spyOn(houseBalanceRepository, 'findByHouseId').mockResolvedValue(mockBalance);

      const result = await useCase.execute(42, mockHouse);

      expect(result).toHaveProperty('house_id');
      expect(result).toHaveProperty('house_number');
      expect(result).toHaveProperty('accumulated_cents');
      expect(result).toHaveProperty('credit_balance');
      expect(result).toHaveProperty('debit_balance');
      expect(result).toHaveProperty('net_balance');
      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('updated_at');
    });

    it('should include correct house number', async () => {
      const houseWithDifferentNumber = { ...mockHouse, number_house: 123 };
      jest.spyOn(houseBalanceRepository, 'findByHouseId').mockResolvedValue(mockBalance);

      const result = await useCase.execute(42, houseWithDifferentNumber);

      expect(result.house_number).toBe(123);
    });

    it('should include updated_at timestamp', async () => {
      const now = new Date();
      const balanceWithTimestamp = {
        ...mockBalance,
        updated_at: now,
      } as any;

      jest
        .spyOn(houseBalanceRepository, 'findByHouseId')
        .mockResolvedValue(balanceWithTimestamp);

      const result = await useCase.execute(42, mockHouse);

      expect(result.updated_at).toEqual(now);
    });
  });

  describe('accumulated cents', () => {
    it('should include accumulated cents in response', async () => {
      const balanceWithCents = {
        ...mockBalance,
        accumulated_cents: 0.95,
      } as any;

      jest.spyOn(houseBalanceRepository, 'findByHouseId').mockResolvedValue(balanceWithCents);

      const result = await useCase.execute(42, mockHouse);

      expect(result.accumulated_cents).toBe(0.95);
    });

    it('should handle zero accumulated cents', async () => {
      const zeroAccumulated = {
        ...mockBalance,
        accumulated_cents: 0,
      } as any;

      jest.spyOn(houseBalanceRepository, 'findByHouseId').mockResolvedValue(zeroAccumulated);

      const result = await useCase.execute(42, mockHouse);

      expect(result.accumulated_cents).toBe(0);
    });
  });
});
