import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RecordAllocation } from '@/shared/database/entities';
import {
  AllocationConceptType,
  PaymentStatus,
} from '@/shared/database/entities/enums';
import { RecordAllocationRepository } from '../record-allocation.repository';

describe('RecordAllocationRepository', () => {
  let repository: RecordAllocationRepository;
  let typeormRepository: Repository<RecordAllocation>;

  const mockRecordAllocation = {
    id: 1,
    record_id: 1,
    house_id: 42,
    period_id: 1,
    concept_type: AllocationConceptType.MAINTENANCE,
    concept_id: 1,
    allocated_amount: 100000,
    expected_amount: 100000,
    payment_status: PaymentStatus.COMPLETE,
    created_at: new Date(),
    record: null,
    period: null,
    house: null,
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecordAllocationRepository,
        {
          provide: getRepositoryToken(RecordAllocation),
          useValue: {
            find: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
      ],
    }).compile();

    repository = module.get<RecordAllocationRepository>(
      RecordAllocationRepository,
    );
    typeormRepository = module.get<Repository<RecordAllocation>>(
      getRepositoryToken(RecordAllocation),
    );
  });

  describe('findByHouseId', () => {
    it('should find all allocations for a house', async () => {
      const allocations = [mockRecordAllocation];
      jest.spyOn(typeormRepository, 'find').mockResolvedValue(allocations);

      const result = await repository.findByHouseId(42);

      expect(result).toEqual(allocations);
      expect(typeormRepository.find).toHaveBeenCalledWith({
        where: { house_id: 42 },
        relations: ['record', 'period', 'house'],
        order: { created_at: 'DESC' },
      });
    });

    it('should return empty array when no allocations found', async () => {
      jest.spyOn(typeormRepository, 'find').mockResolvedValue([]);

      const result = await repository.findByHouseId(999);

      expect(result).toEqual([]);
    });
  });

  describe('findByHouseAndPeriod', () => {
    it('should find allocations for a specific house and period', async () => {
      const allocations = [mockRecordAllocation];
      jest.spyOn(typeormRepository, 'find').mockResolvedValue(allocations);

      const result = await repository.findByHouseAndPeriod(42, 1);

      expect(result).toEqual(allocations);
      expect(typeormRepository.find).toHaveBeenCalledWith({
        where: { house_id: 42, period_id: 1 },
        relations: ['record', 'period', 'house'],
        order: { created_at: 'DESC' },
      });
    });
  });

  describe('create', () => {
    it('should create a new allocation', async () => {
      const partialAllocation: Partial<RecordAllocation> = {
        record_id: 1,
        house_id: 42,
        period_id: 1,
        concept_type: AllocationConceptType.MAINTENANCE,
        concept_id: 1,
        allocated_amount: 100000,
        expected_amount: 100000,
        payment_status: PaymentStatus.COMPLETE,
      };

      jest
        .spyOn(typeormRepository, 'create')
        .mockReturnValue(mockRecordAllocation);
      jest
        .spyOn(typeormRepository, 'save')
        .mockResolvedValue(mockRecordAllocation);

      const result = await repository.create(partialAllocation);

      expect(result).toEqual(mockRecordAllocation);
      expect(typeormRepository.create).toHaveBeenCalledWith(partialAllocation);
      expect(typeormRepository.save).toHaveBeenCalledWith(mockRecordAllocation);
    });
  });

  describe('findByPaymentStatus', () => {
    it('should find allocations by payment status', async () => {
      const allocations = [mockRecordAllocation];
      jest.spyOn(typeormRepository, 'find').mockResolvedValue(allocations);

      const result = await repository.findByPaymentStatus(
        PaymentStatus.COMPLETE,
      );

      expect(result).toEqual(allocations);
      expect(typeormRepository.find).toHaveBeenCalledWith({
        where: { payment_status: PaymentStatus.COMPLETE },
        relations: ['record', 'period', 'house'],
        order: { created_at: 'DESC' },
      });
    });
  });

  describe('getTotalPaidByHousePeriod', () => {
    it('should calculate total paid amount', async () => {
      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '250000' }),
      };

      jest
        .spyOn(typeormRepository, 'createQueryBuilder')
        .mockReturnValue(queryBuilder as any);

      const result = await repository.getTotalPaidByHousePeriod(42, 1);

      expect(result).toBe(250000);
    });

    it('should return 0 when no allocations found', async () => {
      const queryBuilder = {
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: null }),
      };

      jest
        .spyOn(typeormRepository, 'createQueryBuilder')
        .mockReturnValue(queryBuilder as any);

      const result = await repository.getTotalPaidByHousePeriod(999, 999);

      expect(result).toBe(0);
    });
  });

  describe('delete', () => {
    it('should delete an allocation', async () => {
      jest
        .spyOn(typeormRepository, 'delete')
        .mockResolvedValue({ affected: 1 } as any);

      const result = await repository.delete(1);

      expect(result).toBe(true);
      expect(typeormRepository.delete).toHaveBeenCalledWith(1);
    });

    it('should return false when allocation not found', async () => {
      jest
        .spyOn(typeormRepository, 'delete')
        .mockResolvedValue({ affected: 0 } as any);

      const result = await repository.delete(999);

      expect(result).toBe(false);
    });
  });
});
