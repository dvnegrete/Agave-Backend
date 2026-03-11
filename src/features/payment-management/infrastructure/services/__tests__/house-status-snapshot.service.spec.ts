import { Test, TestingModule } from '@nestjs/testing';
import { HouseStatusSnapshotService } from '../house-status-snapshot.service';
import { IHouseStatusSnapshotRepository } from '../../../interfaces/house-status-snapshot.repository.interface';
import { CalculateHouseBalanceStatusUseCase } from '../../../application/calculate-house-balance-status.use-case';
import { House } from '@/shared/database/entities';
import { EnrichedHouseBalance } from '../../../domain/house-balance-status.types';

describe('HouseStatusSnapshotService', () => {
  let service: HouseStatusSnapshotService;
  let repository: jest.Mocked<IHouseStatusSnapshotRepository>;
  let calculateUseCase: jest.Mocked<CalculateHouseBalanceStatusUseCase>;

  const mockHouse: Partial<House> = {
    id: 1,
    number_house: 101,
  };

  const mockEnrichedBalance: EnrichedHouseBalance = {
    house_id: 1,
    status: 'AL_DIA',
    total_debt: 0,
    credit_balance: 500,
    total_unpaid_periods: 0,
    monthly_breakdown: [],
  } as any;

  const mockSnapshot = {
    id: 1,
    house_id: 1,
    status: 'AL_DIA',
    total_debt: 0,
    credit_balance: 500,
    total_unpaid_periods: 0,
    enriched_data: mockEnrichedBalance,
    is_stale: false,
    calculated_at: new Date(Date.now() - 60000), // 1 min ago
    invalidated_at: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HouseStatusSnapshotService,
        {
          provide: 'IHouseStatusSnapshotRepository',
          useValue: {
            findByHouseId: jest.fn(),
            findAll: jest.fn(),
            upsert: jest.fn(),
            invalidateByHouseId: jest.fn(),
            invalidateAll: jest.fn(),
            invalidateByHouseIds: jest.fn(),
          },
        },
        {
          provide: CalculateHouseBalanceStatusUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<HouseStatusSnapshotService>(HouseStatusSnapshotService);
    repository = module.get('IHouseStatusSnapshotRepository') as jest.Mocked<IHouseStatusSnapshotRepository>;
    calculateUseCase = module.get(CalculateHouseBalanceStatusUseCase) as jest.Mocked<CalculateHouseBalanceStatusUseCase>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOrCalculate', () => {
    it('should return cached snapshot when fresh', async () => {
      repository.findByHouseId.mockResolvedValue(mockSnapshot as any);

      const result = await service.getOrCalculate(1, mockHouse as House);

      expect(result).toEqual(mockEnrichedBalance);
      expect(calculateUseCase.execute).not.toHaveBeenCalled();
      expect(repository.upsert).not.toHaveBeenCalled();
    });

    it('should recalculate and cache when snapshot is stale', async () => {
      const staleSnapshot = { ...mockSnapshot, is_stale: true };
      repository.findByHouseId.mockResolvedValue(staleSnapshot as any);
      calculateUseCase.execute.mockResolvedValue(mockEnrichedBalance);

      const result = await service.getOrCalculate(1, mockHouse as House);

      expect(result).toEqual(mockEnrichedBalance);
      expect(calculateUseCase.execute).toHaveBeenCalledWith(1, mockHouse);
      expect(repository.upsert).toHaveBeenCalled();
    });

    it('should recalculate when snapshot does not exist', async () => {
      repository.findByHouseId.mockResolvedValue(null);
      calculateUseCase.execute.mockResolvedValue(mockEnrichedBalance);

      const result = await service.getOrCalculate(1, mockHouse as House);

      expect(result).toEqual(mockEnrichedBalance);
      expect(calculateUseCase.execute).toHaveBeenCalled();
      expect(repository.upsert).toHaveBeenCalled();
    });

    it('should recalculate when snapshot has expired TTL (24+ hours old)', async () => {
      const oldSnapshot = {
        ...mockSnapshot,
        calculated_at: new Date(Date.now() - 25 * 60 * 60 * 1000), // 25 hours ago
      };
      repository.findByHouseId.mockResolvedValue(oldSnapshot as any);
      calculateUseCase.execute.mockResolvedValue(mockEnrichedBalance);

      const result = await service.getOrCalculate(1, mockHouse as House);

      expect(result).toEqual(mockEnrichedBalance);
      expect(calculateUseCase.execute).toHaveBeenCalled();
    });

    it('should save snapshot with correct enriched_data', async () => {
      repository.findByHouseId.mockResolvedValue(null);
      calculateUseCase.execute.mockResolvedValue(mockEnrichedBalance);

      await service.getOrCalculate(1, mockHouse as House);

      expect(repository.upsert).toHaveBeenCalledWith(1, expect.objectContaining({
        enriched_data: mockEnrichedBalance,
        is_stale: false,
        calculated_at: expect.any(Date),
        invalidated_at: null,
      }));
    });

    it('should include house status in cached snapshot', async () => {
      const enrichedWithMorosidad = {
        ...mockEnrichedBalance,
        status: 'MOROSA' as any,
      };
      repository.findByHouseId.mockResolvedValue(null);
      calculateUseCase.execute.mockResolvedValue(enrichedWithMorosidad as any);

      await service.getOrCalculate(1, mockHouse as House);

      expect(repository.upsert).toHaveBeenCalledWith(1, expect.objectContaining({
        status: 'MOROSA',
      }));
    });
  });

  describe('getAllForSummary', () => {
    it('should return empty array when no houses provided', async () => {
      const result = await service.getAllForSummary([]);

      expect(result).toEqual([]);
      expect(repository.findAll).not.toHaveBeenCalled();
    });

    it('should return all fresh snapshots without recalculation', async () => {
      const houses = [
        { ...mockHouse, id: 1 } as House,
        { ...mockHouse, id: 2 } as House,
      ];

      const snapshot2 = {
        ...mockSnapshot,
        house_id: 2,
        enriched_data: { ...mockEnrichedBalance, house_id: 2 },
      };

      repository.findAll.mockResolvedValue([mockSnapshot as any, snapshot2 as any]);

      const result = await service.getAllForSummary(houses);

      expect(result).toHaveLength(2);
      expect(calculateUseCase.execute).not.toHaveBeenCalled();
      expect(repository.upsert).not.toHaveBeenCalled();
    });

    it('should recalculate missing snapshots', async () => {
      const houses = [
        { ...mockHouse, id: 1 } as House,
        { ...mockHouse, id: 2 } as House,
      ];

      // Solo snapshot para casa 1
      repository.findAll.mockResolvedValue([mockSnapshot as any]);
      calculateUseCase.execute.mockImplementation((houseId) =>
        Promise.resolve({ ...mockEnrichedBalance, house_id: houseId } as any),
      );
      repository.upsert.mockResolvedValue(mockSnapshot as any);

      const result = await service.getAllForSummary(houses);

      expect(result).toHaveLength(2);
      expect(calculateUseCase.execute).toHaveBeenCalledWith(2, houses[1]);
    });

    it('should recalculate stale snapshots', async () => {
      const houses = [
        { ...mockHouse, id: 1 } as House,
        { ...mockHouse, id: 2 } as House,
      ];

      const staleSnapshot = { ...mockSnapshot, is_stale: true };
      const freshSnapshot = { ...mockSnapshot, house_id: 2, is_stale: false };

      repository.findAll.mockResolvedValue([staleSnapshot as any, freshSnapshot as any]);
      calculateUseCase.execute.mockResolvedValue(mockEnrichedBalance);

      const result = await service.getAllForSummary(houses);

      expect(calculateUseCase.execute).toHaveBeenCalledWith(1, houses[0]);
      expect(result).toHaveLength(2);
    });

    it('should preserve order of input houses in output', async () => {
      const houses = [
        { ...mockHouse, id: 3 } as House,
        { ...mockHouse, id: 1 } as House,
        { ...mockHouse, id: 2 } as House,
      ];

      const snap1 = { ...mockSnapshot, house_id: 1, enriched_data: { ...mockEnrichedBalance, house_id: 1 } as any } as any;
      const snap2 = { ...mockSnapshot, house_id: 2, enriched_data: { ...mockEnrichedBalance, house_id: 2 } as any } as any;
      const snap3 = { ...mockSnapshot, house_id: 3, enriched_data: { ...mockEnrichedBalance, house_id: 3 } as any } as any;

      repository.findAll.mockResolvedValue([snap1, snap2, snap3]);

      const result = await service.getAllForSummary(houses);

      // Check order: 3, 1, 2
      expect(result[0].house_id).toBe(3);
      expect(result[1].house_id).toBe(1);
      expect(result[2].house_id).toBe(2);
    });

    it('should parallelize recalculations', async () => {
      const houses = Array.from({ length: 5 }, (_, i) => ({
        ...mockHouse,
        id: i + 1,
      } as House));

      repository.findAll.mockResolvedValue([]); // No snapshots
      calculateUseCase.execute.mockImplementation((houseId) =>
        Promise.resolve({ ...mockEnrichedBalance, house_id: houseId } as any),
      );
      repository.upsert.mockResolvedValue(mockSnapshot as any);

      await service.getAllForSummary(houses);

      // Should complete with all calculations
      expect(calculateUseCase.execute).toHaveBeenCalledTimes(5);
      expect(repository.upsert).toHaveBeenCalledTimes(5);
    });

    it('should handle mixed fresh and stale snapshots', async () => {
      const houses = [
        { ...mockHouse, id: 1 } as House,
        { ...mockHouse, id: 2 } as House,
        { ...mockHouse, id: 3 } as House,
      ];

      const fresh = mockSnapshot as any;
      const stale = { ...mockSnapshot, house_id: 2, is_stale: true } as any;

      repository.findAll.mockResolvedValue([fresh, stale]);
      calculateUseCase.execute.mockImplementation((houseId) =>
        Promise.resolve({ ...mockEnrichedBalance, house_id: houseId } as any),
      );
      repository.upsert.mockResolvedValue(mockSnapshot as any);

      const result = await service.getAllForSummary(houses);

      expect(result).toHaveLength(3);
      // Should recalculate house 2 (stale) and house 3 (missing)
      expect(calculateUseCase.execute).toHaveBeenCalledTimes(2);
    });
  });

  describe('invalidateByHouseId', () => {
    it('should invalidate snapshot for single house', async () => {
      await service.invalidateByHouseId(1);

      expect(repository.invalidateByHouseId).toHaveBeenCalledWith(1);
    });

    it('should handle non-existent house gracefully', async () => {
      await service.invalidateByHouseId(999);

      expect(repository.invalidateByHouseId).toHaveBeenCalledWith(999);
    });
  });

  describe('invalidateAll', () => {
    it('should invalidate all snapshots', async () => {
      await service.invalidateAll();

      expect(repository.invalidateAll).toHaveBeenCalled();
    });
  });

  describe('invalidateByHouseIds', () => {
    it('should invalidate snapshots for multiple houses', async () => {
      const houseIds = [1, 2, 3, 4, 5];

      await service.invalidateByHouseIds(houseIds);

      expect(repository.invalidateByHouseIds).toHaveBeenCalledWith(houseIds);
    });

    it('should handle empty array', async () => {
      await service.invalidateByHouseIds([]);

      expect(repository.invalidateByHouseIds).not.toHaveBeenCalled();
    });

    it('should handle single house in array', async () => {
      await service.invalidateByHouseIds([42]);

      expect(repository.invalidateByHouseIds).toHaveBeenCalledWith([42]);
    });
  });

  describe('TTL Expiration Logic', () => {
    it('should consider snapshot fresh within 24 hours', async () => {
      const recentSnapshot = {
        ...mockSnapshot,
        calculated_at: new Date(Date.now() - 23 * 60 * 60 * 1000), // 23 hours ago
      };
      repository.findByHouseId.mockResolvedValue(recentSnapshot as any);

      await service.getOrCalculate(1, mockHouse as House);

      expect(calculateUseCase.execute).not.toHaveBeenCalled();
    });

    it('should consider snapshot expired after 24 hours', async () => {
      const expiredSnapshot = {
        ...mockSnapshot,
        calculated_at: new Date(Date.now() - 24 * 60 * 60 * 1000 - 1), // 24h+ ago
      };
      repository.findByHouseId.mockResolvedValue(expiredSnapshot as any);
      calculateUseCase.execute.mockResolvedValue(mockEnrichedBalance);

      await service.getOrCalculate(1, mockHouse as House);

      expect(calculateUseCase.execute).toHaveBeenCalled();
    });

    it('should handle null calculated_at date', async () => {
      const snapshotWithoutDate = {
        ...mockSnapshot,
        calculated_at: null,
      };
      repository.findByHouseId.mockResolvedValue(snapshotWithoutDate as any);
      calculateUseCase.execute.mockResolvedValue(mockEnrichedBalance);

      await service.getOrCalculate(1, mockHouse as House);

      expect(calculateUseCase.execute).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should propagate calculate usecase errors', async () => {
      repository.findByHouseId.mockResolvedValue(null);
      calculateUseCase.execute.mockRejectedValue(new Error('Calculation failed'));

      await expect(service.getOrCalculate(1, mockHouse as House)).rejects.toThrow(
        'Calculation failed',
      );
    });

    it('should propagate repository upsert errors', async () => {
      repository.findByHouseId.mockResolvedValue(null);
      calculateUseCase.execute.mockResolvedValue(mockEnrichedBalance);
      repository.upsert.mockRejectedValue(new Error('Upsert failed'));

      await expect(service.getOrCalculate(1, mockHouse as House)).rejects.toThrow(
        'Upsert failed',
      );
    });

    it('should handle bulk operation partial failures gracefully', async () => {
      const houses = [
        { ...mockHouse, id: 1 } as House,
        { ...mockHouse, id: 2 } as House,
      ];

      repository.findAll.mockResolvedValue([]);
      calculateUseCase.execute.mockResolvedValueOnce(mockEnrichedBalance);
      calculateUseCase.execute.mockRejectedValueOnce(new Error('House 2 calculation failed'));

      await expect(service.getAllForSummary(houses)).rejects.toThrow();
    });
  });

  describe('Cache Consistency', () => {
    it('should not double-recalculate when calling getOrCalculate twice in succession', async () => {
      repository.findByHouseId.mockResolvedValueOnce(null);
      calculateUseCase.execute.mockResolvedValue(mockEnrichedBalance);
      repository.upsert.mockResolvedValue(mockSnapshot as any);

      // First call - should calculate
      await service.getOrCalculate(1, mockHouse as House);
      expect(calculateUseCase.execute).toHaveBeenCalledTimes(1);

      // Second call - should use fresh snapshot (mock needs to return what was cached)
      repository.findByHouseId.mockResolvedValueOnce({
        ...mockSnapshot,
        calculated_at: new Date(),
      } as any);

      await service.getOrCalculate(1, mockHouse as House);
      expect(calculateUseCase.execute).toHaveBeenCalledTimes(1); // Still 1 call total
    });
  });
});
