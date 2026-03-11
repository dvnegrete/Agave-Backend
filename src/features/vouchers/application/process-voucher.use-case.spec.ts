import { ProcessVoucherUseCase } from './process-voucher.use-case';
import { VoucherProcessorService } from '../infrastructure/ocr/voucher-processor.service';
import {
  ConversationState,
  ConversationStateService,
} from '../infrastructure/persistence/conversation-state.service';
import { WhatsAppMessagingService } from '../infrastructure/whatsapp/whatsapp-messaging.service';
import { WhatsAppMediaService } from '../infrastructure/whatsapp/whatsapp-media.service';
import { GcsCleanupService } from '@/shared/libs/google-cloud';

describe('ProcessVoucherUseCase', () => {
  let useCase: ProcessVoucherUseCase;
  let voucherProcessor: jest.Mocked<VoucherProcessorService>;
  let whatsappMedia: jest.Mocked<WhatsAppMediaService>;
  let whatsappMessaging: jest.Mocked<WhatsAppMessagingService>;
  let conversationState: jest.Mocked<ConversationStateService>;
  let gcsCleanup: jest.Mocked<GcsCleanupService>;

  beforeEach(() => {
    voucherProcessor = { processVoucher: jest.fn() } as any;
    whatsappMedia = {
      downloadMedia: jest.fn(),
      isSupportedMediaType: jest.fn(),
    } as any;
    whatsappMessaging = {
      sendTextMessage: jest.fn(),
      sendButtonMessage: jest.fn(),
      sendListMessage: jest.fn(),
    } as any;
    conversationState = {
      saveVoucherForConfirmation: jest.fn(),
      setContext: jest.fn(),
    } as any;
    gcsCleanup = { deleteTemporaryProcessingFile: jest.fn() } as any;

    useCase = new ProcessVoucherUseCase(
      voucherProcessor,
      whatsappMedia,
      whatsappMessaging,
      conversationState,
      gcsCleanup,
    );
  });

  it('should reject unsupported media type', async () => {
    whatsappMedia.downloadMedia.mockResolvedValue({
      buffer: Buffer.from([1]),
      mimeType: 'video/mp4',
      filename: 'bad.mp4',
    });
    whatsappMedia.isSupportedMediaType.mockReturnValue(false);

    const result = await useCase.execute({
      phoneNumber: '521',
      mediaId: 'm1',
      mediaType: 'image',
    });

    expect(result.success).toBe(false);
    expect(whatsappMessaging.sendTextMessage).toHaveBeenCalled();
  });

  it('should store and ask confirmation when data is complete', async () => {
    whatsappMedia.downloadMedia.mockResolvedValue({
      buffer: Buffer.from([1]),
      mimeType: 'image/jpeg',
      filename: 'ok.jpg',
    });
    whatsappMedia.isSupportedMediaType.mockReturnValue(true);
    voucherProcessor.processVoucher.mockResolvedValue({
      structuredData: {
        monto: '100.00',
        fecha_pago: '01/01/2025',
        referencia: 'ABC',
        hora_transaccion: '10:00',
        faltan_datos: false,
        casa: 10,
      },
      whatsappMessage: 'confirma',
      gcsFilename: 'file-1.jpg',
      originalFilename: 'ok.jpg',
    } as any);

    const result = await useCase.execute({
      phoneNumber: '521',
      mediaId: 'm1',
      mediaType: 'image',
    });

    expect(result.success).toBe(true);
    expect(conversationState.saveVoucherForConfirmation).toHaveBeenCalled();
    expect(whatsappMessaging.sendButtonMessage).toHaveBeenCalled();
  });

  it('should ask for missing house number', async () => {
    whatsappMedia.downloadMedia.mockResolvedValue({
      buffer: Buffer.from([1]),
      mimeType: 'image/jpeg',
      filename: 'ok.jpg',
    });
    whatsappMedia.isSupportedMediaType.mockReturnValue(true);
    voucherProcessor.processVoucher.mockResolvedValue({
      structuredData: {
        monto: '100.00',
        fecha_pago: '01/01/2025',
        referencia: 'ABC',
        hora_transaccion: '10:00',
        faltan_datos: false,
        casa: null,
      },
      whatsappMessage: 'dime casa',
      gcsFilename: 'file-2.jpg',
      originalFilename: 'ok.jpg',
    } as any);

    const result = await useCase.execute({
      phoneNumber: '521',
      mediaId: 'm2',
      mediaType: 'image',
    });

    expect(result.success).toBe(true);
    expect(conversationState.setContext).toHaveBeenCalledWith(
      '521',
      ConversationState.WAITING_HOUSE_NUMBER,
      expect.any(Object),
    );
    expect(whatsappMessaging.sendTextMessage).toHaveBeenCalledWith(
      '521',
      'dime casa',
    );
  });

  it('should cleanup uploaded file and notify on processing error', async () => {
    whatsappMedia.downloadMedia.mockResolvedValue({
      buffer: Buffer.from([1]),
      mimeType: 'image/jpeg',
      filename: 'ok.jpg',
    });
    whatsappMedia.isSupportedMediaType.mockReturnValue(true);
    voucherProcessor.processVoucher.mockResolvedValue({
      structuredData: {
        monto: '100.00',
        fecha_pago: '01/01/2025',
        referencia: 'ABC',
        hora_transaccion: '10:00',
        faltan_datos: false,
        casa: 10,
      },
      whatsappMessage: 'confirma',
      gcsFilename: 'file-3.jpg',
      originalFilename: 'ok.jpg',
    } as any);
    whatsappMessaging.sendButtonMessage.mockRejectedValue(new Error('send failed'));

    const result = await useCase.execute({
      phoneNumber: '521',
      mediaId: 'm3',
      mediaType: 'image',
    });

    expect(result.success).toBe(false);
    expect(gcsCleanup.deleteTemporaryProcessingFile).toHaveBeenCalledWith(
      'file-3.jpg',
      'error-en-procesamiento',
    );
    expect(whatsappMessaging.sendTextMessage).toHaveBeenCalled();
  });
});
