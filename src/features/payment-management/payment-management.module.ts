import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@/shared/auth/auth.module';
import { OpenAIModule } from '@/shared/libs/openai/openai.module';
import { VertexAIModule } from '@/shared/libs/vertex-ai/vertex-ai.module';

// Controllers
import { PaymentManagementController } from './controllers/payment-management.controller';

// Application Layer - Use Cases
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
  GeneratePenaltyUseCase,
  ApplyCreditToPeriodsUseCase,
  DistributePaymentWithAIUseCase,
} from './application';

// Infrastructure - Services
import { PaymentDistributionAnalyzerService } from './infrastructure/matching/payment-distribution-analyzer.service';
import { SeedHousePeriodChargesService } from './infrastructure/services';

// Infrastructure Layer - Repositories
import { PeriodRepository } from './infrastructure/repositories/period.repository';
import { PeriodConfigRepository } from './infrastructure/repositories/period-config.repository';
import { RecordAllocationRepository } from './infrastructure/repositories/record-allocation.repository';
import { HouseBalanceRepository } from './infrastructure/repositories/house-balance.repository';
import { HousePeriodOverrideRepository } from './infrastructure/repositories/house-period-override.repository';
import { HousePeriodChargeRepository } from './infrastructure/repositories/house-period-charge.repository';

// Shared Repositories
import { TransactionBankRepository } from '@/shared/database/repositories/transaction-bank.repository';
import { HouseRepository } from '@/shared/database/repositories/house.repository';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';

// Entities
import {
  Period,
  PeriodConfig,
  HouseBalance,
  HousePeriodOverride,
  HousePeriodCharge,
  RecordAllocation,
  House,
  TransactionBank,
  Voucher,
  CtaPenalties,
} from '@/shared/database/entities';

@Module({
  imports: [
    AuthModule,
    OpenAIModule,
    VertexAIModule,
    TypeOrmModule.forFeature([
      Period,
      PeriodConfig,
      HouseBalance,
      HousePeriodOverride,
      HousePeriodCharge,
      RecordAllocation,
      House,
      TransactionBank,
      Voucher,
      CtaPenalties,
    ]),
  ],
  controllers: [PaymentManagementController],
  providers: [
    // Use Cases
    CreatePeriodUseCase,
    EnsurePeriodExistsUseCase,
    GetPeriodsUseCase,
    CreatePeriodConfigUseCase,
    UpdatePeriodConfigUseCase,
    CalculateHouseBalanceStatusUseCase,
    UpdatePeriodConceptsUseCase,
    GeneratePenaltyUseCase,
    ApplyCreditToPeriodsUseCase,
    DistributePaymentWithAIUseCase,
    AllocatePaymentUseCase,
    GetPaymentHistoryUseCase,
    GetHouseBalanceUseCase,
    GetHouseTransactionsUseCase,
    GetHouseUnreconciledVouchersUseCase,

    // Services
    PaymentDistributionAnalyzerService,
    SeedHousePeriodChargesService,

    // Repositories - Provide with interface tokens
    {
      provide: 'IPeriodRepository',
      useClass: PeriodRepository,
    },
    {
      provide: 'IPeriodConfigRepository',
      useClass: PeriodConfigRepository,
    },
    {
      provide: 'IRecordAllocationRepository',
      useClass: RecordAllocationRepository,
    },
    {
      provide: 'IHouseBalanceRepository',
      useClass: HouseBalanceRepository,
    },
    {
      provide: 'IHousePeriodOverrideRepository',
      useClass: HousePeriodOverrideRepository,
    },
    {
      provide: 'IHousePeriodChargeRepository',
      useClass: HousePeriodChargeRepository,
    },
    // Also provide as regular classes for DI
    PeriodRepository,
    PeriodConfigRepository,
    RecordAllocationRepository,
    HouseBalanceRepository,
    HousePeriodOverrideRepository,
    HousePeriodChargeRepository,
    TransactionBankRepository,
    HouseRepository,
    VoucherRepository,
  ],
  exports: [
    EnsurePeriodExistsUseCase, // Exportado para uso en conciliación bancaria
    AllocatePaymentUseCase, // Exportado para integración con reconciliación
    PeriodRepository,
    PeriodConfigRepository,
    RecordAllocationRepository,
    HouseBalanceRepository,
    HousePeriodOverrideRepository,
    HousePeriodChargeRepository,
  ],
})
export class PaymentManagementModule {}
