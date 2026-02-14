import { Test, TestingModule } from '@nestjs/testing';
import { DistributePaymentWithAIUseCase } from '../distribute-payment-with-ai.use-case';
import {
  IRecordAllocationRepository,
  IPeriodRepository,
  IPeriodConfigRepository,
  IHouseBalanceRepository,
  IHousePeriodOverrideRepository,
} from '../../interfaces';
import { PaymentDistributionAnalyzerService } from '../../infrastructure/matching/payment-distribution-analyzer.service';
import { House, Period } from '@/shared/database/entities';

describe('DistributePaymentWithAIUseCase', () => {
  let useCase: DistributePaymentWithAIUseCase;
  let recordAllocationRepository: jest.Mocked<IRecordAllocationRepository>;
  let periodRepository: jest.Mocked<IPeriodRepository>;
  let periodConfigRepository: jest.Mocked<IPeriodConfigRepository>;
  let houseBalanceRepository: jest.Mocked<IHouseBalanceRepository>;
  let housePeriodOverrideRepository: jest.Mocked<IHousePeriodOverrideRepository>;
  let distributionAnalyzer: jest.Mocked<PaymentDistributionAnalyzerService>;

  const mockHouse: Partial<House> = {
    id: 1,
    number_house: 101,
  };

  const mockPeriod = (year: number, month: number): Period => ({
    id: year * 100 + month,
    year,
    month,
    start_date: new Date(year, month - 1, 1),
    end_date: new Date(year, month, 0),
    period_config_id: 1,
    water_active: false,
    extraordinary_fee_active: false,
    created_at: new Date(),
    updated_at: new Date(),
  } as any);

  const mockBalance = {
    id: 1,
    house_id: 1,
    credit_balance: 0,
    accumulated_cents: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DistributePaymentWithAIUseCase,
        {
          provide: 'IRecordAllocationRepository',
          useValue: {
            create: jest.fn(),
            findByHouseId: jest.fn(),
            findByHouseAndPeriod: jest.fn(),
          },
        },
        {
          provide: 'IPeriodRepository',
          useValue: {
            findAll: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
          },
        },
        {
          provide: 'IPeriodConfigRepository',
          useValue: {
            findActive: jest.fn(),
            findActiveForDate: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: 'IHouseBalanceRepository',
          useValue: {
            getOrCreate: jest.fn(),
            update: jest.fn(),
          },
        },
        {
          provide: 'IHousePeriodOverrideRepository',
          useValue: {
            getApplicableAmount: jest.fn(),
            findByHouseAndPeriod: jest.fn(),
          },
        },
        {
          provide: PaymentDistributionAnalyzerService,
          useValue: {
            analyzeDistribution: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<DistributePaymentWithAIUseCase>(
      DistributePaymentWithAIUseCase,
    );
    recordAllocationRepository = module.get('IRecordAllocationRepository');
    periodRepository = module.get('IPeriodRepository');
    periodConfigRepository = module.get('IPeriodConfigRepository');
    houseBalanceRepository = module.get('IHouseBalanceRepository');
    housePeriodOverrideRepository = module.get('IHousePeriodOverrideRepository');
    distributionAnalyzer = module.get(PaymentDistributionAnalyzerService);
  });

  describe('execute', () => {
    describe('Caso: No hay períodos impagos', () => {
      it('should return all amount as credit when no unpaid periods', async () => {
        periodRepository.findAll.mockResolvedValue([]);
        recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);

        const result = await useCase.execute(1, mockHouse as House, 500000);

        expect(result).toBeDefined();
        expect(result.method).toBe('deterministic');
        expect(result.confidence).toBe('high');
        expect(result.suggested_allocations).toHaveLength(0);
        expect(result.total_allocated).toBe(0);
        expect(result.remaining_as_credit).toBe(500000);
        expect(result.requires_manual_review).toBe(false);
        expect(result.auto_applied).toBe(false);
      });
    });

    describe('Caso: Distribución Determinística - Exacta', () => {
      it('should distribute exact maintenance payment (e.g., $800 for 1 period)', async () => {
        const periods = [
          mockPeriod(2026, 1),
          mockPeriod(2026, 2),
          mockPeriod(2026, 3),
        ];
        periodRepository.findAll.mockResolvedValue(periods);
        recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);

        const result = await useCase.execute(1, mockHouse as House, 800);

        expect(result).toBeDefined();
        expect(result.method).toBe('deterministic');
        expect(result.confidence).toBe('high');
        expect(result.suggested_allocations.length).toBeGreaterThan(0);
        expect(result.requires_manual_review).toBe(false);
      });

      it('should distribute exact payment for multiple periods ($1600 for 2 periods)', async () => {
        const periods = [
          mockPeriod(2026, 1),
          mockPeriod(2026, 2),
          mockPeriod(2026, 3),
        ];
        periodRepository.findAll.mockResolvedValue(periods);
        recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);

        const result = await useCase.execute(1, mockHouse as House, 1600);

        expect(result.method).toBe('deterministic');
        expect(result.suggested_allocations.length).toBeGreaterThanOrEqual(1);
        expect(result.total_allocated).toBeLessThanOrEqual(1600);
      });
    });

    describe('Caso: Distribución Determinística - Múltiple + Parcial', () => {
      it('should distribute multiple full periods plus partial', async () => {
        const periods = [
          mockPeriod(2026, 1),
          mockPeriod(2026, 2),
          mockPeriod(2026, 3),
        ];
        periodRepository.findAll.mockResolvedValue(periods);
        recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);

        const result = await useCase.execute(1, mockHouse as House, 1200); // 1.5 periodos

        expect(result.method).toBe('deterministic');
        expect(result.confidence).toBe('high');
        expect(result.total_allocated).toBeLessThanOrEqual(1200);
        expect(result.requires_manual_review).toBe(false);
      });
    });

    describe('Caso: Pago Parcial', () => {
      it('should allocate partial payment to oldest period', async () => {
        const periods = [
          mockPeriod(2026, 1),
          mockPeriod(2026, 2),
        ];
        periodRepository.findAll.mockResolvedValue(periods);
        recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);

        const result = await useCase.execute(1, mockHouse as House, 400); // menos que $800

        expect(result.method).toBe('deterministic');
        expect(result.confidence).toBe('medium');
        expect(result.suggested_allocations).toHaveLength(1);
        expect(result.suggested_allocations[0].period_id).toBe(periods[0].id);
        expect(result.suggested_allocations[0].amount).toBe(400);
        expect(result.requires_manual_review).toBe(false);
      });

      it('should handle very small amounts', async () => {
        const periods = [mockPeriod(2026, 1)];
        periodRepository.findAll.mockResolvedValue(periods);
        recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);

        const result = await useCase.execute(1, mockHouse as House, 50);

        expect(result.method).toBe('deterministic');
        expect(result.suggested_allocations.length).toBeGreaterThan(0);
        expect(result.total_allocated).toBeLessThanOrEqual(50);
      });
    });

    describe('Caso: Fallback a AI', () => {
      it('should fallback to AI analyzer when amount does not match deterministic patterns', async () => {
        const periods = [
          mockPeriod(2026, 1),
          mockPeriod(2026, 2),
        ];
        periodRepository.findAll.mockResolvedValue(periods);
        recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
        houseBalanceRepository.getOrCreate.mockResolvedValue(mockBalance as any);

        const mockAIResponse = {
          confidence: 'high' as const,
          allocations: [
            {
              period_id: periods[0].id,
              concept_type: 'maintenance',
              amount: 500,
              reasoning: 'AI suggested allocation',
            },
          ],
          total_allocated: 500,
          remaining_as_credit: 300,
          reasoning: 'AI determined optimal distribution',
        };

        distributionAnalyzer.analyzeDistribution.mockResolvedValue(mockAIResponse);

        const result = await useCase.execute(1, mockHouse as House, 800);

        expect(result.method).toBe('ai');
        expect(result.confidence).toBe('high');
        expect(distributionAnalyzer.analyzeDistribution).toHaveBeenCalled();
      });

      it('should require manual review when AI confidence is low', async () => {
        const periods = [mockPeriod(2026, 1)];
        periodRepository.findAll.mockResolvedValue(periods);
        recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
        houseBalanceRepository.getOrCreate.mockResolvedValue(mockBalance as any);

        const mockAIResponse = {
          confidence: 'low' as const,
          allocations: [
            {
              period_id: periods[0].id,
              concept_type: 'maintenance',
              amount: 300,
              reasoning: 'Low confidence allocation',
            },
          ],
          total_allocated: 300,
          remaining_as_credit: 500,
          reasoning: 'Uncertain distribution',
        };

        distributionAnalyzer.analyzeDistribution.mockResolvedValue(mockAIResponse);

        const result = await useCase.execute(1, mockHouse as House, 800);

        expect(result.method).toBe('ai');
        expect(result.confidence).toBe('low');
        expect(result.requires_manual_review).toBe(true);
      });
    });

    describe('Caso: AI Falla o No Responde', () => {
      it('should return manual review result when AI returns null', async () => {
        const periods = [mockPeriod(2026, 1)];
        periodRepository.findAll.mockResolvedValue(periods);
        recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
        houseBalanceRepository.getOrCreate.mockResolvedValue(mockBalance as any);

        distributionAnalyzer.analyzeDistribution.mockResolvedValue(null);

        const result = await useCase.execute(1, mockHouse as House, 800);

        expect(result.method).toBe('manual_review');
        expect(result.confidence).toBe('none');
        expect(result.suggested_allocations).toHaveLength(0);
        expect(result.total_allocated).toBe(0);
        expect(result.remaining_as_credit).toBe(800);
        expect(result.requires_manual_review).toBe(true);
      });

      it('should return manual review result when AI throws error', async () => {
        const periods = [mockPeriod(2026, 1)];
        periodRepository.findAll.mockResolvedValue(periods);
        recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
        houseBalanceRepository.getOrCreate.mockResolvedValue(mockBalance as any);

        distributionAnalyzer.analyzeDistribution.mockRejectedValue(
          new Error('AI service unavailable'),
        );

        await expect(
          useCase.execute(1, mockHouse as House, 800),
        ).rejects.toThrow();
      });
    });

    describe('Caso: Edge Cases', () => {
      it('should handle zero amount', async () => {
        const periods = [mockPeriod(2026, 1)];
        periodRepository.findAll.mockResolvedValue(periods);

        const result = await useCase.execute(1, mockHouse as House, 0);

        expect(result.total_allocated).toBe(0);
        expect(result.remaining_as_credit).toBe(0);
      });

      it('should handle negative amount', async () => {
        const periods = [mockPeriod(2026, 1)];
        periodRepository.findAll.mockResolvedValue(periods);
        recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);

        const result = await useCase.execute(1, mockHouse as House, -500);

        expect(result.total_allocated).toBe(0);
        expect(result.remaining_as_credit).toBe(-500);
      });

      it('should handle very large amounts', async () => {
        const periods = [
          mockPeriod(2026, 1),
          mockPeriod(2026, 2),
          mockPeriod(2026, 3),
        ];
        periodRepository.findAll.mockResolvedValue(periods);
        recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);

        const result = await useCase.execute(1, mockHouse as House, 10000000); // $10M

        expect(result.suggested_allocations).toBeDefined();
        expect(result.total_allocated).toBeLessThanOrEqual(10000000);
      });

      it('should handle floating point precision', async () => {
        const periods = [mockPeriod(2026, 1)];
        periodRepository.findAll.mockResolvedValue(periods);
        recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);

        const result = await useCase.execute(1, mockHouse as House, 800.55);

        // Floating point should be handled properly
        expect(typeof result.total_allocated).toBe('number');
        expect(typeof result.remaining_as_credit).toBe('number');
      });

      it('should handle many periods', async () => {
        const periods = Array.from({ length: 24 }, (_, i) =>
          mockPeriod(2024 + Math.floor(i / 12), (i % 12) + 1),
        );
        periodRepository.findAll.mockResolvedValue(periods);
        recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);

        const result = await useCase.execute(1, mockHouse as House, 16000); // 20 periodos

        expect(result.suggested_allocations).toBeDefined();
        expect(result.suggested_allocations.length).toBeLessThanOrEqual(24);
      });
    });
  });

  describe('Integración con repositorios', () => {
    it('should use house balance from repository', async () => {
      const periods = [mockPeriod(2026, 1)];
      periodRepository.findAll.mockResolvedValue(periods);
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);

      const customBalance = {
        id: 1,
        house_id: 1,
        credit_balance: 1000,
        accumulated_cents: 50,
      };
      houseBalanceRepository.getOrCreate.mockResolvedValue(customBalance as any);

      const mockAIResponse = {
        confidence: 'high' as const,
        allocations: [],
        total_allocated: 0,
        remaining_as_credit: 800,
        reasoning: 'Already has credit',
      };

      distributionAnalyzer.analyzeDistribution.mockResolvedValue(mockAIResponse);

      await useCase.execute(1, mockHouse as House, 800);

      expect(houseBalanceRepository.getOrCreate).toHaveBeenCalledWith(1);
    });

    it('should retrieve all periods from repository', async () => {
      const periods = [
        mockPeriod(2026, 1),
        mockPeriod(2026, 2),
        mockPeriod(2026, 3),
      ];
      periodRepository.findAll.mockResolvedValue(periods);
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);

      await useCase.execute(1, mockHouse as House, 800);

      expect(periodRepository.findAll).toHaveBeenCalled();
    });
  });
});
