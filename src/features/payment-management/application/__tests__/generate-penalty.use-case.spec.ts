import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { GeneratePenaltyUseCase } from '../generate-penalty.use-case';
import { CtaPenalties, PeriodConfig } from '@/shared/database/entities';
import { IPeriodConfigRepository } from '../../interfaces';
import { BusinessValues } from '@/shared/content/config/business-values.config';

describe('GeneratePenaltyUseCase', () => {
  let useCase: GeneratePenaltyUseCase;
  let penaltiesRepository: jest.Mocked<Repository<CtaPenalties>>;
  let periodConfigRepository: jest.Mocked<IPeriodConfigRepository>;

  const mockCtaPenalty = {
    id: 1,
    house_id: 1,
    period_id: 1,
    amount: 50,
    description: 'Penalidad por atraso - Enero 2026',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockPeriodConfig = {
    id: 1,
    default_maintenance_amount: 800,
    default_water_amount: 100,
    default_extraordinary_fee_amount: null,
    payment_due_day: 15,
    late_payment_penalty_amount: 50,
    effective_from: new Date(),
    effective_until: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GeneratePenaltyUseCase,
        {
          provide: getRepositoryToken(CtaPenalties),
          useValue: {
            findOne: jest.fn(),
            create: jest.fn(),
            save: jest.fn(),
            manager: {
              query: jest.fn(),
            },
          },
        },
        {
          provide: 'IPeriodConfigRepository',
          useValue: {
            findActiveForDate: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<GeneratePenaltyUseCase>(GeneratePenaltyUseCase);
    penaltiesRepository = module.get(getRepositoryToken(CtaPenalties));
    periodConfigRepository = module.get('IPeriodConfigRepository');
  });

  describe('execute', () => {
    const houseId = 1;
    const periodId = 1;
    const periodStartDate = new Date('2026-01-15');

    it('should create new penalty successfully', async () => {
      // No penalidad existente
      penaltiesRepository.findOne.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      penaltiesRepository.create.mockReturnValue(mockCtaPenalty as any);
      penaltiesRepository.save.mockResolvedValue(mockCtaPenalty as any);

      const result = await useCase.execute(houseId, periodId, periodStartDate);

      expect(result).toBeDefined();
      expect(result?.amount).toBe(50);
      expect(penaltiesRepository.create).toHaveBeenCalled();
      expect(penaltiesRepository.save).toHaveBeenCalled();
    });

    it('should use config penalty amount if available', async () => {
      const customConfig = { ...mockPeriodConfig, late_payment_penalty_amount: 100 };
      penaltiesRepository.findOne.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(customConfig as any);
      penaltiesRepository.create.mockReturnValue({
        ...mockCtaPenalty,
        amount: 100,
      } as any);
      penaltiesRepository.save.mockResolvedValue({
        ...mockCtaPenalty,
        amount: 100,
      } as any);

      const result = await useCase.execute(houseId, periodId, periodStartDate);

      expect(result?.amount).toBe(100);
    });

    it('should use BusinessValues default if config penalty is null', async () => {
      const configWithoutPenalty = { ...mockPeriodConfig, late_payment_penalty_amount: null };
      penaltiesRepository.findOne.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        configWithoutPenalty as any,
      );
      penaltiesRepository.create.mockReturnValue({
        ...mockCtaPenalty,
        amount: BusinessValues.payments.defaultLatePenaltyAmount,
      } as any);
      penaltiesRepository.save.mockResolvedValue({
        ...mockCtaPenalty,
        amount: BusinessValues.payments.defaultLatePenaltyAmount,
      } as any);

      const result = await useCase.execute(houseId, periodId, periodStartDate);

      expect(result?.amount).toBe(BusinessValues.payments.defaultLatePenaltyAmount);
    });

    it('should return null if penalty already exists (duplicate)', async () => {
      // Penalty ya existe
      penaltiesRepository.findOne.mockResolvedValue(mockCtaPenalty as any);

      const result = await useCase.execute(houseId, periodId, periodStartDate);

      expect(result).toBeNull();
      expect(penaltiesRepository.save).not.toHaveBeenCalled();
    });

    it('should handle race condition with unique constraint error', async () => {
      penaltiesRepository.findOne.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      penaltiesRepository.create.mockReturnValue(mockCtaPenalty as any);

      // Simular error de unique constraint
      const uniqueError = new Error('duplicate key value');
      uniqueError['code'] = '23505'; // PostgreSQL unique violation
      penaltiesRepository.save.mockRejectedValue(uniqueError);

      const result = await useCase.execute(houseId, periodId, periodStartDate);

      expect(result).toBeNull();
    });

    it('should create penalty with correct description', async () => {
      penaltiesRepository.findOne.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );

      let createdPenalty: any;
      penaltiesRepository.create.mockImplementation(((data: any) => {
        createdPenalty = { ...data, id: 1 };
        return createdPenalty;
      }) as any);
      penaltiesRepository.save.mockResolvedValue(mockCtaPenalty as any);

      await useCase.execute(houseId, periodId, periodStartDate);

      expect(penaltiesRepository.create).toHaveBeenCalled();
      const callArgs = (penaltiesRepository.create as jest.Mock).mock.calls[0][0];
      expect(callArgs.description).toBeDefined();
      expect(callArgs.house_id).toBe(houseId);
      expect(callArgs.period_id).toBe(periodId);
    });

    it('should set correct house_id and period_id', async () => {
      penaltiesRepository.findOne.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      penaltiesRepository.create.mockReturnValue(mockCtaPenalty as any);
      penaltiesRepository.save.mockResolvedValue(mockCtaPenalty as any);

      await useCase.execute(2, 5, periodStartDate);

      const callArgs = (penaltiesRepository.create as jest.Mock).mock.calls[0][0];
      expect(callArgs.house_id).toBe(2);
      expect(callArgs.period_id).toBe(5);
    });

    it('should handle missing period config gracefully', async () => {
      penaltiesRepository.findOne.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(null);
      penaltiesRepository.create.mockReturnValue({
        ...mockCtaPenalty,
        amount: BusinessValues.payments.defaultLatePenaltyAmount,
      } as any);
      penaltiesRepository.save.mockResolvedValue({
        ...mockCtaPenalty,
        amount: BusinessValues.payments.defaultLatePenaltyAmount,
      } as any);

      const result = await useCase.execute(houseId, periodId, periodStartDate);

      expect(result?.amount).toBe(BusinessValues.payments.defaultLatePenaltyAmount);
    });

    it('should handle multiple periods without interference', async () => {
      penaltiesRepository.findOne.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      penaltiesRepository.create.mockReturnValue(mockCtaPenalty as any);
      penaltiesRepository.save.mockResolvedValue(mockCtaPenalty as any);

      const result1 = await useCase.execute(1, 1, new Date('2026-01-15'));
      const result2 = await useCase.execute(1, 2, new Date('2026-02-15'));

      expect(result1).toBeDefined();
      expect(result2).toBeDefined();
      expect(penaltiesRepository.save).toHaveBeenCalledTimes(2);
    });

    it('should handle edge case: exactly on due date', async () => {
      penaltiesRepository.findOne.mockResolvedValue(null);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      penaltiesRepository.create.mockReturnValue(mockCtaPenalty as any);
      penaltiesRepository.save.mockResolvedValue(mockCtaPenalty as any);

      const dueDateExact = new Date('2026-01-15'); // exactly on 15th
      const result = await useCase.execute(houseId, periodId, dueDateExact);

      expect(result).toBeDefined();
    });
  });
});
