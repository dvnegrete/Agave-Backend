import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CondonePenaltyUseCase } from '../condone-penalty.use-case';
import {
  IHousePeriodChargeRepository,
  IRecordAllocationRepository,
  IPeriodRepository,
} from '../../interfaces';
import { ChargeAdjustmentValidatorService } from '../../infrastructure/services/charge-adjustment-validator.service';
import { HouseStatusSnapshotService } from '../../infrastructure/services/house-status-snapshot.service';
import { AllocationConceptType } from '@/shared/database/entities/enums';

describe('CondonePenaltyUseCase', () => {
  let useCase: CondonePenaltyUseCase;
  let chargeRepository: jest.Mocked<IHousePeriodChargeRepository>;
  let allocationRepository: jest.Mocked<IRecordAllocationRepository>;
  let periodRepository: jest.Mocked<IPeriodRepository>;
  let validator: jest.Mocked<ChargeAdjustmentValidatorService>;
  let snapshotService: jest.Mocked<HouseStatusSnapshotService>;

  const mockPeriod = {
    id: 1,
    year: 2026,
    month: 1,
  };

  const mockPenaltyCharge = {
    id: 1,
    house_id: 1,
    period_id: 1,
    concept_type: AllocationConceptType.PENALTIES,
    expected_amount: 50,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CondonePenaltyUseCase,
        {
          provide: 'IHousePeriodChargeRepository',
          useValue: {
            findByHouseAndPeriod: jest.fn(),
            findByPeriod: jest.fn(),
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
            validatePenaltyCondonation: jest.fn(),
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

    useCase = module.get<CondonePenaltyUseCase>(CondonePenaltyUseCase);
    chargeRepository = module.get('IHousePeriodChargeRepository');
    allocationRepository = module.get('IRecordAllocationRepository');
    periodRepository = module.get('IPeriodRepository');
    validator = module.get(ChargeAdjustmentValidatorService);
    snapshotService = module.get(HouseStatusSnapshotService);
  });

  describe('execute', () => {
    it('should condone penalty successfully', async () => {
      const houseId = 1;
      const periodId = 1;

      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      chargeRepository.findByHouseAndPeriod.mockResolvedValue([
        mockPenaltyCharge,
      ] as any);
      allocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      validator.validatePenaltyCondonation.mockReturnValue(undefined);
      chargeRepository.delete.mockResolvedValue(true);
      snapshotService.invalidateByHouseId.mockResolvedValue(undefined);

      const result = await useCase.execute(houseId, periodId);

      expect(result).toBeDefined();
      expect(result.houseId).toBe(houseId);
      expect(result.periodId).toBe(periodId);
      expect(result.condonedAmount).toBe(50);
      expect(chargeRepository.delete).toHaveBeenCalledWith(1);
      expect(snapshotService.invalidateByHouseId).toHaveBeenCalledWith(
        houseId,
      );
    });

    it('should throw NotFoundException if period not found', async () => {
      periodRepository.findById.mockResolvedValue(null);

      await expect(useCase.execute(1, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if no penalty charge found', async () => {
      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      chargeRepository.findByHouseAndPeriod.mockResolvedValue([] as any);

      await expect(useCase.execute(1, 1)).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if deletion fails', async () => {
      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      chargeRepository.findByHouseAndPeriod.mockResolvedValue([
        mockPenaltyCharge,
      ] as any);
      allocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      validator.validatePenaltyCondonation.mockReturnValue(undefined);
      chargeRepository.delete.mockResolvedValue(false);

      await expect(useCase.execute(1, 1)).rejects.toThrow(BadRequestException);
    });

    it('should calculate paid amount from allocations', async () => {
      const paidAllocation = {
        concept_type: AllocationConceptType.PENALTIES,
        allocated_amount: 25,
      };

      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      chargeRepository.findByHouseAndPeriod.mockResolvedValue([
        mockPenaltyCharge,
      ] as any);
      allocationRepository.findByHouseAndPeriod.mockResolvedValue([
        paidAllocation,
      ] as any);
      validator.validatePenaltyCondonation.mockReturnValue(undefined);
      chargeRepository.delete.mockResolvedValue(true);
      snapshotService.invalidateByHouseId.mockResolvedValue(undefined);

      const result = await useCase.execute(1, 1);

      expect(validator.validatePenaltyCondonation).toHaveBeenCalledWith(
        AllocationConceptType.PENALTIES,
        25,
      );
      expect(result.condonedAmount).toBe(50);
    });
  });

  describe('executeMultiple', () => {
    it('should condone penalties for multiple houses successfully', async () => {
      const periodId = 1;
      const houseIds = [1, 2];

      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      chargeRepository.findByHouseAndPeriod.mockResolvedValue([
        mockPenaltyCharge,
      ] as any);
      allocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      validator.validatePenaltyCondonation.mockReturnValue(undefined);
      chargeRepository.delete.mockResolvedValue(true);
      snapshotService.invalidateByHouseId.mockResolvedValue(undefined);

      const result = await useCase.executeMultiple(periodId, houseIds);

      expect(result).toBeDefined();
      expect(result.periodId).toBe(periodId);
      expect(result.condoneCount).toBe(2);
      expect(result.failureCount).toBe(0);
      expect(result.totalCondonedAmount).toBe(100); // 50 * 2
      expect(result.details).toHaveLength(2);
    });

    it('should handle mixed success and failure in batch', async () => {
      const periodId = 1;
      const houseIds = [1, 2];

      periodRepository.findById.mockResolvedValue(mockPeriod as any);

      // First call succeeds
      chargeRepository.findByHouseAndPeriod.mockResolvedValueOnce([
        mockPenaltyCharge,
      ] as any);
      allocationRepository.findByHouseAndPeriod.mockResolvedValueOnce([]);
      validator.validatePenaltyCondonation.mockReturnValue(undefined);
      chargeRepository.delete.mockResolvedValueOnce(true);
      snapshotService.invalidateByHouseId.mockResolvedValueOnce(undefined);

      // Second call fails (no penalty found)
      chargeRepository.findByHouseAndPeriod.mockResolvedValueOnce([] as any);

      const result = await useCase.executeMultiple(periodId, houseIds);

      expect(result.condoneCount).toBe(1);
      expect(result.failureCount).toBe(1);
      expect(result.details[0].status).toBe('success');
      expect(result.details[1].status).toBe('failed');
    });

    it('should fetch all houses with penalties if houseIds not provided', async () => {
      const periodId = 1;

      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      chargeRepository.findByPeriod.mockResolvedValue([
        { ...mockPenaltyCharge, house_id: 1 },
        { ...mockPenaltyCharge, house_id: 2 },
        { ...mockPenaltyCharge, house_id: 2 }, // Duplicate
      ] as any);
      chargeRepository.findByHouseAndPeriod.mockResolvedValue([
        mockPenaltyCharge,
      ] as any);
      allocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      validator.validatePenaltyCondonation.mockReturnValue(undefined);
      chargeRepository.delete.mockResolvedValue(true);
      snapshotService.invalidateByHouseId.mockResolvedValue(undefined);

      const result = await useCase.executeMultiple(periodId);

      // Should process unique houses: [1, 2]
      expect(result.details).toHaveLength(2);
    });

    it('should throw NotFoundException if period not found', async () => {
      periodRepository.findById.mockResolvedValue(null);

      await expect(useCase.executeMultiple(1)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return correct response structure for batch', async () => {
      const periodId = 1;

      periodRepository.findById.mockResolvedValue(mockPeriod as any);
      chargeRepository.findByHouseAndPeriod.mockResolvedValue([
        mockPenaltyCharge,
      ] as any);
      allocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      validator.validatePenaltyCondonation.mockReturnValue(undefined);
      chargeRepository.delete.mockResolvedValue(true);
      snapshotService.invalidateByHouseId.mockResolvedValue(undefined);

      const result = await useCase.executeMultiple(periodId, [1]);

      expect(result).toHaveProperty('periodId');
      expect(result).toHaveProperty('totalCondonedAmount');
      expect(result).toHaveProperty('condoneCount');
      expect(result).toHaveProperty('failureCount');
      expect(result).toHaveProperty('details');
      expect(result.details[0]).toHaveProperty('houseId');
      expect(result.details[0]).toHaveProperty('condonedAmount');
      expect(result.details[0]).toHaveProperty('status');
    });
  });
});
