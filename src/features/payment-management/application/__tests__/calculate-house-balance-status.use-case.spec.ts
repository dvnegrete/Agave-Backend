import { Test, TestingModule } from '@nestjs/testing';
import { CalculateHouseBalanceStatusUseCase } from '../calculate-house-balance-status.use-case';
import {
  IRecordAllocationRepository,
  IPeriodRepository,
  IPeriodConfigRepository,
  IHouseBalanceRepository,
  IHousePeriodOverrideRepository,
  IHousePeriodChargeRepository,
} from '../../interfaces';
import { LastTransactionBankRepository } from '@/shared/database/repositories/last-transaction-bank.repository';
import { GeneratePenaltyUseCase } from '../generate-penalty.use-case';
import { HouseStatus, PeriodPaymentStatus } from '../../domain/house-balance-status.types';
import { House } from '@/shared/database/entities';

describe('CalculateHouseBalanceStatusUseCase', () => {
  let useCase: CalculateHouseBalanceStatusUseCase;
  let recordAllocationRepository: jest.Mocked<IRecordAllocationRepository>;
  let periodRepository: jest.Mocked<IPeriodRepository>;
  let periodConfigRepository: jest.Mocked<IPeriodConfigRepository>;
  let houseBalanceRepository: jest.Mocked<IHouseBalanceRepository>;
  let housePeriodOverrideRepository: jest.Mocked<IHousePeriodOverrideRepository>;
  let housePeriodChargeRepository: jest.Mocked<IHousePeriodChargeRepository>;
  let lastTransactionBankRepository: jest.Mocked<LastTransactionBankRepository>;
  let generatePenaltyUseCase: jest.Mocked<GeneratePenaltyUseCase>;

  const mockHouse = {
    id: 42,
    number_house: 42,
  } as House;

  const mockPeriod = {
    id: 1,
    year: 2025,
    month: 1,
    start_date: new Date('2025-01-01'),
    water_active: false,
    extraordinary_fee_active: false,
  };

  const mockPeriodConfig = {
    id: 1,
    default_maintenance_amount: 800,
    default_water_amount: 150,
    default_extraordinary_fee_amount: 200,
    payment_due_day: 15,
    late_payment_penalty_amount: 100,
  };

  const mockHouseBalance = {
    house_id: 42,
    credit_balance: 0,
    accumulated_cents: 0,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CalculateHouseBalanceStatusUseCase,
        {
          provide: 'IRecordAllocationRepository',
          useValue: {
            findByHouseAndPeriod: jest.fn(),
          },
        },
        {
          provide: 'IPeriodRepository',
          useValue: {
            findAll: jest.fn(),
          },
        },
        {
          provide: 'IPeriodConfigRepository',
          useValue: {
            findActiveForDate: jest.fn(),
          },
        },
        {
          provide: 'IHouseBalanceRepository',
          useValue: {
            getOrCreate: jest.fn(),
          },
        },
        {
          provide: 'IHousePeriodOverrideRepository',
          useValue: {
            getApplicableAmount: jest.fn(),
          },
        },
        {
          provide: 'IHousePeriodChargeRepository',
          useValue: {
            findByHouseAndPeriod: jest.fn(),
          },
        },
        {
          provide: LastTransactionBankRepository,
          useValue: {
            findLatest: jest.fn(),
          },
        },
        {
          provide: GeneratePenaltyUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<CalculateHouseBalanceStatusUseCase>(
      CalculateHouseBalanceStatusUseCase,
    );
    recordAllocationRepository = module.get(
      'IRecordAllocationRepository',
    ) as jest.Mocked<IRecordAllocationRepository>;
    periodRepository = module.get('IPeriodRepository') as jest.Mocked<IPeriodRepository>;
    periodConfigRepository = module.get(
      'IPeriodConfigRepository',
    ) as jest.Mocked<IPeriodConfigRepository>;
    houseBalanceRepository = module.get(
      'IHouseBalanceRepository',
    ) as jest.Mocked<IHouseBalanceRepository>;
    housePeriodOverrideRepository = module.get(
      'IHousePeriodOverrideRepository',
    ) as jest.Mocked<IHousePeriodOverrideRepository>;
    housePeriodChargeRepository = module.get(
      'IHousePeriodChargeRepository',
    ) as jest.Mocked<IHousePeriodChargeRepository>;
    lastTransactionBankRepository = module.get(
      LastTransactionBankRepository,
    ) as jest.Mocked<LastTransactionBankRepository>;
    generatePenaltyUseCase = module.get(
      GeneratePenaltyUseCase,
    ) as jest.Mocked<GeneratePenaltyUseCase>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should return empty balance when no periods exist', async () => {
      periodRepository.findAll.mockResolvedValue([]);

      const result = await useCase.execute(42, mockHouse);

      expect(result.house_id).toBe(42);
      expect(result.house_number).toBe(42);
      expect(result.status).toBe(HouseStatus.AL_DIA);
      expect(result.total_debt).toBe(0);
      expect(result.credit_balance).toBe(0);
      expect(result.unpaid_periods).toEqual([]);
      expect(result.paid_periods).toEqual([]);
      expect(result.upcoming_periods).toEqual([]);
      expect(result.deadline_message).toBe('Sin periodos registrados');
    });

    it('should calculate balance with house_period_charges', async () => {
      const charges = [
        { concept_type: 'MAINTENANCE', expected_amount: 800 },
        { concept_type: 'WATER', expected_amount: 150 },
      ];

      periodRepository.findAll.mockResolvedValue([mockPeriod as any]);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      houseBalanceRepository.getOrCreate.mockResolvedValue(mockHouseBalance as any);
      housePeriodChargeRepository.findByHouseAndPeriod.mockResolvedValue(
        charges as any,
      );
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      lastTransactionBankRepository.findLatest.mockResolvedValue(null);
      generatePenaltyUseCase.execute.mockResolvedValue(null);

      const result = await useCase.execute(42, mockHouse);

      expect(housePeriodChargeRepository.findByHouseAndPeriod).toHaveBeenCalledWith(
        42,
        1,
      );
      expect(result.unpaid_periods).toHaveLength(1);
      expect(result.unpaid_periods[0].expected_total).toBe(950);
      expect(result.unpaid_periods[0].concepts).toHaveLength(2);
    });

    it('should use PeriodConfig fallback when no charges exist', async () => {
      periodRepository.findAll.mockResolvedValue([mockPeriod as any]);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      houseBalanceRepository.getOrCreate.mockResolvedValue(mockHouseBalance as any);
      housePeriodChargeRepository.findByHouseAndPeriod.mockResolvedValue([]);
      housePeriodOverrideRepository.getApplicableAmount.mockResolvedValue(800);
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      lastTransactionBankRepository.findLatest.mockResolvedValue(null);
      generatePenaltyUseCase.execute.mockResolvedValue(null);

      const result = await useCase.execute(42, mockHouse);

      expect(housePeriodOverrideRepository.getApplicableAmount).toHaveBeenCalled();
      expect(result.unpaid_periods[0].expected_total).toBe(800);
      expect(result.unpaid_periods[0].concepts).toHaveLength(1);
      expect(result.unpaid_periods[0].concepts[0].concept_type).toBe('MAINTENANCE');
    });

    it('should determine status as MOROSA when period is overdue', async () => {
      const oldPeriod = {
        id: 1,
        year: 2024,
        month: 1,
        start_date: new Date('2024-01-01'),
        water_active: false,
        extraordinary_fee_active: false,
      };

      const charges = [{ concept_type: 'MAINTENANCE', expected_amount: 800 }];
      const lastTx = {
        transactionBank: { date: new Date('2024-12-31') },
      };

      periodRepository.findAll.mockResolvedValue([oldPeriod as any]);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      houseBalanceRepository.getOrCreate.mockResolvedValue(mockHouseBalance as any);
      housePeriodChargeRepository.findByHouseAndPeriod.mockResolvedValue(
        charges as any,
      );
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      lastTransactionBankRepository.findLatest.mockResolvedValue(lastTx as any);
      generatePenaltyUseCase.execute.mockResolvedValue({ amount: 100 } as any);

      const result = await useCase.execute(42, mockHouse);

      expect(result.status).toBe(HouseStatus.MOROSA);
      expect(result.unpaid_periods[0].is_overdue).toBe(true);
      expect(result.unpaid_periods[0].penalty_amount).toBe(100);
    });

    it('should determine status as AL_DIA when all periods are paid', async () => {
      const charges = [{ concept_type: 'MAINTENANCE', expected_amount: 800 }];
      const allocations = [{ concept_type: 'MAINTENANCE', allocated_amount: 800 }];

      periodRepository.findAll.mockResolvedValue([mockPeriod as any]);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      houseBalanceRepository.getOrCreate.mockResolvedValue(mockHouseBalance as any);
      housePeriodChargeRepository.findByHouseAndPeriod.mockResolvedValue(
        charges as any,
      );
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue(
        allocations as any,
      );
      lastTransactionBankRepository.findLatest.mockResolvedValue(null);

      const result = await useCase.execute(42, mockHouse);

      expect(result.status).toBe(HouseStatus.AL_DIA);
      expect(result.paid_periods).toHaveLength(1);
      expect(result.unpaid_periods).toHaveLength(0);
      expect(result.total_debt).toBe(0);
    });

    it('should determine status as SALDO_A_FAVOR with credit balance', async () => {
      const balanceWithCredit = {
        house_id: 42,
        credit_balance: 500,
        accumulated_cents: 0,
      };

      const charges = [{ concept_type: 'MAINTENANCE', expected_amount: 800 }];
      const allocations = [{ concept_type: 'MAINTENANCE', allocated_amount: 800 }];

      periodRepository.findAll.mockResolvedValue([mockPeriod as any]);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      houseBalanceRepository.getOrCreate.mockResolvedValue(balanceWithCredit as any);
      housePeriodChargeRepository.findByHouseAndPeriod.mockResolvedValue(
        charges as any,
      );
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue(
        allocations as any,
      );
      lastTransactionBankRepository.findLatest.mockResolvedValue(null);

      const result = await useCase.execute(42, mockHouse);

      expect(result.status).toBe(HouseStatus.SALDO_A_FAVOR);
      expect(result.credit_balance).toBe(500);
    });

    it('should separate periods into paid, unpaid, and upcoming correctly', async () => {
      const futurePeriod = {
        id: 2,
        year: 2026,
        month: 12,
        start_date: new Date('2026-12-01'),
        water_active: false,
        extraordinary_fee_active: false,
      };

      const charges = [{ concept_type: 'MAINTENANCE', expected_amount: 800 }];

      periodRepository.findAll.mockResolvedValue([
        mockPeriod as any,
        futurePeriod as any,
      ]);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      houseBalanceRepository.getOrCreate.mockResolvedValue(mockHouseBalance as any);
      housePeriodChargeRepository.findByHouseAndPeriod.mockResolvedValue(
        charges as any,
      );
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      lastTransactionBankRepository.findLatest.mockResolvedValue(null);
      generatePenaltyUseCase.execute.mockResolvedValue(null);

      const result = await useCase.execute(42, mockHouse);

      expect(result.unpaid_periods.length).toBeGreaterThanOrEqual(1);
      expect(result.upcoming_periods).toHaveLength(1);
      expect(result.upcoming_periods[0].year).toBe(2026);
    });

    it('should handle partial payments correctly', async () => {
      const charges = [{ concept_type: 'MAINTENANCE', expected_amount: 800 }];
      const allocations = [{ concept_type: 'MAINTENANCE', allocated_amount: 400 }];

      periodRepository.findAll.mockResolvedValue([mockPeriod as any]);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      houseBalanceRepository.getOrCreate.mockResolvedValue(mockHouseBalance as any);
      housePeriodChargeRepository.findByHouseAndPeriod.mockResolvedValue(
        charges as any,
      );
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue(
        allocations as any,
      );
      lastTransactionBankRepository.findLatest.mockResolvedValue(null);
      generatePenaltyUseCase.execute.mockResolvedValue(null);

      const result = await useCase.execute(42, mockHouse);

      expect(result.unpaid_periods[0].status).toBe(PeriodPaymentStatus.PARTIAL);
      expect(result.unpaid_periods[0].paid_total).toBe(400);
      expect(result.unpaid_periods[0].pending_total).toBe(400);
    });

    it('should calculate summary totals correctly', async () => {
      const period1 = { ...mockPeriod, id: 1, month: 1 };
      const period2 = { ...mockPeriod, id: 2, month: 2 };

      const charges1 = [{ concept_type: 'MAINTENANCE', expected_amount: 800 }];
      const charges2 = [{ concept_type: 'MAINTENANCE', expected_amount: 800 }];
      const allocations1 = [{ concept_type: 'MAINTENANCE', allocated_amount: 800 }];

      periodRepository.findAll.mockResolvedValue([period1, period2] as any);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      houseBalanceRepository.getOrCreate.mockResolvedValue(mockHouseBalance as any);
      housePeriodChargeRepository.findByHouseAndPeriod
        .mockResolvedValueOnce(charges1 as any)
        .mockResolvedValueOnce(charges2 as any);
      recordAllocationRepository.findByHouseAndPeriod
        .mockResolvedValueOnce(allocations1 as any)
        .mockResolvedValueOnce([]);
      lastTransactionBankRepository.findLatest.mockResolvedValue(null);
      generatePenaltyUseCase.execute.mockResolvedValue(null);

      const result = await useCase.execute(42, mockHouse);

      expect(result.summary.total_expected).toBe(1600);
      expect(result.summary.total_paid).toBe(800);
      expect(result.summary.total_pending).toBe(800);
    });

    it('should set bank_coverage_date when last transaction exists', async () => {
      const lastTx = {
        transactionBank: { date: new Date('2025-01-20') },
      };

      const charges = [{ concept_type: 'MAINTENANCE', expected_amount: 800 }];

      periodRepository.findAll.mockResolvedValue([mockPeriod as any]);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      houseBalanceRepository.getOrCreate.mockResolvedValue(mockHouseBalance as any);
      housePeriodChargeRepository.findByHouseAndPeriod.mockResolvedValue(
        charges as any,
      );
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      lastTransactionBankRepository.findLatest.mockResolvedValue(lastTx as any);
      generatePenaltyUseCase.execute.mockResolvedValue(null);

      const result = await useCase.execute(42, mockHouse);

      expect(result.bank_coverage_date).toBe('2025-01-20');
    });

    it('should calculate next_due_date correctly', async () => {
      const charges = [{ concept_type: 'MAINTENANCE', expected_amount: 800 }];
      const allocations = [{ concept_type: 'MAINTENANCE', allocated_amount: 800 }];

      periodRepository.findAll.mockResolvedValue([mockPeriod as any]);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      houseBalanceRepository.getOrCreate.mockResolvedValue(mockHouseBalance as any);
      housePeriodChargeRepository.findByHouseAndPeriod.mockResolvedValue(
        charges as any,
      );
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue(
        allocations as any,
      );
      lastTransactionBankRepository.findLatest.mockResolvedValue(null);

      const result = await useCase.execute(42, mockHouse);

      expect(result.next_due_date).toMatch(/^\d{4}-\d{2}-15$/);
    });

    it('should include water and extraordinary fee when period flags are active', async () => {
      const periodWithExtras = {
        ...mockPeriod,
        water_active: true,
        extraordinary_fee_active: true,
      };

      periodRepository.findAll.mockResolvedValue([periodWithExtras as any]);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      houseBalanceRepository.getOrCreate.mockResolvedValue(mockHouseBalance as any);
      housePeriodChargeRepository.findByHouseAndPeriod.mockResolvedValue([]);
      housePeriodOverrideRepository.getApplicableAmount
        .mockResolvedValueOnce(800)
        .mockResolvedValueOnce(150)
        .mockResolvedValueOnce(200);
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue([]);
      lastTransactionBankRepository.findLatest.mockResolvedValue(null);
      generatePenaltyUseCase.execute.mockResolvedValue(null);

      const result = await useCase.execute(42, mockHouse);

      expect(result.unpaid_periods[0].concepts).toHaveLength(3);
      expect(result.unpaid_periods[0].expected_total).toBe(1150);
    });

    it('should round amounts to 2 decimal places', async () => {
      const charges = [{ concept_type: 'MAINTENANCE', expected_amount: 800.666 }];
      const allocations = [
        { concept_type: 'MAINTENANCE', allocated_amount: 400.333 },
      ];

      periodRepository.findAll.mockResolvedValue([mockPeriod as any]);
      periodConfigRepository.findActiveForDate.mockResolvedValue(
        mockPeriodConfig as any,
      );
      houseBalanceRepository.getOrCreate.mockResolvedValue(mockHouseBalance as any);
      housePeriodChargeRepository.findByHouseAndPeriod.mockResolvedValue(
        charges as any,
      );
      recordAllocationRepository.findByHouseAndPeriod.mockResolvedValue(
        allocations as any,
      );
      lastTransactionBankRepository.findLatest.mockResolvedValue(null);
      generatePenaltyUseCase.execute.mockResolvedValue(null);

      const result = await useCase.execute(42, mockHouse);

      expect(result.unpaid_periods[0].expected_total).toBe(800.67);
      expect(result.unpaid_periods[0].paid_total).toBe(400.33);
    });
  });
});
