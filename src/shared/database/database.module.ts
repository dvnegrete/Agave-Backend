import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DatabaseConfigService } from '../config/database.config';
import {
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
} from './entities';
import { TransactionBankRepository } from './repositories/transaction-bank.repository';
import { LastTransactionBankRepository } from './repositories/last-transaction-bank.repository';
import { VoucherRepository } from './repositories/voucher.repository';
import { RecordRepository } from './repositories/record.repository';
import { HouseRepository } from './repositories/house.repository';
import { UserRepository } from './repositories/user.repository';
import { HouseRecordRepository } from './repositories/house-record.repository';

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
    RecordRepository,
    HouseRepository,
    UserRepository,
    HouseRecordRepository,
  ],
  exports: [
    DatabaseConfigService,
    TypeOrmModule,
    TransactionBankRepository,
    LastTransactionBankRepository,
    VoucherRepository,
    RecordRepository,
    HouseRepository,
    UserRepository,
    HouseRecordRepository,
  ],
})
export class DatabaseModule {}
