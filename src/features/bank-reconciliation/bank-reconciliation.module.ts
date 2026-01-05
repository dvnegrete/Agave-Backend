import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

// Controllers
import { BankReconciliationController } from './controllers/bank-reconciliation.controller';

// Application Layer - Use Cases
import { ReconcileUseCase } from './application/reconcile.use-case';

// Infrastructure Layer - Services
import { MatchingService } from './infrastructure/matching/matching.service';
import { ConceptHouseExtractorService } from './infrastructure/matching/concept-house-extractor.service';
import { ConceptAnalyzerService } from './infrastructure/matching/concept-analyzer.service';
import { ReconciliationPersistenceService } from './infrastructure/persistence/reconciliation-persistence.service';
import { ReconciliationDataService } from './infrastructure/persistence/reconciliation-data.service';
import { ManualValidationService } from './infrastructure/persistence/manual-validation.service';
import { UnclaimedDepositsService } from './infrastructure/persistence/unclaimed-deposits.service';

// Entities
import { TransactionBank } from '@/shared/database/entities/transaction-bank.entity';
import { Voucher } from '@/shared/database/entities/voucher.entity';
import { TransactionStatus } from '@/shared/database/entities/transaction-status.entity';
import { Record } from '@/shared/database/entities/record.entity';
import { HouseRecord } from '@/shared/database/entities/house-record.entity';
import { House } from '@/shared/database/entities/house.entity';

// Repositories
import { TransactionBankRepository } from '@/shared/database/repositories/transaction-bank.repository';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { TransactionStatusRepository } from '@/shared/database/repositories/transaction-status.repository';
import { RecordRepository } from '@/shared/database/repositories/record.repository';
import { HouseRecordRepository } from '@/shared/database/repositories/house-record.repository';
import { HouseRepository } from '@/shared/database/repositories/house.repository';

// External modules for AI services
import { OpenAIModule } from '@/shared/libs/openai/openai.module';
import { VertexAIModule } from '@/shared/libs/vertex-ai/vertex-ai.module';

// Payment Management Module for payment allocation
import { PaymentManagementModule } from '@/features/payment-management/payment-management.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TransactionBank,
      Voucher,
      TransactionStatus,
      Record,
      HouseRecord,
      House,
    ]),
    OpenAIModule,
    VertexAIModule,
    PaymentManagementModule,
  ],
  controllers: [BankReconciliationController],
  providers: [
    // Application Layer
    ReconcileUseCase,

    // Infrastructure Layer - Services
    MatchingService,
    ConceptHouseExtractorService,
    ConceptAnalyzerService,
    ReconciliationPersistenceService,
    ReconciliationDataService,
    ManualValidationService,
    UnclaimedDepositsService,

    // Repositories
    TransactionBankRepository,
    VoucherRepository,
    TransactionStatusRepository,
    RecordRepository,
    HouseRecordRepository,
    HouseRepository,
  ],
  exports: [ReconcileUseCase],
})
export class BankReconciliationModule {}
