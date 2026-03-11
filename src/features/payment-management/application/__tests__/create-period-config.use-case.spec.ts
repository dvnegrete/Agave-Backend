import { Test, TestingModule } from '@nestjs/testing';
import { CreatePeriodConfigUseCase } from '../create-period-config.use-case';
import { PeriodConfigDomain } from '../../domain';
import { IPeriodConfigRepository } from '../../interfaces';
import { CreatePeriodConfigDto } from '../../dto';

describe('CreatePeriodConfigUseCase', () => {
  let useCase: CreatePeriodConfigUseCase;
  let periodConfigRepository: jest.Mocked<IPeriodConfigRepository>;

  const mockConfig = {
    id: 1,
    default_maintenance_amount: 800,
    default_water_amount: 150,
    default_extraordinary_fee_amount: 200,
    payment_due_day: 10,
    late_payment_penalty_amount: 50,
    effective_from: new Date('2025-01-01'),
    effective_until: null,
    is_active: true,
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreatePeriodConfigUseCase,
        {
          provide: 'IPeriodConfigRepository',
          useValue: {
            create: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<CreatePeriodConfigUseCase>(CreatePeriodConfigUseCase);
    periodConfigRepository = module.get('IPeriodConfigRepository') as jest.Mocked<IPeriodConfigRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should create period config successfully', async () => {
      const dto: CreatePeriodConfigDto = {
        default_maintenance_amount: 800,
        default_water_amount: 150,
        default_extraordinary_fee_amount: 200,
        payment_due_day: 10,
        late_payment_penalty_amount: 50,
        effective_from: '2025-01-01',
        is_active: true,
      };

      periodConfigRepository.findAll.mockResolvedValue([]);
      periodConfigRepository.create.mockResolvedValue(mockConfig as any);

      const result = await useCase.execute(dto);

      expect(periodConfigRepository.create).toHaveBeenCalledWith({
        default_maintenance_amount: dto.default_maintenance_amount,
        default_water_amount: dto.default_water_amount,
        default_extraordinary_fee_amount: dto.default_extraordinary_fee_amount,
        payment_due_day: dto.payment_due_day,
        late_payment_penalty_amount: dto.late_payment_penalty_amount,
        effective_from: new Date(dto.effective_from),
        effective_until: undefined,
        is_active: true,
      });
      expect(result).toBeInstanceOf(PeriodConfigDomain);
      expect(result.defaultMaintenanceAmount).toBe(800);
    });

    it('should auto-close previous active config without end date', async () => {
      const dto: CreatePeriodConfigDto = {
        default_maintenance_amount: 900,
        default_water_amount: 150,
        default_extraordinary_fee_amount: 200,
        payment_due_day: 10,
        late_payment_penalty_amount: 50,
        effective_from: '2025-06-01',
        is_active: true,
      };

      const previousActiveConfig = {
        id: 1,
        is_active: true,
        effective_until: null,
        effective_from: new Date('2025-01-01'),
      };

      periodConfigRepository.findAll.mockResolvedValue([
        previousActiveConfig as any,
      ]);
      periodConfigRepository.create.mockResolvedValue(mockConfig as any);

      await useCase.execute(dto);

      expect(periodConfigRepository.update).toHaveBeenCalledWith(1, {
        effective_until: new Date('2025-05-31'),
      });
    });

    it('should not close config if it has effective_until', async () => {
      const dto: CreatePeriodConfigDto = {
        default_maintenance_amount: 800,
        default_water_amount: 150,
        default_extraordinary_fee_amount: 200,
        payment_due_day: 10,
        late_payment_penalty_amount: 50,
        effective_from: '2025-01-01',
        is_active: true,
      };

      const previousConfig = {
        id: 1,
        is_active: true,
        effective_until: new Date('2024-12-31'),
        effective_from: new Date('2024-01-01'),
      };

      periodConfigRepository.findAll.mockResolvedValue([previousConfig as any]);
      periodConfigRepository.create.mockResolvedValue(mockConfig as any);

      await useCase.execute(dto);

      expect(periodConfigRepository.update).not.toHaveBeenCalled();
    });

    it('should handle optional effective_until date', async () => {
      const dto: CreatePeriodConfigDto = {
        default_maintenance_amount: 800,
        default_water_amount: 150,
        default_extraordinary_fee_amount: 200,
        payment_due_day: 10,
        late_payment_penalty_amount: 50,
        effective_from: '2025-01-01',
        effective_until: '2025-12-31',
        is_active: true,
      };

      periodConfigRepository.findAll.mockResolvedValue([]);
      periodConfigRepository.create.mockResolvedValue({
        ...mockConfig,
        effective_until: new Date('2025-12-31'),
      } as any);

      await useCase.execute(dto);

      expect(periodConfigRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          effective_until: new Date('2025-12-31'),
        }),
      );
    });

    it('should default is_active to true if not provided', async () => {
      const dto: CreatePeriodConfigDto = {
        default_maintenance_amount: 800,
        default_water_amount: 150,
        default_extraordinary_fee_amount: 200,
        payment_due_day: 10,
        late_payment_penalty_amount: 50,
        effective_from: '2025-01-01',
      };

      periodConfigRepository.findAll.mockResolvedValue([]);
      periodConfigRepository.create.mockResolvedValue(mockConfig as any);

      await useCase.execute(dto);

      expect(periodConfigRepository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: true,
        }),
      );
    });

    it('should allow creating inactive config', async () => {
      const dto: CreatePeriodConfigDto = {
        default_maintenance_amount: 800,
        default_water_amount: 150,
        default_extraordinary_fee_amount: 200,
        payment_due_day: 10,
        late_payment_penalty_amount: 50,
        effective_from: '2025-01-01',
        is_active: false,
      };

      periodConfigRepository.findAll.mockResolvedValue([]);
      periodConfigRepository.create.mockResolvedValue({
        ...mockConfig,
        is_active: false,
      } as any);

      const result = await useCase.execute(dto);

      expect(result.isActive).toBe(false);
    });

    it('should handle repository errors', async () => {
      const dto: CreatePeriodConfigDto = {
        default_maintenance_amount: 800,
        default_water_amount: 150,
        default_extraordinary_fee_amount: 200,
        payment_due_day: 10,
        late_payment_penalty_amount: 50,
        effective_from: '2025-01-01',
      };

      periodConfigRepository.findAll.mockResolvedValue([]);
      periodConfigRepository.create.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(useCase.execute(dto)).rejects.toThrow('Database error');
    });
  });
});
