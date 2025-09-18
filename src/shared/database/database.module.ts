import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { DatabaseConfigService } from '../config/database.config';
import {
  User,
  House,
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
  ],
  exports: [
    DatabaseConfigService,
    TypeOrmModule,
    TransactionBankRepository,
    LastTransactionBankRepository,
  ],
})
export class DatabaseModule {}
