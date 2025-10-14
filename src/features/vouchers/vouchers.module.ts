import { Module } from '@nestjs/common';
import { VouchersController } from './controllers/vouchers.controller';
// Infrastructure - Persistence
import { VouchersService } from './infrastructure/persistence/vouchers.service';
import { ConversationStateService } from './infrastructure/persistence/conversation-state.service';
// Infrastructure - OCR
import { OcrService } from './infrastructure/ocr/ocr.service';
import { VoucherProcessorService } from './infrastructure/ocr/voucher-processor.service';
// Infrastructure - WhatsApp
import { WhatsAppMessageClassifierService } from './infrastructure/whatsapp/whatsapp-message-classifier.service';
import { WhatsAppMediaService } from './infrastructure/whatsapp/whatsapp-media.service';
import { WhatsAppApiService } from './infrastructure/whatsapp/whatsapp-api.service';
import { WhatsAppMessagingService } from './infrastructure/whatsapp/whatsapp-messaging.service';
// External Modules
import { GoogleCloudModule } from '@/shared/libs/google-cloud';
import { VertexAIModule } from '@/shared/libs/vertex-ai/vertex-ai.module';
import { OpenAIModule } from '@/shared/libs/openai/openai.module';
// Use Cases
import { ProcessVoucherUseCase } from './application/process-voucher.use-case';
import { ConfirmVoucherUseCase } from './application/confirm-voucher.use-case';
import { HandleWhatsAppMessageUseCase } from './application/handle-whatsapp-message.use-case';
import { HandleWhatsAppWebhookUseCase } from './application/handle-whatsapp-webhook.use-case';
import { HandleMissingDataUseCase } from './application/handle-missing-data.use-case';
import { HandleHouseNumberUseCase } from './application/handle-house-number.use-case';
import { CorrectVoucherDataUseCase } from './application/correct-voucher-data.use-case';

@Module({
  imports: [GoogleCloudModule, VertexAIModule, OpenAIModule],
  controllers: [VouchersController],
  providers: [
    // Infrastructure - Persistence
    VouchersService,
    ConversationStateService,
    // Infrastructure - OCR
    OcrService,
    VoucherProcessorService,
    // Infrastructure - WhatsApp
    WhatsAppMessageClassifierService,
    WhatsAppMediaService,
    WhatsAppApiService,
    WhatsAppMessagingService,
    // Use Cases
    ProcessVoucherUseCase,
    ConfirmVoucherUseCase,
    HandleWhatsAppMessageUseCase,
    HandleWhatsAppWebhookUseCase,
    HandleMissingDataUseCase,
    HandleHouseNumberUseCase,
    CorrectVoucherDataUseCase,
  ],
  exports: [VouchersService],
})
export class VouchersModule {}
