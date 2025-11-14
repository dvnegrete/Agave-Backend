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
import { TransactionBankRepository } from './repositories/transaction-bank.repository';
import { LastTransactionBankRepository } from './repositories/last-transaction-bank.repository';
import { VoucherRepository } from './repositories/voucher.repository';
import { TransactionStatusRepository } from './repositories/transaction-status.repository';
import { RecordRepository } from './repositories/record.repository';
import { HouseRepository } from './repositories/house.repository';
import { UserRepository } from './repositories/user.repository';
import { HouseRecordRepository } from './repositories/house-record.repository';
import { SystemUserSeed } from './seeds/system-user.seed';

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
    SystemUserSeed, // Auto-crea usuario Sistema al iniciar
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
  ],
})
export class DatabaseModule {}
