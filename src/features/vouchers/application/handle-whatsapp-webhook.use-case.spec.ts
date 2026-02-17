import { BadRequestException } from '@nestjs/common';
import { HandleWhatsAppWebhookUseCase } from './handle-whatsapp-webhook.use-case';
import { ProcessVoucherUseCase } from './process-voucher.use-case';
import { HandleWhatsAppMessageUseCase } from './handle-whatsapp-message.use-case';
import { WhatsAppMessageClassifierService } from '../infrastructure/whatsapp/whatsapp-message-classifier.service';
import { WhatsAppMessagingService } from '../infrastructure/whatsapp/whatsapp-messaging.service';
import { ConversationStateService } from '../infrastructure/persistence/conversation-state.service';
import { WhatsAppDeduplicationService } from '../infrastructure/whatsapp/whatsapp-deduplication.service';

describe('HandleWhatsAppWebhookUseCase', () => {
  let useCase: HandleWhatsAppWebhookUseCase;
  let processVoucher: jest.Mocked<ProcessVoucherUseCase>;
  let handleMessage: jest.Mocked<HandleWhatsAppMessageUseCase>;
  let messageClassifier: jest.Mocked<WhatsAppMessageClassifierService>;
  let whatsappMessaging: jest.Mocked<WhatsAppMessagingService>;
  let conversationState: jest.Mocked<ConversationStateService>;
  let deduplication: jest.Mocked<WhatsAppDeduplicationService>;

  const webhookBase = (msg: any) => ({
    entry: [{ changes: [{ value: { messages: [msg] } }] }],
  });

  beforeEach(() => {
    processVoucher = { execute: jest.fn() } as any;
    handleMessage = { execute: jest.fn() } as any;
    messageClassifier = { classifyMessage: jest.fn() } as any;
    whatsappMessaging = { sendTextMessage: jest.fn() } as any;
    conversationState = { getContext: jest.fn() } as any;
    deduplication = {
      isDuplicate: jest.fn(),
      markAsProcessed: jest.fn(),
    } as any;

    useCase = new HandleWhatsAppWebhookUseCase(
      processVoucher,
      handleMessage,
      messageClassifier,
      whatsappMessaging,
      conversationState,
      deduplication,
    );
  });

  it('should return success when webhook has no message', async () => {
    const result = await useCase.execute({ entry: [] } as any);
    expect(result).toEqual({ success: true });
  });

  it('should ignore duplicate message', async () => {
    deduplication.isDuplicate.mockReturnValue(true);

    const result = await useCase.execute(
      webhookBase({ id: 'mid-1', from: '521', type: 'text', text: { body: 'hola' } }) as any,
    );

    expect(result).toEqual(
      expect.objectContaining({ success: true, isDuplicate: true }),
    );
    expect(deduplication.markAsProcessed).not.toHaveBeenCalled();
  });

  it('should process image messages', async () => {
    deduplication.isDuplicate.mockReturnValue(false);
    processVoucher.execute.mockResolvedValue({ success: true } as any);

    const result = await useCase.execute(
      webhookBase({
        id: 'mid-2',
        from: '521',
        type: 'image',
        image: { id: 'media-1', mime_type: 'image/jpeg' },
      }) as any,
    );

    expect(result).toEqual({ success: true });
    expect(deduplication.markAsProcessed).toHaveBeenCalledWith('mid-2');
    expect(processVoucher.execute).toHaveBeenCalledWith({
      phoneNumber: '521',
      mediaId: 'media-1',
      mediaType: 'image',
    });
  });

  it('should classify text without context and reply with classifier response', async () => {
    deduplication.isDuplicate.mockReturnValue(false);
    conversationState.getContext.mockReturnValue(null as any);
    messageClassifier.classifyMessage.mockResolvedValue({
      response: 'respuesta IA',
    } as any);

    const result = await useCase.execute(
      webhookBase({ id: 'mid-3', from: '521', type: 'text', text: { body: 'hola' } }) as any,
    );

    expect(result).toEqual({ success: true });
    expect(messageClassifier.classifyMessage).toHaveBeenCalledWith('hola');
    expect(whatsappMessaging.sendTextMessage).toHaveBeenCalledWith(
      '521',
      'respuesta IA',
    );
  });

  it('should throw BadRequestException when internal handler fails', async () => {
    deduplication.isDuplicate.mockReturnValue(false);
    processVoucher.execute.mockRejectedValue(new Error('boom'));

    await expect(
      useCase.execute(
        webhookBase({
          id: 'mid-4',
          from: '521',
          type: 'image',
          image: { id: 'media-2', mime_type: 'image/jpeg' },
        }) as any,
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
