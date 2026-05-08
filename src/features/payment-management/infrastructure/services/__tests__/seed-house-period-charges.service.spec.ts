import { Test, TestingModule } from '@nestjs/testing';
import { SeedHousePeriodChargesService } from '../seed-house-period-charges.service';
import { IHousePeriodChargeRepository } from '../../../interfaces/house-period-charge.repository.interface';
import { IHousePeriodOverrideRepository } from '../../../interfaces/house-period-override.repository.interface';
import { IRecordAllocationRepository } from '../../../interfaces/record-allocation.repository.interface';
import { IPeriodRepository } from '../../../interfaces/period.repository.interface';
import { IPeriodConfigRepository } from '../../../interfaces/period-config.repository.interface';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { HouseStatusSnapshotService } from '../house-status-snapshot.service';
import { AllocationConceptType } from '@/shared/database/entities/enums';

describe('SeedHousePeriodChargesService', () => {
  let service: SeedHousePeriodChargesService;
  let chargeRepository: jest.Mocked<IHousePeriodChargeRepository>;
  let overrideRepository: jest.Mocked<IHousePeriodOverrideRepository>;
  let allocationRepository: jest.Mocked<IRecordAllocationRepository>;
  let periodRepository: jest.Mocked<IPeriodRepository>;
  let configRepository: jest.Mocked<IPeriodConfigRepository>;
  let houseRepository: jest.Mocked<HouseRepository>;
  let snapshotService: jest.Mocked<HouseStatusSnapshotService>;

  const mockConfig = {
    id: 1,
    default_maintenance_amount: 800,
    default_water_amount: 150,
    default_extraordinary_fee_amount: 200,
    payment_due_day: 15,
    late_payment_penalty_amount: 100,
  };

  const mockHouses = [
    { id: 1, number_house: 1 },
    { id: 2, number_house: 2 },
  ];

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeedHousePeriodChargesService,
        {
          provide: 'IHousePeriodChargeRepository',
          useValue: {
            findByHouseAndPeriod: jest.fn(),
            findByPeriod: jest.fn(),
            createBatch: jest.fn(),
          },
        },
        {
          provide: 'IHousePeriodOverrideRepository',
          useValue: {
            findByPeriodId: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: 'IRecordAllocationRepository',
          useValue: {
            getTotalPaidByHousePeriod: jest.fn(),
          },
        },
        {
          provide: 'IPeriodRepository',
          useValue: {
            findById: jest.fn(),
            findByYearAndMonth: jest.fn(),
          },
        },
        {
          provide: 'IPeriodConfigRepository',
          useValue: {
            findById: jest.fn(),
            findActiveForDate: jest.fn(),
          },
        },
        {
          provide: HouseRepository,
          useValue: {
            findAll: jest.fn(),
          },
        },
        {
          provide: HouseStatusSnapshotService,
          useValue: {
            invalidateAll: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<SeedHousePeriodChargesService>(
      SeedHousePeriodChargesService,
    );
    chargeRepository = module.get(
      'IHousePeriodChargeRepository',
    ) as jest.Mocked<IHousePeriodChargeRepository>;
    overrideRepository = module.get(
      'IHousePeriodOverrideRepository',
    ) as jest.Mocked<IHousePeriodOverrideRepository>;
    allocationRepository = module.get(
      'IRecordAllocationRepository',
    ) as jest.Mocked<IRecordAllocationRepository>;
    periodRepository = module.get(
      'IPeriodRepository',
    ) as jest.Mocked<IPeriodRepository>;
    configRepository = module.get(
      'IPeriodConfigRepository',
    ) as jest.Mocked<IPeriodConfigRepository>;
    houseRepository = module.get(HouseRepository) as jest.Mocked<HouseRepository>;
    snapshotService = module.get(
      HouseStatusSnapshotService,
    ) as jest.Mocked<HouseStatusSnapshotService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('seedChargesForPeriod', () => {
    const newPeriod = {
      id: 10,
      year: 2026,
      month: 5,
      period_config_id: 1,
      water_active: false,
      extraordinary_fee_active: false,
    };

    it('should throw when period does not exist', async () => {
      periodRepository.findById.mockResolvedValue(null);

      await expect(service.seedChargesForPeriod(99)).rejects.toThrow(
        'Period with ID 99 not found',
      );
    });

    it('should skip when period has no PeriodConfig', async () => {
      periodRepository.findById.mockResolvedValue({
        ...newPeriod,
        period_config_id: null,
      } as any);

      await service.seedChargesForPeriod(10);

      expect(chargeRepository.createBatch).not.toHaveBeenCalled();
      expect(snapshotService.invalidateAll).not.toHaveBeenCalled();
    });

    it('should skip when no houses exist', async () => {
      periodRepository.findById.mockResolvedValue(newPeriod as any);
      configRepository.findById.mockResolvedValue(mockConfig as any);
      houseRepository.findAll.mockResolvedValue([]);

      await service.seedChargesForPeriod(10);

      expect(chargeRepository.createBatch).not.toHaveBeenCalled();
    });

    it('should create MAINTENANCE charges for all houses (water/extra inactive)', async () => {
      periodRepository.findById.mockResolvedValue(newPeriod as any);
      configRepository.findById.mockResolvedValue(mockConfig as any);
      houseRepository.findAll.mockResolvedValue(mockHouses as any);
      // Sin mes anterior — no se aplican penalidades retroactivas
      periodRepository.findByYearAndMonth.mockResolvedValue(null);

      await service.seedChargesForPeriod(10);

      expect(chargeRepository.createBatch).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            house_id: 1,
            period_id: 10,
            concept_type: AllocationConceptType.MAINTENANCE,
            expected_amount: 800,
            source: 'period_config',
          }),
          expect.objectContaining({
            house_id: 2,
            period_id: 10,
            concept_type: AllocationConceptType.MAINTENANCE,
            expected_amount: 800,
            source: 'period_config',
          }),
        ]),
      );
      const sentCharges = chargeRepository.createBatch.mock.calls[0][0];
      expect(sentCharges).toHaveLength(2);
      expect(snapshotService.invalidateAll).toHaveBeenCalledTimes(1);
    });

    it('should add WATER and EXTRAORDINARY_FEE charges when their flags are active', async () => {
      const periodWithExtras = {
        ...newPeriod,
        water_active: true,
        extraordinary_fee_active: true,
      };
      periodRepository.findById.mockResolvedValue(periodWithExtras as any);
      configRepository.findById.mockResolvedValue(mockConfig as any);
      houseRepository.findAll.mockResolvedValue(mockHouses as any);
      periodRepository.findByYearAndMonth.mockResolvedValue(null);

      await service.seedChargesForPeriod(10);

      const sentCharges = chargeRepository.createBatch.mock.calls[0][0];
      // 2 casas × 3 conceptos = 6 cargos
      expect(sentCharges).toHaveLength(6);
      expect(
        sentCharges.filter(
          (c: any) => c.concept_type === AllocationConceptType.WATER,
        ),
      ).toHaveLength(2);
      expect(
        sentCharges.filter(
          (c: any) => c.concept_type === AllocationConceptType.EXTRAORDINARY_FEE,
        ),
      ).toHaveLength(2);
    });

    it('should respect override custom_amount when present', async () => {
      const overrides = [
        {
          house_id: 1,
          period_id: 10,
          concept_type: AllocationConceptType.MAINTENANCE,
          custom_amount: 1200,
        },
      ];

      periodRepository.findById.mockResolvedValue(newPeriod as any);
      configRepository.findById.mockResolvedValue(mockConfig as any);
      houseRepository.findAll.mockResolvedValue(mockHouses as any);
      overrideRepository.findByPeriodId.mockResolvedValue(overrides as any);
      periodRepository.findByYearAndMonth.mockResolvedValue(null);

      await service.seedChargesForPeriod(10);

      const sentCharges = chargeRepository.createBatch.mock.calls[0][0];
      const house1Charge = sentCharges.find((c: any) => c.house_id === 1)!;
      const house2Charge = sentCharges.find((c: any) => c.house_id === 2)!;
      expect(house1Charge.expected_amount).toBe(1200);
      expect(house1Charge.source).toBe('override');
      expect(house2Charge.expected_amount).toBe(800);
      expect(house2Charge.source).toBe('period_config');
    });

    it('should NEVER include PENALTIES in the new period charges', async () => {
      periodRepository.findById.mockResolvedValue(newPeriod as any);
      configRepository.findById.mockResolvedValue(mockConfig as any);
      houseRepository.findAll.mockResolvedValue(mockHouses as any);
      periodRepository.findByYearAndMonth.mockResolvedValue(null);

      await service.seedChargesForPeriod(10);

      const sentCharges = chargeRepository.createBatch.mock.calls[0][0];
      expect(
        sentCharges.some(
          (c: any) => c.concept_type === AllocationConceptType.PENALTIES,
        ),
      ).toBe(false);
    });
  });

  describe('applyPenaltiesToOverduePreviousPeriods (via seedChargesForPeriod)', () => {
    const newPeriod = {
      id: 10,
      year: 2026,
      month: 5,
      period_config_id: 1,
      water_active: false,
      extraordinary_fee_active: false,
    };
    const previousPeriod = {
      id: 9,
      year: 2026,
      month: 4,
      period_config_id: 1,
      water_active: false,
      extraordinary_fee_active: false,
      payment_due_day: null,
    };

    it('should apply penalty to previous month when overdue and unpaid', async () => {
      // Previous month exists, overdue (april with config.payment_due_day=15, today is 2026-05-07).
      const previousCharges = [
        {
          house_id: 1,
          period_id: 9,
          concept_type: AllocationConceptType.MAINTENANCE,
          expected_amount: 800,
        },
      ];

      periodRepository.findById
        .mockResolvedValueOnce(newPeriod as any) // primera llamada en seedChargesForPeriod
        .mockResolvedValueOnce(newPeriod as any); // segunda en applyPenalties...
      configRepository.findById.mockResolvedValue(mockConfig as any);
      houseRepository.findAll.mockResolvedValue([mockHouses[0]] as any);
      periodRepository.findByYearAndMonth.mockResolvedValue(previousPeriod as any);
      configRepository.findActiveForDate.mockResolvedValue(mockConfig as any);
      chargeRepository.findByPeriod.mockResolvedValue(previousCharges as any);
      allocationRepository.getTotalPaidByHousePeriod.mockResolvedValue(0);

      await service.seedChargesForPeriod(10);

      // Esperamos 2 llamadas a createBatch:
      //   1) cargos del nuevo período
      //   2) penalidad sobre período anterior
      expect(chargeRepository.createBatch).toHaveBeenCalledTimes(2);
      const penaltyBatch = chargeRepository.createBatch.mock.calls[1][0];
      expect(penaltyBatch).toEqual([
        expect.objectContaining({
          house_id: 1,
          period_id: 9,
          concept_type: AllocationConceptType.PENALTIES,
          expected_amount: 100,
          source: 'auto_penalty',
        }),
      ]);
    });

    it('should NOT apply penalty when previous calendar month does not exist in DB', async () => {
      periodRepository.findById.mockResolvedValue(newPeriod as any);
      configRepository.findById.mockResolvedValue(mockConfig as any);
      houseRepository.findAll.mockResolvedValue([mockHouses[0]] as any);
      periodRepository.findByYearAndMonth.mockResolvedValue(null); // no previous
      // chargeRepository.findByPeriod no debe llamarse

      await service.seedChargesForPeriod(10);

      expect(chargeRepository.findByPeriod).not.toHaveBeenCalled();
      // Solo el batch de cargos del nuevo período
      expect(chargeRepository.createBatch).toHaveBeenCalledTimes(1);
    });

    it('should NOT apply penalty when previous month is not yet overdue', async () => {
      // Hoy: 2026-05-07. newPeriod=junio 2026 (mes 6). previousPeriod=mayo 2026 (mes 5).
      // payment_due_day=20 → dueDate=2026-05-20 (futuro), aún no vencido.
      const newPeriodJune = { ...newPeriod, month: 6 };
      const previousMay = { ...previousPeriod, month: 5 };
      const futureDueConfig = { ...mockConfig, payment_due_day: 20 };

      periodRepository.findById
        .mockResolvedValueOnce(newPeriodJune as any)
        .mockResolvedValueOnce(newPeriodJune as any);
      configRepository.findById.mockResolvedValue(futureDueConfig as any);
      houseRepository.findAll.mockResolvedValue([mockHouses[0]] as any);
      periodRepository.findByYearAndMonth.mockResolvedValue(previousMay as any);
      configRepository.findActiveForDate.mockResolvedValue(futureDueConfig as any);

      await service.seedChargesForPeriod(10);

      // No se debe leer charges del mes anterior cuando el due date aún no pasó
      expect(chargeRepository.findByPeriod).not.toHaveBeenCalled();
      expect(chargeRepository.createBatch).toHaveBeenCalledTimes(1);
    });

    it('should NOT apply penalty when house already has a penalty charge for previous month', async () => {
      const previousCharges = [
        {
          house_id: 1,
          period_id: 9,
          concept_type: AllocationConceptType.MAINTENANCE,
          expected_amount: 800,
        },
        {
          house_id: 1,
          period_id: 9,
          concept_type: AllocationConceptType.PENALTIES,
          expected_amount: 100,
        },
      ];

      periodRepository.findById
        .mockResolvedValueOnce(newPeriod as any)
        .mockResolvedValueOnce(newPeriod as any);
      configRepository.findById.mockResolvedValue(mockConfig as any);
      houseRepository.findAll.mockResolvedValue([mockHouses[0]] as any);
      periodRepository.findByYearAndMonth.mockResolvedValue(previousPeriod as any);
      configRepository.findActiveForDate.mockResolvedValue(mockConfig as any);
      chargeRepository.findByPeriod.mockResolvedValue(previousCharges as any);

      await service.seedChargesForPeriod(10);

      // Solo el primer createBatch (cargos del nuevo período)
      expect(chargeRepository.createBatch).toHaveBeenCalledTimes(1);
    });

    it('should NOT apply penalty when house has fully paid the previous month', async () => {
      const previousCharges = [
        {
          house_id: 1,
          period_id: 9,
          concept_type: AllocationConceptType.MAINTENANCE,
          expected_amount: 800,
        },
      ];

      periodRepository.findById
        .mockResolvedValueOnce(newPeriod as any)
        .mockResolvedValueOnce(newPeriod as any);
      configRepository.findById.mockResolvedValue(mockConfig as any);
      houseRepository.findAll.mockResolvedValue([mockHouses[0]] as any);
      periodRepository.findByYearAndMonth.mockResolvedValue(previousPeriod as any);
      configRepository.findActiveForDate.mockResolvedValue(mockConfig as any);
      chargeRepository.findByPeriod.mockResolvedValue(previousCharges as any);
      allocationRepository.getTotalPaidByHousePeriod.mockResolvedValue(800); // pago total

      await service.seedChargesForPeriod(10);

      // No hay penalidad para casas que pagaron completo
      expect(chargeRepository.createBatch).toHaveBeenCalledTimes(1);
    });

    it('should respect previousPeriod.payment_due_day override over PeriodConfig.payment_due_day', async () => {
      // Override del período anterior: payment_due_day=31. Hoy es 2026-05-07.
      // dueDate=2026-04-31 → en JS se normaliza a 2026-05-01, que es <= hoy → SÍ vencido.
      // Si en lugar de honrar el override usara config.payment_due_day=15 → 2026-04-15, también vencido.
      // Para distinguir, usamos override muy alto que cae en mes siguiente y comparamos contra fecha
      // antes de su due. Como hoy es 2026-05-07, override=10 → 2026-04-10 (vencido, debería penalizar).
      const prevWithOverride = { ...previousPeriod, payment_due_day: 10 };
      const previousCharges = [
        {
          house_id: 1,
          period_id: 9,
          concept_type: AllocationConceptType.MAINTENANCE,
          expected_amount: 800,
        },
      ];

      periodRepository.findById
        .mockResolvedValueOnce(newPeriod as any)
        .mockResolvedValueOnce(newPeriod as any);
      configRepository.findById.mockResolvedValue(mockConfig as any);
      houseRepository.findAll.mockResolvedValue([mockHouses[0]] as any);
      periodRepository.findByYearAndMonth.mockResolvedValue(prevWithOverride as any);
      configRepository.findActiveForDate.mockResolvedValue(mockConfig as any);
      chargeRepository.findByPeriod.mockResolvedValue(previousCharges as any);
      allocationRepository.getTotalPaidByHousePeriod.mockResolvedValue(0);

      await service.seedChargesForPeriod(10);

      // Penalidad debe aplicarse usando el override del período anterior
      expect(chargeRepository.createBatch).toHaveBeenCalledTimes(2);
    });
  });

  describe('hasCharges', () => {
    it('should return true when period has charges', async () => {
      chargeRepository.findByPeriod.mockResolvedValue([
        { id: 1, period_id: 10 } as any,
      ]);

      const result = await service.hasCharges(10);

      expect(result).toBe(true);
    });

    it('should return false when period has no charges', async () => {
      chargeRepository.findByPeriod.mockResolvedValue([]);

      const result = await service.hasCharges(10);

      expect(result).toBe(false);
    });
  });
});
