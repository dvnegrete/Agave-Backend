import { Module } from '@nestjs/common';
import { VouchersController } from './controllers/vouchers.controller';
import { VouchersService } from './services/vouchers.service';
import { FileProcessorService } from './services/file-processor.service';
import { TransactionValidatorService } from './services/transaction-validator.service';
import { OcrService } from './services/ocr.service';
import { WhatsAppMessageClassifierService } from './services/whatsapp-message-classifier.service';
import { GoogleCloudModule } from '@/shared/libs/google-cloud';
import { VertexAIModule } from '@/shared/libs/vertex-ai/vertex-ai.module';
import { OpenAIModule } from '@/shared/libs/openai/openai.module';

@Module({
  imports: [GoogleCloudModule, VertexAIModule, OpenAIModule],
  controllers: [VouchersController],
  providers: [
    VouchersService,
    FileProcessorService,
    TransactionValidatorService,
    OcrService,
    WhatsAppMessageClassifierService,
  ],
  exports: [VouchersService],
})
export class VouchersModule {}
