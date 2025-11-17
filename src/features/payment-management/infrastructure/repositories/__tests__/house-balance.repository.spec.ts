import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { HouseBalance } from '@/shared/database/entities';
import { HouseBalanceRepository } from '../house-balance.repository';

describe('HouseBalanceRepository', () => {
  let repository: HouseBalanceRepository;
  let typeormRepository: Repository<HouseBalance>;

  const mockHouseBalance = {
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
        HouseBalanceRepository,
        {
          provide: getRepositoryToken(HouseBalance),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            find: jest.fn(),
            delete: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<HouseBalanceRepository>(HouseBalanceRepository);
    typeormRepository = module.get<Repository<HouseBalance>>(
      getRepositoryToken(HouseBalance),
    );
  });

  describe('findByHouseId', () => {
    it('should find balance for a house', async () => {
      jest.spyOn(typeormRepository, 'findOne').mockResolvedValue(mockHouseBalance);

      const result = await repository.findByHouseId(42);

      expect(result).toEqual(mockHouseBalance);
      expect(typeormRepository.findOne).toHaveBeenCalledWith({
        where: { house_id: 42 },
        relations: ['house'],
      });
    });

    it('should return null when balance not found', async () => {
      jest.spyOn(typeormRepository, 'findOne').mockResolvedValue(null);

      const result = await repository.findByHouseId(999);

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create a new balance', async () => {
      jest.spyOn(typeormRepository, 'create').mockReturnValue(mockHouseBalance);
      jest.spyOn(typeormRepository, 'save').mockResolvedValue(mockHouseBalance);

      const result = await repository.create(42);

      expect(result).toEqual(mockHouseBalance);
      expect(typeormRepository.create).toHaveBeenCalledWith({
        house_id: 42,
        accumulated_cents: 0,
        credit_balance: 0,
        debit_balance: 0,
      });
    });
  });

  describe('getOrCreate', () => {
    it('should return existing balance', async () => {
      jest.spyOn(typeormRepository, 'findOne').mockResolvedValue(mockHouseBalance);

      const result = await repository.getOrCreate(42);

      expect(result).toEqual(mockHouseBalance);
    });

    it('should create new balance if not exists', async () => {
      jest.spyOn(typeormRepository, 'findOne').mockResolvedValueOnce(null);
      jest.spyOn(typeormRepository, 'create').mockReturnValue(mockHouseBalance);
      jest.spyOn(typeormRepository, 'save').mockResolvedValue(mockHouseBalance);

      const result = await repository.getOrCreate(99);

      expect(result).toEqual(mockHouseBalance);
    });
  });

  describe('addCreditBalance', () => {
    it('should add amount to credit balance', async () => {
      const updatedBalance = {
        ...mockHouseBalance,
        credit_balance: 15000,
      };

      jest
        .spyOn(typeormRepository, 'findOne')
        .mockResolvedValueOnce(mockHouseBalance)
        .mockResolvedValueOnce(updatedBalance);
      jest.spyOn(typeormRepository, 'update').mockResolvedValue({} as any);

      const result = await repository.addCreditBalance(42, 5000);

      expect(result.credit_balance).toBe(15000);
    });

    it('should not allow negative credit balance', async () => {
      const zeroBalance = { ...mockHouseBalance, credit_balance: 0 };
      jest.spyOn(typeormRepository, 'findOne').mockResolvedValue(zeroBalance);
      jest.spyOn(typeormRepository, 'update').mockResolvedValue({} as any);

      await repository.subtractCreditBalance(42, 5000);

      expect(typeormRepository.update).toHaveBeenCalledWith(
        { house_id: 42 },
        { credit_balance: 0 },
      );
    });
  });

  describe('addAccumulatedCents', () => {
    it('should add cents keeping them between 0 and 0.99', async () => {
      const balanceWithCents = { ...mockHouseBalance, accumulated_cents: 0.5 };
      const updatedBalance = { ...balanceWithCents, accumulated_cents: 0.75 };

      jest
        .spyOn(typeormRepository, 'findOne')
        .mockResolvedValueOnce(balanceWithCents)
        .mockResolvedValueOnce(updatedBalance);
      jest.spyOn(typeormRepository, 'update').mockResolvedValue({} as any);

      const result = await repository.addAccumulatedCents(42, 0.25);

      expect(result.accumulated_cents).toBe(0.75);
    });

    it('should reset to 0 if cents exceed 1', async () => {
      const balanceWithCents = { ...mockHouseBalance, accumulated_cents: 0.8 };
      const updatedBalance = { ...balanceWithCents, accumulated_cents: 0.05 };

      jest.spyOn(typeormRepository, 'findOne').mockResolvedValue(balanceWithCents);
      jest.spyOn(typeormRepository, 'update').mockResolvedValue({} as any);
      jest.spyOn(typeormRepository, 'findOne').mockResolvedValueOnce(updatedBalance);

      await repository.addAccumulatedCents(42, 0.25);

      expect(typeormRepository.update).toHaveBeenCalled();
    });
  });

  describe('resetAccumulatedCents', () => {
    it('should reset accumulated cents to 0', async () => {
      const resetBalance = { ...mockHouseBalance, accumulated_cents: 0 };
      jest.spyOn(typeormRepository, 'update').mockResolvedValue({} as any);
      jest.spyOn(typeormRepository, 'findOne').mockResolvedValue(resetBalance);

      const result = await repository.resetAccumulatedCents(42);

      expect(result.accumulated_cents).toBe(0);
    });
  });

  describe('findWithDebt', () => {
    it('should find all balances with debt', async () => {
      const balances = [mockHouseBalance];
      jest.spyOn(typeormRepository, 'find').mockResolvedValue(balances);

      const result = await repository.findWithDebt();

      expect(result).toEqual(balances);
      expect(typeormRepository.find).toHaveBeenCalledWith({
        where: { debit_balance: MoreThan(0) },
        relations: ['house'],
        order: { debit_balance: 'DESC' },
      });
    });
  });

  describe('findWithCredit', () => {
    it('should find all balances with credit', async () => {
      const balances = [mockHouseBalance];
      jest.spyOn(typeormRepository, 'find').mockResolvedValue(balances);

      const result = await repository.findWithCredit();

      expect(result).toEqual(balances);
      expect(typeormRepository.find).toHaveBeenCalledWith({
        where: { credit_balance: MoreThan(0) },
        relations: ['house'],
        order: { credit_balance: 'DESC' },
      });
    });
  });

  describe('delete', () => {
    it('should delete a balance', async () => {
      jest
        .spyOn(typeormRepository, 'delete')
        .mockResolvedValue({ affected: 1 } as any);

      const result = await repository.delete(42);

      expect(result).toBe(true);
    });

    it('should return false when balance not found', async () => {
      jest
        .spyOn(typeormRepository, 'delete')
        .mockResolvedValue({ affected: 0 } as any);

      const result = await repository.delete(999);

      expect(result).toBe(false);
    });
  });
});
