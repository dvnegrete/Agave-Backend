import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaService } from './prisma.service';
import { DatabaseConfigService } from '../config/database.config';
import { BankTransactionRepository } from './repositories/bank-transaction.repository';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [PrismaService, DatabaseConfigService, BankTransactionRepository],
  exports: [PrismaService, DatabaseConfigService, BankTransactionRepository],
})
export class DatabaseModule {}
