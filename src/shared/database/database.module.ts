import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DatabaseConfigService } from '../config/database.config';
// Importar entidades directamente desde sus archivos para evitar dependencias circulares
import { User } from './entities/user.entity';
import { House } from './entities/house.entity';
import { HouseRecord } from './entities/house-record.entity';
import { Record } from './entities/record.entity';
import { TransactionBank } from './entities/transaction-bank.entity';
import { Voucher } from './entities/voucher.entity';
import { TransactionStatus } from './entities/transaction-status.entity';
import { LastTransactionBank } from './entities/last-transaction-bank.entity';
import { Period } from './entities/period.entity';
import { CtaExtraordinaryFee } from './entities/cta-extraordinary-fee.entity';
import { CtaMaintenance } from './entities/cta-maintenance.entity';
import { CtaPenalties } from './entities/cta-penalties.entity';
import { CtaWater } from './entities/cta-water.entity';
import { CtaOtherPayments } from './entities/cta-other-payments.entity';
import { PeriodConfig } from './entities/period-config.entity';
import { HouseBalance } from './entities/house-balance.entity';
import { HousePeriodOverride } from './entities/house-period-override.entity';
import { RecordAllocation } from './entities/record-allocation.entity';
import { ManualValidationApproval } from './entities/manual-validation-approval.entity';
import { HouseStatusSnapshot } from './entities/house-status-snapshot.entity';
import { TransactionBankRepository } from './repositories/transaction-bank.repository';
import { LastTransactionBankRepository } from './repositories/last-transaction-bank.repository';
import { VoucherRepository } from './repositories/voucher.repository';
import { TransactionStatusRepository } from './repositories/transaction-status.repository';
import { RecordRepository } from './repositories/record.repository';
import { HouseRepository } from './repositories/house.repository';
import { UserRepository } from './repositories/user.repository';
import { HouseRecordRepository } from './repositories/house-record.repository';
import { CtaMaintenanceRepository } from './repositories/cta-maintenance.repository';
import { CtaWaterRepository } from './repositories/cta-water.repository';
import { CtaPenaltiesRepository } from './repositories/cta-penalties.repository';
import { CtaExtraordinaryFeeRepository } from './repositories/cta-extraordinary-fee.repository';
import { SystemUserSeed } from './seeds/system-user.seed';
import { EnsureHouseExistsService } from './services/ensure-house-exists.service';
import { TransactionalRetryService } from './services/transactional-retry.service';

@Global()
@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (databaseConfigService: DatabaseConfigService) =>
        databaseConfigService.getTypeOrmConfig(),
      inject: [DatabaseConfigService],
    }),
    TypeOrmModule.forFeature([
      User,
      House,
      HouseRecord,
      Record,
      TransactionBank,
      Voucher,
      TransactionStatus,
      LastTransactionBank,
      Period,
      CtaExtraordinaryFee,
      CtaMaintenance,
      CtaPenalties,
      CtaWater,
      CtaOtherPayments,
      PeriodConfig,
      HouseBalance,
      HousePeriodOverride,
      RecordAllocation,
      ManualValidationApproval,
      HouseStatusSnapshot,
    ]),
  ],
  providers: [
    DatabaseConfigService,
    TransactionBankRepository,
    LastTransactionBankRepository,
    VoucherRepository,
    TransactionStatusRepository,
    RecordRepository,
    HouseRepository,
    UserRepository,
    HouseRecordRepository,
    CtaMaintenanceRepository,
    CtaWaterRepository,
    CtaPenaltiesRepository,
    CtaExtraordinaryFeeRepository,
    SystemUserSeed, // Auto-crea usuario Sistema al iniciar
    EnsureHouseExistsService,
    TransactionalRetryService,
  ],
  exports: [
    DatabaseConfigService,
    TypeOrmModule,
    TransactionBankRepository,
    LastTransactionBankRepository,
    VoucherRepository,
    TransactionStatusRepository,
    RecordRepository,
    HouseRepository,
    UserRepository,
    HouseRecordRepository,
    CtaMaintenanceRepository,
    CtaWaterRepository,
    CtaPenaltiesRepository,
    CtaExtraordinaryFeeRepository,
    EnsureHouseExistsService,
    TransactionalRetryService,
  ],
})
export class DatabaseModule {}
