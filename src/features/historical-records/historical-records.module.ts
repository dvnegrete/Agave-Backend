import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

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
} from '@/shared/database/entities';

// External Feature Modules
import { PaymentManagementModule } from '@/features/payment-management/payment-management.module';

/**
 * Historical Records Module
 * Handles loading and processing of historical accounting records from Excel files
 */
@Module({
  imports: [
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
  ],
  exports: [UploadHistoricalRecordsUseCase],
})
export class HistoricalRecordsModule {}
