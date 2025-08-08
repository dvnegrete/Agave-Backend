import { Module } from '@nestjs/common';
import { TransactionsBankController } from './controllers/transactions-bank.controller';
import { TransactionsBankService } from './services/transactions-bank.service';
import { FileProcessorService } from './services/file-processor.service';
import { TransactionValidatorService } from './services/transaction-validator.service';

@Module({
  controllers: [TransactionsBankController],
  providers: [
    TransactionsBankService,
    FileProcessorService,
    TransactionValidatorService,
  ],
  exports: [TransactionsBankService],
})
export class TransactionsBankModule {}
