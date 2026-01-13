import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@/shared/auth/auth.module';

// Controllers
import { HistoricalRecordsController } from './controllers/historical-records.controller';

// Application Layer - Use Cases
import { UploadHistoricalRecordsUseCase } from './application';

// Infrastructure Layer - Services
import { HistoricalExcelParserService } from './infrastructure/parsers/historical-excel-parser.service';
import { HistoricalRowProcessorService } from './infrastructure/processors/historical-row-processor.service';
import { CtaRecordCreatorService } from './infrastructure/processors/cta-record-creator.service';

// Shared Repositories (Database)
import {
  RecordRepository,
  HouseRecordRepository,
  HouseRepository,
  CtaMaintenanceRepository,
  CtaWaterRepository,
  CtaPenaltiesRepository,
  CtaExtraordinaryFeeRepository,
  TransactionBankRepository,
  TransactionStatusRepository,
} from '@/shared/database/repositories';

// Shared Entities
import {
  Record,
  HouseRecord,
  House,
  Period,
  CtaMaintenance,
  CtaWater,
  CtaPenalties,
  CtaExtraordinaryFee,
  TransactionBank,
  TransactionStatus,
} from '@/shared/database/entities';

// External Feature Modules
import { PaymentManagementModule } from '@/features/payment-management/payment-management.module';

/**
 * Historical Records Module
 * Handles loading and processing of historical accounting records from Excel files
 */
@Module({
  imports: [
    AuthModule,
    // Register TypeORM entities
    TypeOrmModule.forFeature([
      Record,
      HouseRecord,
      House,
      Period,
      CtaMaintenance,
      CtaWater,
      CtaPenalties,
      CtaExtraordinaryFee,
      TransactionBank,
      TransactionStatus,
    ]),
    // Import PaymentManagement for EnsurePeriodExistsUseCase
    PaymentManagementModule,
  ],
  controllers: [HistoricalRecordsController],
  providers: [
    // Application Layer - Use Cases
    UploadHistoricalRecordsUseCase,

    // Infrastructure Layer - Services
    HistoricalExcelParserService,
    HistoricalRowProcessorService,
    CtaRecordCreatorService,

    // Repositories
    RecordRepository,
    HouseRecordRepository,
    HouseRepository,
    CtaMaintenanceRepository,
    CtaWaterRepository,
    CtaPenaltiesRepository,
    CtaExtraordinaryFeeRepository,
    TransactionBankRepository,
    TransactionStatusRepository,
  ],
  exports: [UploadHistoricalRecordsUseCase],
})
export class HistoricalRecordsModule {}
