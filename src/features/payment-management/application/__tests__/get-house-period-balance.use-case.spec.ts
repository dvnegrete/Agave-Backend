import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetHousePeriodBalanceUseCase } from '../get-house-period-balance.use-case';
import { HousePeriodChargeCalculatorService } from '../../infrastructure/services/house-period-charge-calculator.service';
import { IPeriodRepository } from '../../interfaces';

describe('GetHousePeriodBalanceUseCase', () => {
  let useCase: GetHousePeriodBalanceUseCase;
  let chargeCalculator: jest.Mocked<HousePeriodChargeCalculatorService>;
  let periodRepository: jest.Mocked<IPeriodRepository>;

  const mockPeriod = {
    id: 1,
    year: 2026,
    month: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetHousePeriodBalanceUseCase,
        {
          provide: HousePeriodChargeCalculatorService,
          useValue: {
            isPeriodFullyCharged: jest.fn(),
            getTotalExpectedByHousePeriod: jest.fn(),
            getTotalPaidByHousePeriod: jest.fn(),
            calculateBalance: jest.fn(),
            getPaymentDetails: jest.fn(),
          },
        },
        {
          provide: 'IPeriodRepository',
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<GetHousePeriodBalanceUseCase>(
      GetHousePeriodBalanceUseCase,
    );
    chargeCalculator = module.get(HousePeriodChargeCalculatorService);
    periodRepository = module.get('IPeriodRepository');
  });

  describe('execute', () => {
    it('should return balance for house and period successfully', async () => {
      const houseId = 1;
      const periodId = 1;

      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      chargeCalculator.isPeriodFullyCharged.mockResolvedValue(true);
      chargeCalculator.getTotalExpectedByHousePeriod.mockResolvedValue(800);
      chargeCalculator.getTotalPaidByHousePeriod.mockResolvedValue(500);
      chargeCalculator.calculateBalance.mockResolvedValue(300);
      chargeCalculator.getPaymentDetails.mockResolvedValue([
        {
          conceptType: 'maintenance',
          expectedAmount: 800,
          paidAmount: 500,
          balance: 300,
          isPaid: false,
        },
      ]);

      const result = await useCase.execute(houseId, periodId);

      expect(result).toBeDefined();
      expect(result.houseId).toBe(houseId);
      expect(result.periodId).toBe(periodId);
      expect(result.totalExpected).toBe(800);
      expect(result.totalPaid).toBe(500);
      expect(result.balance).toBe(300);
      expect(result.isPaid).toBe(false);
    });

    it('should mark as paid when balance is 0', async () => {
      const houseId = 1;
      const periodId = 1;

      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      chargeCalculator.isPeriodFullyCharged.mockResolvedValue(true);
      chargeCalculator.getTotalExpectedByHousePeriod.mockResolvedValue(800);
      chargeCalculator.getTotalPaidByHousePeriod.mockResolvedValue(800);
      chargeCalculator.calculateBalance.mockResolvedValue(0);
      chargeCalculator.getPaymentDetails.mockResolvedValue([]);

      const result = await useCase.execute(houseId, periodId);

      expect(result.isPaid).toBe(true);
    });

    it('should mark as paid when balance is negative (overpaid)', async () => {
      const houseId = 1;
      const periodId = 1;

      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      chargeCalculator.isPeriodFullyCharged.mockResolvedValue(true);
      chargeCalculator.getTotalExpectedByHousePeriod.mockResolvedValue(800);
      chargeCalculator.getTotalPaidByHousePeriod.mockResolvedValue(850);
      chargeCalculator.calculateBalance.mockResolvedValue(-50);
      chargeCalculator.getPaymentDetails.mockResolvedValue([]);

      const result = await useCase.execute(houseId, periodId);

      expect(result.isPaid).toBe(true);
    });

    it('should throw NotFoundException if period not found', async () => {
      const houseId = 1;
      const periodId = 999;

      periodRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute(houseId, periodId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw NotFoundException if period not fully charged', async () => {
      const houseId = 1;
      const periodId = 1;

      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      chargeCalculator.isPeriodFullyCharged.mockResolvedValue(false);

      await expect(useCase.execute(houseId, periodId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should include detailed payment breakdown', async () => {
      const houseId = 1;
      const periodId = 1;
      const paymentDetails = [
        {
          conceptType: 'maintenance',
          expectedAmount: 800,
          paidAmount: 500,
          balance: 300,
          isPaid: false,
        },
        {
          conceptType: 'water',
          expectedAmount: 100,
          paidAmount: 100,
          balance: 0,
          isPaid: true,
        },
      ];

      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      chargeCalculator.isPeriodFullyCharged.mockResolvedValue(true);
      chargeCalculator.getTotalExpectedByHousePeriod.mockResolvedValue(900);
      chargeCalculator.getTotalPaidByHousePeriod.mockResolvedValue(600);
      chargeCalculator.calculateBalance.mockResolvedValue(300);
      chargeCalculator.getPaymentDetails.mockResolvedValue(paymentDetails as any);

      const result = await useCase.execute(houseId, periodId);

      expect(result.details).toHaveLength(2);
      expect(result.details[0].conceptType).toBe('maintenance');
      expect(result.details[1].conceptType).toBe('water');
    });

    it('should return correct GetHousePeriodBalanceResponse structure', async () => {
      const houseId = 1;
      const periodId = 1;

      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      chargeCalculator.isPeriodFullyCharged.mockResolvedValue(true);
      chargeCalculator.getTotalExpectedByHousePeriod.mockResolvedValue(800);
      chargeCalculator.getTotalPaidByHousePeriod.mockResolvedValue(500);
      chargeCalculator.calculateBalance.mockResolvedValue(300);
      chargeCalculator.getPaymentDetails.mockResolvedValue([]);

      const result = await useCase.execute(houseId, periodId);

      expect(result).toHaveProperty('houseId');
      expect(result).toHaveProperty('periodId');
      expect(result).toHaveProperty('totalExpected');
      expect(result).toHaveProperty('totalPaid');
      expect(result).toHaveProperty('balance');
      expect(result).toHaveProperty('isPaid');
      expect(result).toHaveProperty('details');
    });

    it('should handle zero expected amount', async () => {
      const houseId = 1;
      const periodId = 1;

      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      chargeCalculator.isPeriodFullyCharged.mockResolvedValue(true);
      chargeCalculator.getTotalExpectedByHousePeriod.mockResolvedValue(0);
      chargeCalculator.getTotalPaidByHousePeriod.mockResolvedValue(0);
      chargeCalculator.calculateBalance.mockResolvedValue(0);
      chargeCalculator.getPaymentDetails.mockResolvedValue([]);

      const result = await useCase.execute(houseId, periodId);

      expect(result.totalExpected).toBe(0);
      expect(result.isPaid).toBe(true);
    });
  });
});
