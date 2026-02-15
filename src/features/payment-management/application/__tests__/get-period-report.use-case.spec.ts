import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GetPeriodReportUseCase } from '../get-period-report.use-case';
import { PaymentReportAnalyzerService } from '../../infrastructure/services/payment-report-analyzer.service';
import { IPeriodRepository } from '../../interfaces';

describe('GetPeriodReportUseCase', () => {
  let useCase: GetPeriodReportUseCase;
  let reportAnalyzer: jest.Mocked<PaymentReportAnalyzerService>;
  let periodRepository: jest.Mocked<IPeriodRepository>;

  const mockPeriod = {
    id: 1,
    year: 2025,
    month: 1,
  };

  const mockReport = {
    periodId: 1,
    periodYear: 2025,
    periodMonth: 1,
    totalExpected: 52800,
    totalPaid: 45000,
    totalDebt: 7800,
    collectionPercentage: 85.23,
    conceptBreakdown: [
      {
        concept: 'MAINTENANCE',
        expected: 52800,
        paid: 45000,
        debt: 7800,
        percentage: 85.23,
      },
    ],
    housesWithDebt: 10,
    housesFullyPaid: 56,
    housesPartiallyPaid: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPeriodReportUseCase,
        {
          provide: PaymentReportAnalyzerService,
          useValue: {
            getPeriodReport: jest.fn(),
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

    useCase = module.get<GetPeriodReportUseCase>(GetPeriodReportUseCase);
    reportAnalyzer = module.get(
      PaymentReportAnalyzerService,
    ) as jest.Mocked<PaymentReportAnalyzerService>;
    periodRepository = module.get('IPeriodRepository') as jest.Mocked<IPeriodRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return period report successfully', async () => {
      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      reportAnalyzer.getPeriodReport.mockResolvedValue(mockReport as any);

      const result = await useCase.execute(1);

      expect(periodRepository.findById).toHaveBeenCalledWith(1);
      expect(reportAnalyzer.getPeriodReport).toHaveBeenCalledWith(1);
      expect(result.periodId).toBe(1);
      expect(result.totalExpected).toBe(52800);
      expect(result.totalPaid).toBe(45000);
      expect(result.collectionPercentage).toBe(85.23);
    });

    it('should throw NotFoundException if period not found', async () => {
      periodRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute(999)).rejects.toThrow(NotFoundException);
      await expect(useCase.execute(999)).rejects.toThrow(
        'Period with ID 999 not found',
      );
      expect(reportAnalyzer.getPeriodReport).not.toHaveBeenCalled();
    });

    it('should return report with all concept breakdowns', async () => {
      const reportWithMultipleConcepts = {
        ...mockReport,
        conceptBreakdown: [
          { concept: 'MAINTENANCE', expected: 800, paid: 800, debt: 0, percentage: 100 },
          { concept: 'WATER', expected: 150, paid: 100, debt: 50, percentage: 66.67 },
        ],
      };

      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      reportAnalyzer.getPeriodReport.mockResolvedValue(
        reportWithMultipleConcepts as any,
      );

      const result = await useCase.execute(1);

      expect(result.conceptBreakdown).toHaveLength(2);
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

    it('should return current period report successfully', async () => {
      periodRepository.findByYearAndMonth.mockResolvedValue(mockPeriod as any);
      reportAnalyzer.getPeriodReport.mockResolvedValue(mockReport as any);

      const result = await useCase.executeForCurrentPeriod();

      expect(periodRepository.findByYearAndMonth).toHaveBeenCalledWith(2025, 1);
      expect(result.periodId).toBe(1);
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
});
