import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LastTransactionBankRepository } from './last-transaction-bank.repository';
import { LastTransactionBank } from '../entities/last-transaction-bank.entity';

describe('LastTransactionBankRepository', () => {
  let repository: LastTransactionBankRepository;
  let mockRepository: Partial<Repository<LastTransactionBank>>;

  beforeEach(async () => {
    mockRepository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
      clear: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LastTransactionBankRepository,
        {
          provide: getRepositoryToken(LastTransactionBank),
          useValue: mockRepository,
        },
      ],
    }).compile();

    repository = module.get<LastTransactionBankRepository>(
      LastTransactionBankRepository,
    );
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('create', () => {
    it('should create a new last transaction record', async () => {
      const transactionId = 123456;
      const mockEntity = { transactions_bank_id: transactionId };
      const mockSavedEntity = { id: 1, ...mockEntity, created_at: new Date() };

      (mockRepository.create as jest.Mock).mockReturnValue(mockEntity);
      (mockRepository.save as jest.Mock).mockResolvedValue(mockSavedEntity);

      const result = await repository.create(transactionId);

      expect(mockRepository.create).toHaveBeenCalledWith({
        transactions_bank_id: transactionId,
      });
      expect(mockRepository.save).toHaveBeenCalledWith(mockEntity);
      expect(result).toEqual(mockSavedEntity);
    });
  });

  describe('findLatest', () => {
    it('should find the latest transaction record', async () => {
      const mockEntity = {
        id: 1,
        transactions_bank_id: 'bank_txn_123456',
        created_at: new Date(),
      };

      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockEntity);

      const result = await repository.findLatest();

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        order: { created_at: 'DESC' },
        relations: ['transactionBank'],
      });
      expect(result).toEqual(mockEntity);
    });

    it('should return null if no records found', async () => {
      (mockRepository.findOne as jest.Mock).mockResolvedValue(null);

      const result = await repository.findLatest();

      expect(result).toBeNull();
    });
  });

  describe('findByTransactionId', () => {
    it('should find record by transaction ID', async () => {
      const transactionId = 123456;
      const mockEntity = {
        id: 1,
        transactions_bank_id: transactionId,
        created_at: new Date(),
      };

      (mockRepository.findOne as jest.Mock).mockResolvedValue(mockEntity);

      const result = await repository.findByTransactionId(transactionId);

      expect(mockRepository.findOne).toHaveBeenCalledWith({
        where: { transactions_bank_id: transactionId },
        relations: ['transactionBank'],
      });
      expect(result).toEqual(mockEntity);
    });
  });
});
