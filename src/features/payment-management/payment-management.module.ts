import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Controllers
import { PaymentManagementController } from './controllers/payment-management.controller';

// Application Layer - Use Cases
import {
  CreatePeriodUseCase,
  EnsurePeriodExistsUseCase,
  GetPeriodsUseCase,
  CreatePeriodConfigUseCase,
  AllocatePaymentUseCase,
  GetPaymentHistoryUseCase,
  GetHouseBalanceUseCase,
} from './application';

// Infrastructure Layer - Repositories
import { PeriodRepository } from './infrastructure/repositories/period.repository';
import { PeriodConfigRepository } from './infrastructure/repositories/period-config.repository';
import { RecordAllocationRepository } from './infrastructure/repositories/record-allocation.repository';
import { HouseBalanceRepository } from './infrastructure/repositories/house-balance.repository';
import { HousePeriodOverrideRepository } from './infrastructure/repositories/house-period-override.repository';

// Entities
import {
  Period,
  PeriodConfig,
  HouseBalance,
  HousePeriodOverride,
  RecordAllocation,
  House,
} from '@/shared/database/entities';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Period,
      PeriodConfig,
      HouseBalance,
      HousePeriodOverride,
      RecordAllocation,
      House,
    ]),
  ],
  controllers: [PaymentManagementController],
  providers: [
    // Use Cases
    CreatePeriodUseCase,
    EnsurePeriodExistsUseCase,
    GetPeriodsUseCase,
    CreatePeriodConfigUseCase,
    AllocatePaymentUseCase,
    GetPaymentHistoryUseCase,
    GetHouseBalanceUseCase,

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
    // Also provide as regular classes for DI
    PeriodRepository,
    PeriodConfigRepository,
    RecordAllocationRepository,
    HouseBalanceRepository,
    HousePeriodOverrideRepository,
  ],
  exports: [
    EnsurePeriodExistsUseCase, // Exportado para uso en conciliación bancaria
    AllocatePaymentUseCase, // Exportado para integración con reconciliación
    PeriodRepository,
    PeriodConfigRepository,
    RecordAllocationRepository,
    HouseBalanceRepository,
    HousePeriodOverrideRepository,
  ],
})
export class PaymentManagementModule {}
