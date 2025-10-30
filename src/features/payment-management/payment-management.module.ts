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
} from './application';

// Infrastructure Layer - Repositories
import { PeriodRepository } from './infrastructure/repositories/period.repository';
import { PeriodConfigRepository } from './infrastructure/repositories/period-config.repository';

// Entities
import {
  Period,
  PeriodConfig,
  HouseBalance,
  HousePeriodOverride,
  RecordAllocation,
} from '@/shared/database/entities';

// Interfaces - Provide implementations
import { IPeriodRepository, IPeriodConfigRepository} from './interfaces';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Period,
      PeriodConfig,
      HouseBalance,
      HousePeriodOverride,
      RecordAllocation,
    ]),
  ],
  controllers: [PaymentManagementController],
  providers: [
    // Use Cases
    CreatePeriodUseCase,
    EnsurePeriodExistsUseCase,
    GetPeriodsUseCase,
    CreatePeriodConfigUseCase,

    // Repositories - Provide with interface tokens
    {
      provide: 'IPeriodRepository',
      useClass: PeriodRepository,
    },
    {
      provide: 'IPeriodConfigRepository',
      useClass: PeriodConfigRepository,
    },
    // Also provide as regular classes for DI
    PeriodRepository,
    PeriodConfigRepository,
  ],
  exports: [
    EnsurePeriodExistsUseCase, // Exportado para uso en conciliación bancaria
    PeriodRepository,
    PeriodConfigRepository,
  ],
})
export class PaymentManagementModule {}
