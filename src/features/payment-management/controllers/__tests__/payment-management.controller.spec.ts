import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { PaymentManagementController } from '../payment-management.controller';
import {
  CreatePeriodUseCase,
  EnsurePeriodExistsUseCase,
  GetPeriodsUseCase,
  CreatePeriodConfigUseCase,
  UpdatePeriodConfigUseCase,
  AllocatePaymentUseCase,
  GetPaymentHistoryUseCase,
  GetHouseBalanceUseCase,
  GetHouseTransactionsUseCase,
  GetHouseUnreconciledVouchersUseCase,
  CalculateHouseBalanceStatusUseCase,
  UpdatePeriodConceptsUseCase,
  DistributePaymentWithAIUseCase,
  BackfillAllocationsUseCase,
  GetPeriodChargesSummaryUseCase,
  BatchUpdatePeriodChargesUseCase,
  ReprocessAllAllocationsUseCase,
  CondonePenaltyUseCase,
  AdjustHousePeriodChargeUseCase,
  ReverseHousePeriodChargeUseCase,
  ApplyCreditToPeriodsUseCase,
} from '../../application';
import {
  CreatePeriodDto,
  CreatePeriodConfigDto,
  UpdatePeriodConfigDto,
  PeriodResponseDto,
  PeriodConfigResponseDto,
  HouseBalanceDTO,
  HouseTransactionsResponseDto,
  EnrichedHouseBalanceDto,
} from '../../dto';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { IPeriodConfigRepository } from '../../interfaces';
import { HouseStatusSnapshotService } from '../../infrastructure/services/house-status-snapshot.service';
import { HouseBalanceRepository } from '../../infrastructure/repositories/house-balance.repository';
import { Period, House } from '@/shared/database/entities';

