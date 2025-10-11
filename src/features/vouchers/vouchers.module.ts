import { Module } from '@nestjs/common';
import { VouchersController } from './controllers/vouchers.controller';
import { VouchersService } from './services/vouchers.service';
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
// Use Cases
import { ProcessVoucherUseCase } from './application/process-voucher.use-case';
import { ConfirmVoucherUseCase } from './application/confirm-voucher.use-case';
import { HandleWhatsAppMessageUseCase } from './application/handle-whatsapp-message.use-case';
import { HandleMissingDataUseCase } from './application/handle-missing-data.use-case';
import { HandleHouseNumberUseCase } from './application/handle-house-number.use-case';
import { CorrectVoucherDataUseCase } from './application/correct-voucher-data.use-case';

@Module({
  imports: [GoogleCloudModule, VertexAIModule, OpenAIModule],
  controllers: [VouchersController],
  providers: [
    // Services
    VouchersService,
    OcrService,
    WhatsAppMessageClassifierService,
    VoucherProcessorService,
    WhatsAppMediaService,
    WhatsAppApiService,
    WhatsAppMessagingService,
    ConversationStateService,
    // Use Cases
    ProcessVoucherUseCase,
    ConfirmVoucherUseCase,
    HandleWhatsAppMessageUseCase,
    HandleMissingDataUseCase,
    HandleHouseNumberUseCase,
    CorrectVoucherDataUseCase,
  ],
  exports: [VouchersService],
})
export class VouchersModule {}
