import { Module } from '@nestjs/common';
import { VouchersController } from './controllers/vouchers.controller';
import { VouchersFrontendController } from './controllers/vouchers-frontend.controller';
// Infrastructure - Persistence
import { VouchersService } from './infrastructure/persistence/vouchers.service';
import { ConversationStateService } from './infrastructure/persistence/conversation-state.service';
import { VoucherDuplicateDetectorService } from './infrastructure/persistence/voucher-duplicate-detector.service';
import { VoucherGarbageCollectorService } from './infrastructure/persistence/voucher-garbage-collector.service';
// Infrastructure - OCR
import { OcrService } from './infrastructure/ocr/ocr.service';
import { VoucherProcessorService } from './infrastructure/ocr/voucher-processor.service';
// Infrastructure - WhatsApp
import { WhatsAppMessageClassifierService } from './infrastructure/whatsapp/whatsapp-message-classifier.service';
import { WhatsAppMediaService } from './infrastructure/whatsapp/whatsapp-media.service';
import { WhatsAppApiService } from './infrastructure/whatsapp/whatsapp-api.service';
import { WhatsAppMessagingService } from './infrastructure/whatsapp/whatsapp-messaging.service';
import { WhatsAppDeduplicationService } from './infrastructure/whatsapp/whatsapp-deduplication.service';
// Infrastructure - Telegram
import { TelegramApiService } from './infrastructure/telegram/telegram-api.service';
import { TelegramMediaService } from './infrastructure/telegram/telegram-media.service';
import { TelegramMessagingService } from './infrastructure/telegram/telegram-messaging.service';
// External Modules
import { GoogleCloudModule } from '@/shared/libs/google-cloud';
import { VertexAIModule } from '@/shared/libs/vertex-ai/vertex-ai.module';
import { OpenAIModule } from '@/shared/libs/openai/openai.module';
// Use Cases - WhatsApp/Telegram
import { ProcessVoucherUseCase } from './application/process-voucher.use-case';
import { ConfirmVoucherUseCase } from './application/confirm-voucher.use-case';
import { HandleWhatsAppMessageUseCase } from './application/handle-whatsapp-message.use-case';
import { HandleWhatsAppWebhookUseCase } from './application/handle-whatsapp-webhook.use-case';
import { HandleMissingDataUseCase } from './application/handle-missing-data.use-case';
import { HandleHouseNumberUseCase } from './application/handle-house-number.use-case';
import { CorrectVoucherDataUseCase } from './application/correct-voucher-data.use-case';
import { HandleTelegramWebhookUseCase } from './application/handle-telegram-webhook.use-case';
// Use Cases - Frontend HTTP
import { UploadVoucherFrontendUseCase } from './application/upload-voucher-frontend.use-case';
import { ConfirmVoucherFrontendUseCase } from './application/confirm-voucher-frontend.use-case';

@Module({
  imports: [GoogleCloudModule, VertexAIModule, OpenAIModule],
  controllers: [VouchersController, VouchersFrontendController],
  providers: [
    // Infrastructure - Persistence
    VouchersService,
    ConversationStateService,
    VoucherDuplicateDetectorService,
    VoucherGarbageCollectorService,
    // Infrastructure - OCR
    OcrService,
    VoucherProcessorService,
    // Infrastructure - WhatsApp
    WhatsAppMessageClassifierService,
    WhatsAppMediaService,
    WhatsAppApiService,
    WhatsAppMessagingService,
    WhatsAppDeduplicationService,
    // Infrastructure - Telegram
    TelegramApiService,
    TelegramMediaService,
    TelegramMessagingService,
    // Use Cases - WhatsApp/Telegram
    ProcessVoucherUseCase,
    ConfirmVoucherUseCase,
    HandleWhatsAppMessageUseCase,
    HandleWhatsAppWebhookUseCase,
    HandleMissingDataUseCase,
    HandleHouseNumberUseCase,
    CorrectVoucherDataUseCase,
    HandleTelegramWebhookUseCase,
    // Use Cases - Frontend HTTP
    UploadVoucherFrontendUseCase,
    ConfirmVoucherFrontendUseCase,
  ],
  exports: [VouchersService],
})
export class VouchersModule {}