describe('PaymentManagementController', () => {
  let controller: PaymentManagementController;
  let createPeriodUseCase: jest.Mocked<CreatePeriodUseCase>;
  let ensurePeriodExistsUseCase: jest.Mocked<EnsurePeriodExistsUseCase>;
  let getPeriodsUseCase: jest.Mocked<GetPeriodsUseCase>;
  let createPeriodConfigUseCase: jest.Mocked<CreatePeriodConfigUseCase>;
  let updatePeriodConfigUseCase: jest.Mocked<UpdatePeriodConfigUseCase>;
  let allocatePaymentUseCase: jest.Mocked<AllocatePaymentUseCase>;
  let getPaymentHistoryUseCase: jest.Mocked<GetPaymentHistoryUseCase>;
  let getHouseBalanceUseCase: jest.Mocked<GetHouseBalanceUseCase>;
  let getHouseTransactionsUseCase: jest.Mocked<GetHouseTransactionsUseCase>;
  let getHouseUnreconciledVouchersUseCase: jest.Mocked<GetHouseUnreconciledVouchersUseCase>;
  let houseRepository: jest.Mocked<HouseRepository>;
  let periodConfigRepository: jest.Mocked<IPeriodConfigRepository>;
  let calculateHouseBalanceStatusUseCase: jest.Mocked<CalculateHouseBalanceStatusUseCase>;
  let snapshotService: jest.Mocked<HouseStatusSnapshotService>;
  let updatePeriodConceptsUseCase: jest.Mocked<UpdatePeriodConceptsUseCase>;
  let distributePaymentWithAIUseCase: jest.Mocked<DistributePaymentWithAIUseCase>;
  let backfillAllocationsUseCase: jest.Mocked<BackfillAllocationsUseCase>;
  let getPeriodChargesSummaryUseCase: jest.Mocked<GetPeriodChargesSummaryUseCase>;
  let batchUpdatePeriodChargesUseCase: jest.Mocked<BatchUpdatePeriodChargesUseCase>;
  let reprocessAllAllocationsUseCase: jest.Mocked<ReprocessAllAllocationsUseCase>;
  let condonePenaltyUseCase: jest.Mocked<CondonePenaltyUseCase>;
  let adjustHousePeriodChargeUseCase: jest.Mocked<AdjustHousePeriodChargeUseCase>;
  let reverseHousePeriodChargeUseCase: jest.Mocked<ReverseHousePeriodChargeUseCase>;
  let applyCreditToPeriodsUseCase: jest.Mocked<ApplyCreditToPeriodsUseCase>;
  let houseBalanceRepository: jest.Mocked<HouseBalanceRepository>;

  const mockPeriod = (id: number, year: number, month: number): Period => ({
    id,
    year,
    month,
    startDate: new Date(year, month - 1, 1),
    endDate: new Date(year, month, 0),
    periodConfigId: 1,
    getDisplayName: () => `${['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][month - 1]} ${year}`,
  } as Period);

  const mockHouse = {
    id: 1,
    number_house: 101,
    user_id: 'user-uuid',
    user: null,
    created_at: new Date(),
    updated_at: new Date(),
  } as House;

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
      controllers: [PaymentManagementController],
      providers: [
        {
          provide: CreatePeriodUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: EnsurePeriodExistsUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: GetPeriodsUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: CreatePeriodConfigUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: UpdatePeriodConfigUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: AllocatePaymentUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: GetPaymentHistoryUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: GetHouseBalanceUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: GetHouseTransactionsUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: GetHouseUnreconciledVouchersUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: HouseRepository,
          useValue: { findByNumberHouse: jest.fn() },
        },
        {
          provide: 'IPeriodConfigRepository',
          useValue: { findAll: jest.fn(), findActiveForDate: jest.fn() },
        },
        {
          provide: CalculateHouseBalanceStatusUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: HouseStatusSnapshotService,
          useValue: { getOrCalculate: jest.fn(), getAllForSummary: jest.fn() },
        },
        {
          provide: UpdatePeriodConceptsUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: DistributePaymentWithAIUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: BackfillAllocationsUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: GetPeriodChargesSummaryUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: BatchUpdatePeriodChargesUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: ReprocessAllAllocationsUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: CondonePenaltyUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: AdjustHousePeriodChargeUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: ReverseHousePeriodChargeUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: ApplyCreditToPeriodsUseCase,
          useValue: { execute: jest.fn() },
        },
        {
          provide: HouseBalanceRepository,
          useValue: { getOrCreate: jest.fn() },
        },
      ],
    }).compile();

    controller = module.get<PaymentManagementController>(
      PaymentManagementController,
    );
    createPeriodUseCase = module.get(CreatePeriodUseCase);
    ensurePeriodExistsUseCase = module.get(EnsurePeriodExistsUseCase);
    getPeriodsUseCase = module.get(GetPeriodsUseCase);
    createPeriodConfigUseCase = module.get(CreatePeriodConfigUseCase);
    updatePeriodConfigUseCase = module.get(UpdatePeriodConfigUseCase);
    allocatePaymentUseCase = module.get(AllocatePaymentUseCase);
    getPaymentHistoryUseCase = module.get(GetPaymentHistoryUseCase);
    getHouseBalanceUseCase = module.get(GetHouseBalanceUseCase);
    getHouseTransactionsUseCase = module.get(GetHouseTransactionsUseCase);
    getHouseUnreconciledVouchersUseCase = module.get(
      GetHouseUnreconciledVouchersUseCase,
    );
    houseRepository = module.get(HouseRepository);
    periodConfigRepository = module.get('IPeriodConfigRepository');
    calculateHouseBalanceStatusUseCase = module.get(
      CalculateHouseBalanceStatusUseCase,
    );
    snapshotService = module.get(HouseStatusSnapshotService);
    updatePeriodConceptsUseCase = module.get(UpdatePeriodConceptsUseCase);
    distributePaymentWithAIUseCase = module.get(DistributePaymentWithAIUseCase);
    backfillAllocationsUseCase = module.get(BackfillAllocationsUseCase);
    getPeriodChargesSummaryUseCase = module.get(GetPeriodChargesSummaryUseCase);
    batchUpdatePeriodChargesUseCase = module.get(
      BatchUpdatePeriodChargesUseCase,
    );
    reprocessAllAllocationsUseCase = module.get(
      ReprocessAllAllocationsUseCase,
    );
    condonePenaltyUseCase = module.get(CondonePenaltyUseCase);
    adjustHousePeriodChargeUseCase = module.get(AdjustHousePeriodChargeUseCase);
    reverseHousePeriodChargeUseCase = module.get(
      ReverseHousePeriodChargeUseCase,
    );
    applyCreditToPeriodsUseCase = module.get(ApplyCreditToPeriodsUseCase);
    houseBalanceRepository = module.get(HouseBalanceRepository);
  });

  describe('getPeriods', () => {
    it('should return list of periods', async () => {
      const periods = [
        mockPeriod(1, 2026, 1),
        mockPeriod(2, 2026, 2),
      ];
      getPeriodsUseCase.execute.mockResolvedValue(periods);

      const result = await controller.getPeriods();

      expect(result).toHaveLength(2);
      expect(result[0].year).toBe(2026);
      expect(result[0].month).toBe(1);
      expect(getPeriodsUseCase.execute).toHaveBeenCalled();
    });

    it('should return empty list when no periods exist', async () => {
      getPeriodsUseCase.execute.mockResolvedValue([]);

      const result = await controller.getPeriods();

      expect(result).toEqual([]);
    });
  });

  describe('createPeriod', () => {
    it('should create new period successfully', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 3 };
      const period = mockPeriod(3, 2026, 3);
      createPeriodUseCase.execute.mockResolvedValue(period);

      const result = await controller.createPeriod(dto);

      expect(result).toBeDefined();
      expect(result.year).toBe(2026);
      expect(result.month).toBe(3);
      expect(createPeriodUseCase.execute).toHaveBeenCalledWith(dto);
    });

    it('should handle period already exists error', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 1 };
      createPeriodUseCase.execute.mockRejectedValue(
        new Error('Período ya existe'),
      );

      await expect(controller.createPeriod(dto)).rejects.toThrow(
        'Período ya existe',
      );
    });

    it('should handle invalid period data', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 13 }; // Invalid month
      createPeriodUseCase.execute.mockRejectedValue(
        new Error('Mes inválido'),
      );

      await expect(controller.createPeriod(dto)).rejects.toThrow();
    });
  });

  describe('ensurePeriod', () => {
    it('should ensure period exists', async () => {
      const dto: CreatePeriodDto = { year: 2026, month: 2 };
      const period = mockPeriod(2, 2026, 2);
      ensurePeriodExistsUseCase.execute.mockResolvedValue(period);

      const result = await controller.ensurePeriod(dto);

      expect(result).toBeDefined();
      expect(result.year).toBe(2026);
      expect(ensurePeriodExistsUseCase.execute).toHaveBeenCalledWith(
        2026,
        2,
      );
    });
  });

  describe('createConfig', () => {
    it('should create new period config', async () => {
      const dto: CreatePeriodConfigDto = {
        default_maintenance_amount: 800,
        default_water_amount: 100,
        payment_due_day: 15,
        late_payment_penalty_amount: 50,
        effective_from: new Date(),
      };

      createPeriodConfigUseCase.execute.mockResolvedValue(mockPeriodConfig as any);

      const result = await controller.createConfig(dto);

      expect(result).toBeDefined();
      expect(result.default_maintenance_amount).toBe(800);
      expect(result.payment_due_day).toBe(15);
      expect(createPeriodConfigUseCase.execute).toHaveBeenCalledWith(dto);
    });
  });

  describe('getConfigs', () => {
    it('should return all configs', async () => {
      periodConfigRepository.findAll.mockResolvedValue([mockPeriodConfig as any]);

      const result = await controller.getConfigs();

      expect(result).toHaveLength(1);
      expect(result[0].default_maintenance_amount).toBe(800);
      expect(periodConfigRepository.findAll).toHaveBeenCalled();
    });

    it('should return empty list when no configs exist', async () => {
      periodConfigRepository.findAll.mockResolvedValue([]);

      const result = await controller.getConfigs();

      expect(result).toEqual([]);
    });
  });

  describe('getActiveConfig', () => {
    it('should return active config for given date', async () => {
      periodConfigRepository.findActiveForDate.mockResolvedValue(mockPeriodConfig as any);

      const result = await controller.getActiveConfig('2026-02-14');

      expect(result).toBeDefined();
      expect(result.is_active).toBe(true);
      expect(periodConfigRepository.findActiveForDate).toHaveBeenCalled();
    });

    it('should throw NotFoundException when no active config', async () => {
      periodConfigRepository.findActiveForDate.mockResolvedValue(null);

      await expect(
        controller.getActiveConfig('2026-02-14'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateConfig', () => {
    it('should update period config', async () => {
      const dto: UpdatePeriodConfigDto = {
        default_maintenance_amount: 900,
      };

      updatePeriodConfigUseCase.execute.mockResolvedValue({
        ...mockPeriodConfig,
        default_maintenance_amount: 900,
      } as any);

      const result = await controller.updateConfig(1, dto);

      expect(result.default_maintenance_amount).toBe(900);
      expect(updatePeriodConfigUseCase.execute).toHaveBeenCalledWith(1, dto);
    });
  });

  describe('getPaymentHistory', () => {
    it('should return payment history for house', async () => {
      const houseId = 101;
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse);

      const mockTransactions = {
        house_id: 1,
        house_number: houseId,
        total_transactions: 5,
        total_amount: 5000,
        confirmed_transactions: 3,
        pending_transactions: 2,
        transactions: [],
      };

      getHouseTransactionsUseCase.execute.mockResolvedValue(mockTransactions);

      const result = await controller.getPaymentHistory(houseId);

      expect(result).toBeDefined();
      expect(result.house_number).toBe(houseId);
      expect(houseRepository.findByNumberHouse).toHaveBeenCalledWith(houseId);
    });

    it('should throw NotFoundException when house does not exist', async () => {
      houseRepository.findByNumberHouse.mockResolvedValue(null);

      await expect(controller.getPaymentHistory(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getHouseBalance', () => {
    it('should return house balance', async () => {
      const houseId = 101;
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse);

      const mockBalance = {
        house_id: 1,
        house_number: houseId,
        accumulated_cents: 50,
        credit_balance: 1000,
        debit_balance: 0,
        net_balance: 1000,
        status: 'credited',
        updated_at: new Date().toISOString(),
      };

      getHouseBalanceUseCase.execute.mockResolvedValue(mockBalance);

      const result = await controller.getHouseBalance(houseId);

      expect(result).toBeDefined();
      expect(result.house_number).toBe(houseId);
      expect(result.credit_balance).toBe(1000);
    });

    it('should throw NotFoundException when house does not exist', async () => {
      houseRepository.findByNumberHouse.mockResolvedValue(null);

      await expect(controller.getHouseBalance(999)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getHouseSummary', () => {
    it('should return house status summary', async () => {
      const houses = [mockHouse];
      houseRepository.findAll.mockResolvedValue(houses);

      const mockSummary = {
        total_houses: 66,
        by_status: {
          morosa: 5,
          al_dia: 40,
          saldo_a_favor: 21,
        },
        summary: [
          {
            house_id: 1,
            house_number: 101,
            status: 'al_dia',
            total_debt: 0,
            credit_balance: 1000,
            accumulated_cents: 50,
          },
        ],
      };

      snapshotService.getAllForSummary.mockResolvedValue(mockSummary as any);

      const result = await controller.getHouseSummary();

      expect(result).toBeDefined();
      expect(result.total_houses).toBe(66);
      expect(snapshotService.getAllForSummary).toHaveBeenCalled();
    });
  });

  describe('getHouseStatus', () => {
    it('should return enriched house balance status', async () => {
      const houseId = 101;
      houseRepository.findByNumberHouse.mockResolvedValue(mockHouse);

      const mockStatus = {
        house_id: 1,
        house_number: houseId,
        status: 'al_dia',
        total_debt: 0,
        credit_balance: 1000,
        accumulated_cents: 50,
        unpaid_periods: [],
        paid_periods: [],
        upcoming_periods: [],
        current_period: null,
        next_due_date: '2026-03-15',
        deadline_message: 'Al día',
        bank_coverage_date: '2026-02-14',
        total_unpaid_periods: 0,
        summary: {
          total_expected: 800,
          total_paid: 800,
          total_pending: 0,
          total_penalties: 0,
        },
      };

      snapshotService.getOrCalculate.mockResolvedValue(mockStatus as any);

      const result = await controller.getHouseStatus(houseId);

      expect(result).toBeDefined();
      expect(result.house_number).toBe(houseId);
      expect(result.status).toBe('al_dia');
      expect(result.bank_coverage_date).toBe('2026-02-14');
    });
  });

  describe('Error Handling', () => {
    it('should handle repository errors gracefully', async () => {
      houseRepository.findByNumberHouse.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(controller.getPaymentHistory(101)).rejects.toThrow(
        'Database error',
      );
    });

    it('should handle use case errors gracefully', async () => {
      getPeriodsUseCase.execute.mockRejectedValue(
        new Error('Business logic error'),
      );

      await expect(controller.getPeriods()).rejects.toThrow(
        'Business logic error',
      );
    });
  });
});
