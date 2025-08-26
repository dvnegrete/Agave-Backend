import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { DatabaseConfigService } from '../config/database.config';
import { TransactionBankRepository } from './repositories/transaction-bank.repository';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [PrismaService, DatabaseConfigService, TransactionBankRepository],
  exports: [PrismaService, DatabaseConfigService, TransactionBankRepository],
})
export class DatabaseModule {}
