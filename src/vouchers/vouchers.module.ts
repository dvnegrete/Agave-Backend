import { Module } from '@nestjs/common';
import { VouchersController } from './controllers/vouchers.controller';
import { VouchersService } from './services/vouchers.service';
import { FileProcessorService } from './services/file-processor.service';
import { TransactionValidatorService } from './services/transaction-validator.service';

@Module({
  controllers: [VouchersController],
  providers: [
    VouchersService,
    FileProcessorService,
    TransactionValidatorService,
  ],
  exports: [VouchersService],
})
export class VouchersModule {}
