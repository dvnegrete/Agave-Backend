import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AllocatePaymentUseCase } from '../allocate-payment.use-case';
import {
  IRecordAllocationRepository,
  IHouseBalanceRepository,
  IHousePeriodOverrideRepository,
  IPeriodRepository,
  IHousePeriodChargeRepository,
} from '../../interfaces';
import { PeriodConfigRepository } from '../../infrastructure/repositories/period-config.repository';
import { ApplyCreditToPeriodsUseCase } from '../apply-credit-to-periods.use-case';
import { HouseStatusSnapshotService } from '../../infrastructure/services/house-status-snapshot.service';
import {
  AllocationConceptType,
  PaymentStatus,
} from '@/shared/database/entities/enums';
import { PaymentDistributionRequestDTO } from '../../dto';

describe('AllocatePaymentUseCase', () => {
  let useCase: AllocatePaymentUseCase;
  let recordAllocationRepository: jest.Mocked<IRecordAllocationRepository>;
  let houseBalanceRepository: jest.Mocked<IHouseBalanceRepository>;
  let housePeriodOverrideRepository: jest.Mocked<IHousePeriodOverrideRepository>;
  let periodRepository: jest.Mocked<IPeriodRepository>;
  let housePeriodChargeRepository: jest.Mocked<IHousePeriodChargeRepository>;
  let periodConfigRepository: jest.Mocked<PeriodConfigRepository>;

  const mockPeriod = {
    id: 1,
    year: 2024,
    month: 11,
    created_at: new Date(),
    updated_at: new Date(),
  } as any;

  const mockPeriodConfig = {
    id: 1,
    default_maintenance_amount: 100000,
    default_water_amount: 50000,
    default_extraordinary_fee_amount: 25000,
    payment_due_day: 10,
    late_payment_penalty_amount: 0,
    effective_from: new Date('2024-01-01'),
    effective_until: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  } as any;

  const mockHouseBalance = {
    id: 1,
    house_id: 42,
    accumulated_cents: 0,
    credit_balance: 0,
    debit_balance: 0,
    updated_at: new Date(),
    house: null,
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AllocatePaymentUseCase,
        {
          provide: 'IRecordAllocationRepository',
          useValue: {
            create: jest.fn(),
            findByHouseId: jest.fn(),
            findByHouseAndPeriod: jest.fn(),
          },
        },
        {
          provide: 'IHouseBalanceRepository',
          useValue: {
            getOrCreate: jest.fn(),
            update: jest.fn(),
            findByHouseId: jest.fn(),
          },
        },
        {
          provide: 'IHousePeriodOverrideRepository',
          useValue: {
            getApplicableAmount: jest.fn(),
            findByHousePeriodAndConcept: jest.fn(),
          },
        },
        {
          provide: 'IPeriodRepository',
          useValue: {
            findById: jest.fn(),
            findByYearAndMonth: jest.fn(),
          },
        },
        {
          provide: 'IHousePeriodChargeRepository',
          useValue: {
            findByHouseAndPeriod: jest.fn(),
          },
        },
        {
          provide: PeriodConfigRepository,
          useValue: {
            findActiveForDate: jest.fn(),
          },
        },
        {
          provide: ApplyCreditToPeriodsUseCase,
          useValue: {
            execute: jest.fn(),
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

    useCase = module.get<AllocatePaymentUseCase>(AllocatePaymentUseCase);
    recordAllocationRepository = module.get('IRecordAllocationRepository');
    houseBalanceRepository = module.get('IHouseBalanceRepository');
    housePeriodOverrideRepository = module.get(
      'IHousePeriodOverrideRepository',
    );
    periodRepository = module.get('IPeriodRepository');
    housePeriodChargeRepository = module.get('IHousePeriodChargeRepository');
    periodConfigRepository = module.get(PeriodConfigRepository);
  });

  describe('execute', () => {
    it('should allocate payment successfully for complete payment', async () => {
      const request: PaymentDistributionRequestDTO = {
        record_id: 1,
        house_id: 42,
        amount_to_distribute: 175000, // Distribute across all 3 concepts exactly
        period_id: 1,
      };

      jest.spyOn(periodRepository, 'findById').mockResolvedValue(mockPeriod);
      jest
        .spyOn(houseBalanceRepository, 'getOrCreate')
        .mockResolvedValue(mockHouseBalance);
      jest
        .spyOn(periodConfigRepository, 'findActiveForDate')
        .mockResolvedValue(mockPeriodConfig);
      jest
        .spyOn(housePeriodChargeRepository, 'findByHouseAndPeriod')
        .mockResolvedValue([]);
      jest
        .spyOn(recordAllocationRepository, 'findByHouseAndPeriod')
        .mockResolvedValue([]);

      // Mock sequential calls to getApplicableAmount for maintenance, water, and extraordinary fee
      jest
        .spyOn(housePeriodOverrideRepository, 'getApplicableAmount')
        .mockResolvedValueOnce(100000) // maintenance
        .mockResolvedValueOnce(50000) // water
        .mockResolvedValueOnce(25000); // extraordinary fee

      jest
        .spyOn(recordAllocationRepository, 'create')
        .mockResolvedValueOnce({
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
        } as any)
        .mockResolvedValueOnce({
          id: 2,
          record_id: 1,
          house_id: 42,
          period_id: 1,
          concept_type: AllocationConceptType.WATER,
          concept_id: 2,
          allocated_amount: 50000,
          expected_amount: 50000,
          payment_status: PaymentStatus.COMPLETE,
          created_at: new Date(),
        } as any)
        .mockResolvedValueOnce({
          id: 3,
          record_id: 1,
          house_id: 42,
          period_id: 1,
          concept_type: AllocationConceptType.EXTRAORDINARY_FEE,
          concept_id: 3,
          allocated_amount: 25000,
          expected_amount: 25000,
          payment_status: PaymentStatus.COMPLETE,
          created_at: new Date(),
        } as any);

      jest.spyOn(houseBalanceRepository, 'update').mockResolvedValue({
        ...mockHouseBalance,
        credit_balance: 0,
      });

      const result = await useCase.execute(request);

      expect(result.record_id).toBe(1);
      expect(result.house_id).toBe(42);
      expect(result.total_distributed).toBeGreaterThan(0);
      expect(recordAllocationRepository.create).toHaveBeenCalled();
      // Update is only called if there's remaining amount to apply to balance
      expect(result.remaining_amount).toBe(0);
    });

    it('should throw error for zero amount', async () => {
      const request: PaymentDistributionRequestDTO = {
        record_id: 1,
        house_id: 42,
        amount_to_distribute: 0,
      };

      await expect(useCase.execute(request)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error for negative amount', async () => {
      const request: PaymentDistributionRequestDTO = {
        record_id: 1,
        house_id: 42,
        amount_to_distribute: -100,
      };

      await expect(useCase.execute(request)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw error when period not found', async () => {
      const request: PaymentDistributionRequestDTO = {
        record_id: 1,
        house_id: 42,
        amount_to_distribute: 100000,
        period_id: 999,
      };

      jest.spyOn(periodRepository, 'findById').mockResolvedValue(null);

      await expect(useCase.execute(request)).rejects.toThrow(NotFoundException);
    });

    it('should handle partial payment correctly', async () => {
      const request: PaymentDistributionRequestDTO = {
        record_id: 1,
        house_id: 42,
        amount_to_distribute: 100000,
        period_id: 1,
      };

      jest.spyOn(periodRepository, 'findById').mockResolvedValue(mockPeriod);
      jest
        .spyOn(houseBalanceRepository, 'getOrCreate')
        .mockResolvedValue(mockHouseBalance);
      jest
        .spyOn(periodConfigRepository, 'findActiveForDate')
        .mockResolvedValue(mockPeriodConfig);
      jest
        .spyOn(housePeriodChargeRepository, 'findByHouseAndPeriod')
        .mockResolvedValue([]);
      jest
        .spyOn(recordAllocationRepository, 'findByHouseAndPeriod')
        .mockResolvedValue([]);
      jest
        .spyOn(housePeriodOverrideRepository, 'getApplicableAmount')
        .mockResolvedValue(100000);

      jest.spyOn(recordAllocationRepository, 'create').mockResolvedValue({
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
      } as any);

      jest
        .spyOn(houseBalanceRepository, 'update')
        .mockResolvedValue(mockHouseBalance);

      const result = await useCase.execute(request);

      expect(result).toBeDefined();
      expect(result.allocations.length).toBeGreaterThan(0);
    });

    it('should apply remaining amount to credit balance', async () => {
      const request: PaymentDistributionRequestDTO = {
        record_id: 1,
        house_id: 42,
        amount_to_distribute: 200000,
        period_id: 1,
      };

      jest.spyOn(periodRepository, 'findById').mockResolvedValue(mockPeriod);
      jest
        .spyOn(houseBalanceRepository, 'getOrCreate')
        .mockResolvedValue(mockHouseBalance);
      jest
        .spyOn(periodConfigRepository, 'findActiveForDate')
        .mockResolvedValue(mockPeriodConfig);
      jest
        .spyOn(housePeriodChargeRepository, 'findByHouseAndPeriod')
        .mockResolvedValue([]);
      jest
        .spyOn(recordAllocationRepository, 'findByHouseAndPeriod')
        .mockResolvedValue([]);

      // Mock sequential calls for maintenance, water, and extraordinary fee
      jest
        .spyOn(housePeriodOverrideRepository, 'getApplicableAmount')
        .mockResolvedValueOnce(100000) // maintenance
        .mockResolvedValueOnce(50000) // water
        .mockResolvedValueOnce(25000); // extraordinary fee

      jest
        .spyOn(recordAllocationRepository, 'create')
        .mockResolvedValueOnce({
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
        } as any)
        .mockResolvedValueOnce({
          id: 2,
          record_id: 1,
          house_id: 42,
          period_id: 1,
          concept_type: AllocationConceptType.WATER,
          concept_id: 2,
          allocated_amount: 50000,
          expected_amount: 50000,
          payment_status: PaymentStatus.COMPLETE,
          created_at: new Date(),
        } as any)
        .mockResolvedValueOnce({
          id: 3,
          record_id: 1,
          house_id: 42,
          period_id: 1,
          concept_type: AllocationConceptType.EXTRAORDINARY_FEE,
          concept_id: 3,
          allocated_amount: 25000,
          expected_amount: 25000,
          payment_status: PaymentStatus.COMPLETE,
          created_at: new Date(),
        } as any);

      const updatedBalance = {
        ...mockHouseBalance,
        credit_balance: 25000, // remaining from 200000 - 100000 - 50000 - 25000
      };

      jest
        .spyOn(houseBalanceRepository, 'update')
        .mockResolvedValue(updatedBalance);

      const result = await useCase.execute(request);

      expect(result.remaining_amount).toBeGreaterThanOrEqual(0);
      expect(result.remaining_amount).toBeLessThanOrEqual(200000);
      expect(houseBalanceRepository.update).toHaveBeenCalledWith(
        42,
        expect.objectContaining({
          credit_balance: expect.any(Number),
        }),
      );
    });
  });
});
