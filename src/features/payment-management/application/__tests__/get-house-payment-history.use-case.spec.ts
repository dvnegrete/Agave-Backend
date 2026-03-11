import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetHousePaymentHistoryUseCase } from '../get-house-payment-history.use-case';
import { PaymentReportAnalyzerService } from '../../infrastructure/services/payment-report-analyzer.service';
import { HouseRepository } from '@/shared/database/repositories/house.repository';

describe('GetHousePaymentHistoryUseCase', () => {
  let useCase: GetHousePaymentHistoryUseCase;
  let reportAnalyzer: jest.Mocked<PaymentReportAnalyzerService>;
  let houseRepository: jest.Mocked<HouseRepository>;

  const mockHouse = {
    id: 42,
    number_house: 42,
  };

  const mockHistory = {
    houseId: 42,
    houseNumber: 42,
    periods: [
      {
        periodId: 1,
        year: 2025,
        month: 1,
        expected: 800,
        paid: 800,
        debt: 0,
        isPaid: true,
        paymentPercentage: 100,
      },
    ],
    totalExpectedAllTime: 9600,
    totalPaidAllTime: 8400,
    totalDebtAllTime: 1200,
    averagePaymentPercentage: 87.5,
    debtTrend: 'stable' as const,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetHousePaymentHistoryUseCase,
        {
          provide: PaymentReportAnalyzerService,
          useValue: {
            getHousePaymentHistory: jest.fn(),
          },
        },
        {
          provide: HouseRepository,
          useValue: {
            findById: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<GetHousePaymentHistoryUseCase>(
      GetHousePaymentHistoryUseCase,
    );
    reportAnalyzer = module.get(
      PaymentReportAnalyzerService,
    ) as jest.Mocked<PaymentReportAnalyzerService>;
    houseRepository = module.get(HouseRepository) as jest.Mocked<HouseRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return payment history for default 12 months', async () => {
      houseRepository.findById.mockResolvedValue(mockHouse as any);
      reportAnalyzer.getHousePaymentHistory.mockResolvedValue(mockHistory as any);

      const result = await useCase.execute(42);

      expect(houseRepository.findById).toHaveBeenCalledWith(42);
      expect(reportAnalyzer.getHousePaymentHistory).toHaveBeenCalledWith(42, 12);
      expect(result.houseId).toBe(42);
      expect(result.periods).toHaveLength(1);
    });

    it('should return payment history for custom limit', async () => {
      houseRepository.findById.mockResolvedValue(mockHouse as any);
      reportAnalyzer.getHousePaymentHistory.mockResolvedValue(mockHistory as any);

      await useCase.execute(42, 6);

      expect(reportAnalyzer.getHousePaymentHistory).toHaveBeenCalledWith(42, 6);
    });

    it('should throw NotFoundException if house not found', async () => {
      houseRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute(999)).rejects.toThrow(NotFoundException);
      await expect(useCase.execute(999)).rejects.toThrow(
        'House with ID 999 not found',
      );
    });

    it('should throw error if limitMonths is less than 1', async () => {
      houseRepository.findById.mockResolvedValue(mockHouse as any);

      await expect(useCase.execute(42, 0)).rejects.toThrow(
        'limitMonths must be between 1 and 60',
      );
    });

    it('should throw error if limitMonths is greater than 60', async () => {
      houseRepository.findById.mockResolvedValue(mockHouse as any);

      await expect(useCase.execute(42, 61)).rejects.toThrow(
        'limitMonths must be between 1 and 60',
      );
    });

    it('should return history with improving debt trend', async () => {
      const improvingHistory = { ...mockHistory, debtTrend: 'improving' as const };
      houseRepository.findById.mockResolvedValue(mockHouse as any);
      reportAnalyzer.getHousePaymentHistory.mockResolvedValue(
        improvingHistory as any,
      );

      const result = await useCase.execute(42);

      expect(result.debtTrend).toBe('improving');
    });

    it('should return history with worsening debt trend', async () => {
      const worseningHistory = { ...mockHistory, debtTrend: 'worsening' as const };
      houseRepository.findById.mockResolvedValue(mockHouse as any);
      reportAnalyzer.getHousePaymentHistory.mockResolvedValue(
        worseningHistory as any,
      );

      const result = await useCase.execute(42);

      expect(result.debtTrend).toBe('worsening');
    });
  });

  describe('executeLastYear', () => {
    it('should return last 12 months history', async () => {
      houseRepository.findById.mockResolvedValue(mockHouse as any);
      reportAnalyzer.getHousePaymentHistory.mockResolvedValue(mockHistory as any);

      const result = await useCase.executeLastYear(42);

      expect(reportAnalyzer.getHousePaymentHistory).toHaveBeenCalledWith(42, 12);
      expect(result.houseId).toBe(42);
    });
  });

  describe('executeLastSixMonths', () => {
    it('should return last 6 months history', async () => {
      houseRepository.findById.mockResolvedValue(mockHouse as any);
      reportAnalyzer.getHousePaymentHistory.mockResolvedValue(mockHistory as any);

      const result = await useCase.executeLastSixMonths(42);

      expect(reportAnalyzer.getHousePaymentHistory).toHaveBeenCalledWith(42, 6);
      expect(result.houseId).toBe(42);
    });
  });
});
