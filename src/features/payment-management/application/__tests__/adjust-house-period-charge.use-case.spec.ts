import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { AdjustHousePeriodChargeUseCase } from '../adjust-house-period-charge.use-case';
import { IHousePeriodChargeRepository } from '../../interfaces/house-period-charge.repository.interface';
import { IRecordAllocationRepository } from '../../interfaces/record-allocation.repository.interface';
import { IPeriodRepository } from '../../interfaces/period.repository.interface';
import { ChargeAdjustmentValidatorService } from '../../infrastructure/services/charge-adjustment-validator.service';
import { HouseStatusSnapshotService } from '../../infrastructure/services/house-status-snapshot.service';

describe('AdjustHousePeriodChargeUseCase', () => {
  let useCase: AdjustHousePeriodChargeUseCase;
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
        AdjustHousePeriodChargeUseCase,
        {
          provide: 'IHousePeriodChargeRepository',
          useValue: {
            findById: jest.fn(),
            update: jest.fn(),
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
            validateAdjustment: jest.fn(),
            calculateAdjustmentDifference: jest.fn(),
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

    useCase = module.get<AdjustHousePeriodChargeUseCase>(
      AdjustHousePeriodChargeUseCase,
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
    it('should adjust charge amount successfully (increase)', async () => {
      const updatedCharge = { ...mockCharge, expected_amount: 1000 };
      chargeRepository.findById.mockResolvedValue(mockCharge as any);
      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      allocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      chargeRepository.update.mockResolvedValue(updatedCharge as any);
      validator.calculateAdjustmentDifference.mockReturnValue(200);

      const result = await useCase.execute(1, 1000);

      expect(chargeRepository.findById).toHaveBeenCalledWith(1);
      expect(validator.validateAdjustment).toHaveBeenCalledWith(800, 1000, 1, 2025);
      expect(chargeRepository.update).toHaveBeenCalledWith(1, {
        expected_amount: 1000,
      });
      expect(snapshotService.invalidateByHouseId).toHaveBeenCalledWith(42);
      expect(result.previousAmount).toBe(800);
      expect(result.newAmount).toBe(1000);
      expect(result.difference).toBe(200);
      expect(result.isPaid).toBe(false);
    });

    it('should adjust charge amount successfully (decrease without payments)', async () => {
      const updatedCharge = { ...mockCharge, expected_amount: 600 };
      chargeRepository.findById.mockResolvedValue(mockCharge as any);
      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      allocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      chargeRepository.update.mockResolvedValue(updatedCharge as any);
      validator.calculateAdjustmentDifference.mockReturnValue(-200);

      const result = await useCase.execute(1, 600);

      expect(result.previousAmount).toBe(800);
      expect(result.newAmount).toBe(600);
      expect(result.difference).toBe(-200);
    });

    it('should throw NotFoundException if charge not found', async () => {
      chargeRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute(999, 1000)).rejects.toThrow(NotFoundException);
      await expect(useCase.execute(999, 1000)).rejects.toThrow(
        'Charge with ID 999 not found',
      );
    });

    it('should throw NotFoundException if period not found', async () => {
      chargeRepository.findById.mockResolvedValue(mockCharge as any);
      periodRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute(1, 1000)).rejects.toThrow(NotFoundException);
      await expect(useCase.execute(1, 1000)).rejects.toThrow(
        'Period with ID 1 not found',
      );
    });

    it('should throw BadRequestException when reducing below paid amount', async () => {
      const allocations = [
        { concept_type: 'MAINTENANCE', allocated_amount: 400 },
        { concept_type: 'MAINTENANCE', allocated_amount: 400 },
      ];

      chargeRepository.findById.mockResolvedValue(mockCharge as any);
      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      allocationRepository.findByHouseAndPeriod.mockResolvedValue(
        allocations as any,
      );

      await expect(useCase.execute(1, 700)).rejects.toThrow(BadRequestException);
      await expect(useCase.execute(1, 700)).rejects.toThrow(
        'No se puede reducir el monto por debajo de lo ya pagado',
      );
      expect(chargeRepository.update).not.toHaveBeenCalled();
    });

    it('should calculate paid amount correctly from allocations', async () => {
      const allocations = [
        { concept_type: 'MAINTENANCE', allocated_amount: 300 },
        { concept_type: 'MAINTENANCE', allocated_amount: 250 },
        { concept_type: 'WATER', allocated_amount: 150 },
      ];

      const updatedCharge = { ...mockCharge, expected_amount: 1000 };
      chargeRepository.findById.mockResolvedValue(mockCharge as any);
      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      allocationRepository.findByHouseAndPeriod.mockResolvedValue(
        allocations as any,
      );
      chargeRepository.update.mockResolvedValue(updatedCharge as any);
      validator.calculateAdjustmentDifference.mockReturnValue(200);

      const result = await useCase.execute(1, 1000);

      expect(result.isPaid).toBe(false);
    });

    it('should mark as paid when new amount equals paid amount', async () => {
      const allocations = [
        { concept_type: 'MAINTENANCE', allocated_amount: 500 },
        { concept_type: 'MAINTENANCE', allocated_amount: 500 },
      ];

      const updatedCharge = { ...mockCharge, expected_amount: 1000 };
      chargeRepository.findById.mockResolvedValue(mockCharge as any);
      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      allocationRepository.findByHouseAndPeriod.mockResolvedValue(
        allocations as any,
      );
      chargeRepository.update.mockResolvedValue(updatedCharge as any);
      validator.calculateAdjustmentDifference.mockReturnValue(200);

      const result = await useCase.execute(1, 1000);

      expect(result.isPaid).toBe(true);
    });

    it('should validate adjustment before updating', async () => {
      chargeRepository.findById.mockResolvedValue(mockCharge as any);
      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      allocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      validator.validateAdjustment.mockImplementation(() => {
        throw new BadRequestException('Period too old');
      });

      await expect(useCase.execute(1, 1000)).rejects.toThrow(BadRequestException);
      expect(chargeRepository.update).not.toHaveBeenCalled();
    });

    it('should return complete result with all charge details', async () => {
      const updatedCharge = { ...mockCharge, expected_amount: 950 };
      chargeRepository.findById.mockResolvedValue(mockCharge as any);
      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      allocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      chargeRepository.update.mockResolvedValue(updatedCharge as any);
      validator.calculateAdjustmentDifference.mockReturnValue(150);

      const result = await useCase.execute(1, 950);

      expect(result.chargeId).toBe(1);
      expect(result.houseId).toBe(42);
      expect(result.periodId).toBe(1);
      expect(result.conceptType).toBe('MAINTENANCE');
      expect(result.previousAmount).toBe(800);
      expect(result.newAmount).toBe(950);
      expect(result.difference).toBe(150);
    });
  });
});
