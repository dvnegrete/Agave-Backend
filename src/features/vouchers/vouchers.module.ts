import { Module } from '@nestjs/common';
import { VouchersController } from './controllers/vouchers.controller';
import { VouchersService } from './services/vouchers.service';
import { FileProcessorService } from './services/file-processor.service';
import { TransactionValidatorService } from './services/transaction-validator.service';
import { OcrService } from './services/ocr.service';
import { WhatsAppMessageClassifierService } from './services/whatsapp-message-classifier.service';
import { VoucherProcessorService } from './services/voucher-processor.service';
import { WhatsAppMediaService } from './services/whatsapp-media.service';
import { WhatsAppApiService } from './services/whatsapp-api.service';
import { WhatsAppMessagingService } from './services/whatsapp-messaging.service';
import { ConversationStateService } from './services/conversation-state.service';
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
    VoucherProcessorService,
    WhatsAppMediaService,
    WhatsAppApiService,
    WhatsAppMessagingService,
    ConversationStateService,
  ],
  exports: [VouchersService],
})
export class VouchersModule {}
