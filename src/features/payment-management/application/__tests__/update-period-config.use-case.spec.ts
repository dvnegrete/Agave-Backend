import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { UpdatePeriodConfigUseCase } from '../update-period-config.use-case';
import { PeriodConfigDomain } from '../../domain';
import { IPeriodConfigRepository } from '../../interfaces';
import { UpdatePeriodConfigDto } from '../../dto';

describe('UpdatePeriodConfigUseCase', () => {
  let useCase: UpdatePeriodConfigUseCase;
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
        UpdatePeriodConfigUseCase,
        {
          provide: 'IPeriodConfigRepository',
          useValue: {
            findById: jest.fn(),
            update: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<UpdatePeriodConfigUseCase>(UpdatePeriodConfigUseCase);
    periodConfigRepository = module.get('IPeriodConfigRepository') as jest.Mocked<IPeriodConfigRepository>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should update period config successfully', async () => {
      const dto: UpdatePeriodConfigDto = {
        default_maintenance_amount: 900,
        payment_due_day: 15,
      };

      periodConfigRepository.findById.mockResolvedValue(mockConfig as any);
      periodConfigRepository.update.mockResolvedValue({
        ...mockConfig,
        default_maintenance_amount: 900,
        payment_due_day: 15,
      } as any);

      const result = await useCase.execute(1, dto);

      expect(periodConfigRepository.findById).toHaveBeenCalledWith(1);
      expect(periodConfigRepository.update).toHaveBeenCalledWith(1, {
        default_maintenance_amount: 900,
        payment_due_day: 15,
      });
      expect(result).toBeInstanceOf(PeriodConfigDomain);
      expect(result.defaultMaintenanceAmount).toBe(900);
      expect(result.paymentDueDay).toBe(15);
    });

    it('should throw NotFoundException if config not found', async () => {
      const dto: UpdatePeriodConfigDto = {
        default_maintenance_amount: 900,
      };

      periodConfigRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute(999, dto)).rejects.toThrow(NotFoundException);
      await expect(useCase.execute(999, dto)).rejects.toThrow(
        'PeriodConfig con id 999 no encontrada',
      );
    });

    it('should throw BadRequestException if no fields provided', async () => {
      const dto: UpdatePeriodConfigDto = {};

      periodConfigRepository.findById.mockResolvedValue(mockConfig as any);

      await expect(useCase.execute(1, dto)).rejects.toThrow(BadRequestException);
      await expect(useCase.execute(1, dto)).rejects.toThrow(
        'Debe proporcionar al menos un campo para actualizar',
      );
    });

    it('should update only provided fields', async () => {
      const dto: UpdatePeriodConfigDto = {
        is_active: false,
      };

      periodConfigRepository.findById.mockResolvedValue(mockConfig as any);
      periodConfigRepository.update.mockResolvedValue({
        ...mockConfig,
        is_active: false,
      } as any);

      await useCase.execute(1, dto);

      expect(periodConfigRepository.update).toHaveBeenCalledWith(1, {
        is_active: false,
      });
    });

    it('should handle date fields correctly', async () => {
      const dto: UpdatePeriodConfigDto = {
        effective_from: '2025-06-01',
        effective_until: '2025-12-31',
      };

      periodConfigRepository.findById.mockResolvedValue(mockConfig as any);
      periodConfigRepository.update.mockResolvedValue(mockConfig as any);

      await useCase.execute(1, dto);

      expect(periodConfigRepository.update).toHaveBeenCalledWith(1, {
        effective_from: new Date('2025-06-01'),
        effective_until: new Date('2025-12-31'),
      });
    });

    it('should update all fields when all provided', async () => {
      const dto: UpdatePeriodConfigDto = {
        default_maintenance_amount: 900,
        default_water_amount: 200,
        default_extraordinary_fee_amount: 250,
        payment_due_day: 15,
        late_payment_penalty_amount: 100,
        effective_from: '2025-06-01',
        effective_until: '2025-12-31',
        is_active: false,
      };

      periodConfigRepository.findById.mockResolvedValue(mockConfig as any);
      periodConfigRepository.update.mockResolvedValue({
        ...mockConfig,
        ...dto,
        effective_from: new Date(dto.effective_from!),
        effective_until: new Date(dto.effective_until!),
      } as any);

      const result = await useCase.execute(1, dto);

      expect(periodConfigRepository.update).toHaveBeenCalledWith(1, {
        default_maintenance_amount: 900,
        default_water_amount: 200,
        default_extraordinary_fee_amount: 250,
        payment_due_day: 15,
        late_payment_penalty_amount: 100,
        effective_from: new Date('2025-06-01'),
        effective_until: new Date('2025-12-31'),
        is_active: false,
      });
      expect(result.isActive).toBe(false);
    });

    it('should handle repository update errors', async () => {
      const dto: UpdatePeriodConfigDto = {
        default_maintenance_amount: 900,
      };

      periodConfigRepository.findById.mockResolvedValue(mockConfig as any);
      periodConfigRepository.update.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(useCase.execute(1, dto)).rejects.toThrow('Database error');
    });

    it('should allow updating to zero values', async () => {
      const dto: UpdatePeriodConfigDto = {
        default_water_amount: 0,
        late_payment_penalty_amount: 0,
      };

      periodConfigRepository.findById.mockResolvedValue(mockConfig as any);
      periodConfigRepository.update.mockResolvedValue({
        ...mockConfig,
        default_water_amount: 0,
        late_payment_penalty_amount: 0,
      } as any);

      await useCase.execute(1, dto);

      expect(periodConfigRepository.update).toHaveBeenCalledWith(1, {
        default_water_amount: 0,
        late_payment_penalty_amount: 0,
      });
    });
  });
});
