import { Test, TestingModule } from '@nestjs/testing';
import { GetPaymentHistoryUseCase } from '../get-payment-history.use-case';
import { IRecordAllocationRepository } from '../../interfaces';
import { AllocationConceptType, PaymentStatus } from '@/shared/database/entities/enums';
import { House } from '@/shared/database/entities';

describe('GetPaymentHistoryUseCase', () => {
  let useCase: GetPaymentHistoryUseCase;
  let recordAllocationRepository: jest.Mocked<IRecordAllocationRepository>;

  const mockHouse = {
    id: 42,
    number_house: 42,
    user_id: 'user-uuid',
    created_at: new Date(),
    updated_at: new Date(),
  } as House;

  const mockAllocation = {
    id: 1,
    record_id: 1,
    house_id: 42,
    period_id: 1,
    concept_type: AllocationConceptType.MAINTENANCE,
    concept_id: 1,
    allocated_amount: 100000,
    expected_amount: 100000,
    payment_status: PaymentStatus.COMPLETE,
    created_at: new Date('2024-11-15'),
    period: {
      id: 1,
      year: 2024,
      month: 11,
      created_at: new Date(),
      updated_at: new Date(),
    },
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPaymentHistoryUseCase,
        {
          provide: 'IRecordAllocationRepository',
          useValue: {
            findByHouseId: jest.fn(),
            findByHouseAndPeriod: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<GetPaymentHistoryUseCase>(GetPaymentHistoryUseCase);
    recordAllocationRepository = module.get('IRecordAllocationRepository');
  });

  describe('execute', () => {
    it('should get full payment history for a house', async () => {
      const allocations = [mockAllocation];
      jest.spyOn(recordAllocationRepository, 'findByHouseId').mockResolvedValue(allocations);

      const result = await useCase.execute(42, mockHouse);

      expect(result.house_id).toBe(42);
      expect(result.house_number).toBe(42);
      expect(result.total_payments).toBe(1);
      expect(result.total_paid).toBe(100000);
      expect(result.total_expected).toBe(100000);
      expect(result.payments.length).toBe(1);
      expect(recordAllocationRepository.findByHouseId).toHaveBeenCalledWith(42);
    });

    it('should return empty history when no allocations exist', async () => {
      jest.spyOn(recordAllocationRepository, 'findByHouseId').mockResolvedValue([]);

      const result = await useCase.execute(42, mockHouse);

      expect(result.house_id).toBe(42);
      expect(result.total_payments).toBe(0);
      expect(result.total_paid).toBe(0);
      expect(result.total_expected).toBe(0);
      expect(result.payments).toEqual([]);
    });

    it('should calculate correct totals for multiple allocations', async () => {
      const allocations = [
        mockAllocation,
        {
          ...mockAllocation,
          id: 2,
          allocated_amount: 50000,
          expected_amount: 50000,
          concept_type: AllocationConceptType.WATER,
        },
      ];

      jest.spyOn(recordAllocationRepository, 'findByHouseId').mockResolvedValue(allocations);

      const result = await useCase.execute(42, mockHouse);

      expect(result.total_payments).toBe(2);
      expect(result.total_paid).toBe(150000);
      expect(result.total_expected).toBe(150000);
    });

    it('should calculate difference correctly for partial payments', async () => {
      const partialAllocation = {
        ...mockAllocation,
        allocated_amount: 50000,
        expected_amount: 100000,
        payment_status: PaymentStatus.PARTIAL,
      };

      jest.spyOn(recordAllocationRepository, 'findByHouseId').mockResolvedValue([
        partialAllocation,
      ]);

      const result = await useCase.execute(42, mockHouse);

      expect(result.payments[0].difference).toBe(50000);
      expect(result.total_paid).toBe(50000);
      expect(result.total_expected).toBe(100000);
    });

    it('should calculate overpaid amounts correctly', async () => {
      const overpaidAllocation = {
        ...mockAllocation,
        allocated_amount: 120000,
        expected_amount: 100000,
        payment_status: PaymentStatus.OVERPAID,
      };

      jest.spyOn(recordAllocationRepository, 'findByHouseId').mockResolvedValue([
        overpaidAllocation,
      ]);

      const result = await useCase.execute(42, mockHouse);

      expect(result.payments[0].difference).toBe(-20000);
      expect(result.total_paid).toBe(120000);
    });
  });

  describe('executeByPeriod', () => {
    it('should get payment history for a specific period', async () => {
      const allocations = [mockAllocation];
      jest.spyOn(recordAllocationRepository, 'findByHouseAndPeriod').mockResolvedValue(
        allocations,
      );

      const result = await useCase.executeByPeriod(42, 1, mockHouse);

      expect(result.house_id).toBe(42);
      expect(result.total_payments).toBe(1);
      expect(recordAllocationRepository.findByHouseAndPeriod).toHaveBeenCalledWith(42, 1);
    });

    it('should return empty history for period with no payments', async () => {
      jest.spyOn(recordAllocationRepository, 'findByHouseAndPeriod').mockResolvedValue([]);

      const result = await useCase.executeByPeriod(42, 1, mockHouse);

      expect(result.total_payments).toBe(0);
      expect(result.payments).toEqual([]);
    });

    it('should calculate correct period year and month', async () => {
      jest.spyOn(recordAllocationRepository, 'findByHouseAndPeriod').mockResolvedValue([
        mockAllocation,
      ]);

      const result = await useCase.executeByPeriod(42, 1, mockHouse);

      expect(result.payments[0].period_year).toBe(2024);
      expect(result.payments[0].period_month).toBe(11);
    });

    it('should include payment date in response', async () => {
      const allocationWithDate = {
        ...mockAllocation,
        created_at: new Date('2024-11-20T10:30:00Z'),
      };

      jest
        .spyOn(recordAllocationRepository, 'findByHouseAndPeriod')
        .mockResolvedValue([allocationWithDate]);

      const result = await useCase.executeByPeriod(42, 1, mockHouse);

      expect(result.payments[0].payment_date).toEqual(new Date('2024-11-20T10:30:00Z'));
    });
  });
});
