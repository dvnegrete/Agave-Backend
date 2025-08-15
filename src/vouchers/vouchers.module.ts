import { Module } from '@nestjs/common';
import { VouchersController } from './controllers/vouchers.controller';
import { VouchersService } from './services/vouchers.service';
import { FileProcessorService } from './services/file-processor.service';
import { TransactionValidatorService } from './services/transaction-validator.service';
import { OcrService } from './services/ocr.service';
import { GoogleCloudModule } from '../libs/google-cloud';

@Module({
  imports: [GoogleCloudModule],
  controllers: [VouchersController],
  providers: [
    VouchersService,
    FileProcessorService,
    TransactionValidatorService,
    OcrService,
  ],
  exports: [VouchersService],
})
export class VouchersModule {}
