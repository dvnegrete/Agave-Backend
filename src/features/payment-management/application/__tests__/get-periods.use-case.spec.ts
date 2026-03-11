import { Test, TestingModule } from '@nestjs/testing';
import { GetPeriodsUseCase } from '../get-periods.use-case';
import { PeriodDomain } from '../../domain';
import { IPeriodRepository } from '../../interfaces';

describe('GetPeriodsUseCase', () => {
  let useCase: GetPeriodsUseCase;
  let periodRepository: jest.Mocked<IPeriodRepository>;

  const mockPeriod1 = {
    id: 1,
    year: 2025,
    month: 1,
    start_date: new Date('2025-01-01'),
    end_date: new Date('2025-01-31'),
    period_config_id: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockPeriod2 = {
    id: 2,
    year: 2025,
    month: 2,
    start_date: new Date('2025-02-01'),
    end_date: new Date('2025-02-28'),
    period_config_id: 1,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GetPeriodsUseCase,
        {
          provide: 'IPeriodRepository',
          useValue: {
            findAll: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<GetPeriodsUseCase>(GetPeriodsUseCase);
    periodRepository = module.get('IPeriodRepository') as jest.Mocked<IPeriodRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return all periods as domain objects', async () => {
      periodRepository.findAll.mockResolvedValue([
        mockPeriod1 as any,
        mockPeriod2 as any,
      ]);

      const result = await useCase.execute();

      expect(periodRepository.findAll).toHaveBeenCalledTimes(1);
      expect(result).toHaveLength(2);
      expect(result[0]).toBeInstanceOf(PeriodDomain);
      expect(result[0].year).toBe(2025);
      expect(result[0].month).toBe(1);
      expect(result[1]).toBeInstanceOf(PeriodDomain);
      expect(result[1].year).toBe(2025);
      expect(result[1].month).toBe(2);
    });

    it('should return empty array when no periods exist', async () => {
      periodRepository.findAll.mockResolvedValue([]);

      const result = await useCase.execute();

      expect(periodRepository.findAll).toHaveBeenCalledTimes(1);
      expect(result).toEqual([]);
    });

    it('should map all period properties correctly', async () => {
      periodRepository.findAll.mockResolvedValue([mockPeriod1 as any]);

      const result = await useCase.execute();

      expect(result[0].id).toBe(mockPeriod1.id);
      expect(result[0].year).toBe(mockPeriod1.year);
      expect(result[0].month).toBe(mockPeriod1.month);
      expect(result[0].startDate).toEqual(mockPeriod1.start_date);
      expect(result[0].endDate).toEqual(mockPeriod1.end_date);
      expect(result[0].periodConfigId).toBe(mockPeriod1.period_config_id);
    });

    it('should handle repository errors', async () => {
      const error = new Error('Database connection error');
      periodRepository.findAll.mockRejectedValue(error);

      await expect(useCase.execute()).rejects.toThrow('Database connection error');
    });

    it('should handle large number of periods', async () => {
      const largePeriodList = Array.from({ length: 100 }, (_, i) => ({
        ...mockPeriod1,
        id: i + 1,
        month: (i % 12) + 1,
        year: 2025 + Math.floor(i / 12),
      }));

      periodRepository.findAll.mockResolvedValue(largePeriodList as any);

      const result = await useCase.execute();

      expect(result).toHaveLength(100);
      expect(result.every((p) => p instanceof PeriodDomain)).toBe(true);
    });
  });
});
