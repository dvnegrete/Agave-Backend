import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ClassifyHousesByPaymentUseCase } from '../classify-houses-by-payment.use-case';
import { PaymentReportAnalyzerService } from '../../infrastructure/services/payment-report-analyzer.service';
import { IPeriodRepository } from '../../interfaces';

describe('ClassifyHousesByPaymentUseCase', () => {
  let useCase: ClassifyHousesByPaymentUseCase;
  let reportAnalyzer: jest.Mocked<PaymentReportAnalyzerService>;
  let periodRepository: jest.Mocked<IPeriodRepository>;

  const mockPeriod = {
    id: 1,
    year: 2025,
    month: 1,
  };

  const mockClassification = {
    goodPayers: [
      {
        houseId: 1,
        houseNumber: 1,
        lastPeriods: 6,
        fullyPaidPercentage: 100,
      },
    ],
    atRisk: [
      {
        houseId: 2,
        houseNumber: 2,
        debt: 1600,
        monthsBehind: 2,
        lastPaymentDate: new Date('2024-11-15'),
      },
    ],
    delinquent: [
      {
        houseId: 3,
        houseNumber: 3,
        totalDebt: 4800,
        monthsDelinquent: 6,
      },
    ],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ClassifyHousesByPaymentUseCase,
        {
          provide: PaymentReportAnalyzerService,
          useValue: {
            classifyHousesByPaymentBehavior: jest.fn(),
          },
        },
        {
          provide: 'IPeriodRepository',
          useValue: {
            findById: jest.fn(),
            findByYearAndMonth: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<ClassifyHousesByPaymentUseCase>(
      ClassifyHousesByPaymentUseCase,
    );
    reportAnalyzer = module.get(
      PaymentReportAnalyzerService,
    ) as jest.Mocked<PaymentReportAnalyzerService>;
    periodRepository = module.get('IPeriodRepository') as jest.Mocked<IPeriodRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should classify houses successfully', async () => {
      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      reportAnalyzer.classifyHousesByPaymentBehavior.mockResolvedValue(
        mockClassification as any,
      );

      const result = await useCase.execute(1);

      expect(periodRepository.findById).toHaveBeenCalledWith(1);
      expect(reportAnalyzer.classifyHousesByPaymentBehavior).toHaveBeenCalledWith(1);
      expect(result.goodPayers).toHaveLength(1);
      expect(result.atRisk).toHaveLength(1);
      expect(result.delinquent).toHaveLength(1);
    });

    it('should throw NotFoundException if period not found', async () => {
      periodRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute(999)).rejects.toThrow(NotFoundException);
      await expect(useCase.execute(999)).rejects.toThrow(
        'Period with ID 999 not found',
      );
    });

    it('should handle empty classifications', async () => {
      const emptyClassification = {
        goodPayers: [],
        atRisk: [],
        delinquent: [],
      };

      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      reportAnalyzer.classifyHousesByPaymentBehavior.mockResolvedValue(
        emptyClassification as any,
      );

      const result = await useCase.execute(1);

      expect(result.goodPayers).toEqual([]);
      expect(result.atRisk).toEqual([]);
      expect(result.delinquent).toEqual([]);
    });
  });

  describe('executeForCurrentPeriod', () => {
    beforeEach(() => {
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should classify houses for current period', async () => {
      periodRepository.findByYearAndMonth.mockResolvedValue(mockPeriod as any);
      reportAnalyzer.classifyHousesByPaymentBehavior.mockResolvedValue(
        mockClassification as any,
      );

      const result = await useCase.executeForCurrentPeriod();

      expect(periodRepository.findByYearAndMonth).toHaveBeenCalledWith(2025, 1);
      expect(result.goodPayers).toHaveLength(1);
    });

    it('should throw NotFoundException if current period not found', async () => {
      periodRepository.findByYearAndMonth.mockResolvedValue(null);

      await expect(useCase.executeForCurrentPeriod()).rejects.toThrow(
        NotFoundException,
      );
      await expect(useCase.executeForCurrentPeriod()).rejects.toThrow(
        'No period found for current month 2025-1',
      );
    });
  });

  describe('executeGetAtRiskOnly', () => {
    it('should return only at-risk houses', async () => {
      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      reportAnalyzer.classifyHousesByPaymentBehavior.mockResolvedValue(
        mockClassification as any,
      );

      const result = await useCase.executeGetAtRiskOnly(1);

      expect(result).toEqual(mockClassification.atRisk);
      expect(result).toHaveLength(1);
      expect(result[0].houseNumber).toBe(2);
    });
  });

  describe('executeGetDelinquentOnly', () => {
    it('should return only delinquent houses', async () => {
      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      reportAnalyzer.classifyHousesByPaymentBehavior.mockResolvedValue(
        mockClassification as any,
      );

      const result = await useCase.executeGetDelinquentOnly(1);

      expect(result).toEqual(mockClassification.delinquent);
      expect(result).toHaveLength(1);
      expect(result[0].houseNumber).toBe(3);
    });
  });
});
