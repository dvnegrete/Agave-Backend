import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { ReverseHousePeriodChargeUseCase } from '../reverse-house-period-charge.use-case';
import { IHousePeriodChargeRepository } from '../../interfaces/house-period-charge.repository.interface';
import { IRecordAllocationRepository } from '../../interfaces/record-allocation.repository.interface';
import { IPeriodRepository } from '../../interfaces/period.repository.interface';
import { ChargeAdjustmentValidatorService } from '../../infrastructure/services/charge-adjustment-validator.service';
import { HouseStatusSnapshotService } from '../../infrastructure/services/house-status-snapshot.service';

describe('ReverseHousePeriodChargeUseCase', () => {
  let useCase: ReverseHousePeriodChargeUseCase;
  let chargeRepository: jest.Mocked<IHousePeriodChargeRepository>;
  let allocationRepository: jest.Mocked<IRecordAllocationRepository>;
  let periodRepository: jest.Mocked<IPeriodRepository>;
  let validator: jest.Mocked<ChargeAdjustmentValidatorService>;
  let snapshotService: jest.Mocked<HouseStatusSnapshotService>;

  const mockCharge = {
    id: 1,
    house_id: 42,
    period_id: 1,
    concept_type: 'MAINTENANCE',
    expected_amount: 800,
  };

  const mockPeriod = {
    id: 1,
    year: 2025,
    month: 1,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReverseHousePeriodChargeUseCase,
        {
          provide: 'IHousePeriodChargeRepository',
          useValue: {
            findById: jest.fn(),
            delete: jest.fn(),
          },
        },
        {
          provide: 'IRecordAllocationRepository',
          useValue: {
            findByHouseAndPeriod: jest.fn(),
          },
        },
        {
          provide: 'IPeriodRepository',
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: ChargeAdjustmentValidatorService,
          useValue: {
            validateReversal: jest.fn(),
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

    useCase = module.get<ReverseHousePeriodChargeUseCase>(
      ReverseHousePeriodChargeUseCase,
    );
    chargeRepository = module.get('IHousePeriodChargeRepository') as jest.Mocked<
      IHousePeriodChargeRepository
    >;
    allocationRepository = module.get(
      'IRecordAllocationRepository',
    ) as jest.Mocked<IRecordAllocationRepository>;
    periodRepository = module.get('IPeriodRepository') as jest.Mocked<IPeriodRepository>;
    validator = module.get(
      ChargeAdjustmentValidatorService,
    ) as jest.Mocked<ChargeAdjustmentValidatorService>;
    snapshotService = module.get(
      HouseStatusSnapshotService,
    ) as jest.Mocked<HouseStatusSnapshotService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should reverse charge successfully when no payments exist', async () => {
      chargeRepository.findById.mockResolvedValue(mockCharge as any);
      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      allocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      chargeRepository.delete.mockResolvedValue(true);

      const result = await useCase.execute(1);

      expect(chargeRepository.findById).toHaveBeenCalledWith(1);
      expect(validator.validateReversal).toHaveBeenCalledWith(800, 0, 1, 2025);
      expect(chargeRepository.delete).toHaveBeenCalledWith(1);
      expect(snapshotService.invalidateByHouseId).toHaveBeenCalledWith(42);
      expect(result.chargeId).toBe(1);
      expect(result.removedAmount).toBe(800);
    });

    it('should throw NotFoundException if charge not found', async () => {
      chargeRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute(999)).rejects.toThrow(NotFoundException);
      await expect(useCase.execute(999)).rejects.toThrow(
        'Charge with ID 999 not found',
      );
    });

    it('should throw NotFoundException if period not found', async () => {
      chargeRepository.findById.mockResolvedValue(mockCharge as any);
      periodRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute(1)).rejects.toThrow(NotFoundException);
      await expect(useCase.execute(1)).rejects.toThrow(
        'Period with ID 1 not found',
      );
    });

    it('should calculate paid amount correctly', async () => {
      const allocations = [
        { concept_type: 'MAINTENANCE', allocated_amount: 400 },
        { concept_type: 'MAINTENANCE', allocated_amount: 400 },
        { concept_type: 'WATER', allocated_amount: 150 },
      ];

      chargeRepository.findById.mockResolvedValue(mockCharge as any);
      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      allocationRepository.findByHouseAndPeriod.mockResolvedValue(
        allocations as any,
      );
      validator.validateReversal.mockImplementation(() => {
        throw new BadRequestException('Cannot reverse paid charge');
      });

      await expect(useCase.execute(1)).rejects.toThrow(BadRequestException);
      expect(validator.validateReversal).toHaveBeenCalledWith(800, 800, 1, 2025);
    });

    it('should throw BadRequestException if deletion fails', async () => {
      chargeRepository.findById.mockResolvedValue(mockCharge as any);
      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      allocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      chargeRepository.delete.mockResolvedValue(false);

      await expect(useCase.execute(1)).rejects.toThrow(BadRequestException);
      await expect(useCase.execute(1)).rejects.toThrow(
        'No se pudo eliminar el cargo con ID 1',
      );
    });

    it('should return descriptive message with charge details', async () => {
      chargeRepository.findById.mockResolvedValue(mockCharge as any);
      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      allocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      chargeRepository.delete.mockResolvedValue(true);

      const result = await useCase.execute(1);

      expect(result.message).toContain('$800');
      expect(result.message).toContain('MAINTENANCE');
      expect(result.message).toContain('casa 42');
      expect(result.message).toContain('2025-1');
    });

    it('should validate reversal before attempting deletion', async () => {
      chargeRepository.findById.mockResolvedValue(mockCharge as any);
      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      allocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      validator.validateReversal.mockImplementation(() => {
        throw new BadRequestException('Period too old');
      });

      await expect(useCase.execute(1)).rejects.toThrow(BadRequestException);
      expect(chargeRepository.delete).not.toHaveBeenCalled();
    });
  });
});
