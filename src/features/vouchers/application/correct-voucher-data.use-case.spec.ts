import { CorrectVoucherDataUseCase } from './correct-voucher-data.use-case';
import {
  ConversationState,
  ConversationStateService,
} from '../infrastructure/persistence/conversation-state.service';
import { WhatsAppMessagingService } from '../infrastructure/whatsapp/whatsapp-messaging.service';
import { GcsCleanupService } from '@/shared/libs/google-cloud';

describe('CorrectVoucherDataUseCase', () => {
  let useCase: CorrectVoucherDataUseCase;
  let conversationState: jest.Mocked<ConversationStateService>;
  let whatsappMessaging: jest.Mocked<WhatsAppMessagingService>;
  let gcsCleanup: jest.Mocked<GcsCleanupService>;

  beforeEach(() => {
    conversationState = {
      getContext: jest.fn(),
      setContext: jest.fn(),
      clearContext: jest.fn(),
      getVoucherDataForConfirmation: jest.fn(),
    } as any;
    whatsappMessaging = {
      sendTextMessage: jest.fn(),
      sendListMessage: jest.fn(),
      sendButtonMessage: jest.fn(),
    } as any;
    gcsCleanup = {
      deleteTemporaryProcessingFile: jest.fn(),
    } as any;

    useCase = new CorrectVoucherDataUseCase(
      conversationState,
      whatsappMessaging,
      gcsCleanup,
    );
  });

  it('should reject invalid field selection', async () => {
    const result = await useCase.execute({
      phoneNumber: '521',
      fieldId: 'invalido',
    });

    expect(result.success).toBe(false);
    expect(whatsappMessaging.sendTextMessage).toHaveBeenCalled();
  });

  it('should switch to correction value state for valid field', async () => {
    conversationState.getContext.mockReturnValue({
      data: {
        voucherData: {
          monto: '100',
          fecha_pago: '01/01/2025',
          referencia: 'ABC',
          hora_transaccion: '10:00',
          casa: 10,
        },
      },
    } as any);

    const result = await useCase.execute({
      phoneNumber: '521',
      fieldId: 'referencia',
    });

    expect(result.success).toBe(true);
    expect(conversationState.setContext).toHaveBeenCalledWith(
      '521',
      ConversationState.WAITING_CORRECTION_VALUE,
      expect.objectContaining({ fieldToCorrect: 'referencia' }),
    );
    expect(whatsappMessaging.sendTextMessage).toHaveBeenCalled();
  });

  it('should cancel process and cleanup gcs when fieldId is cancelar_todo', async () => {
    conversationState.getVoucherDataForConfirmation.mockReturnValue({
      voucherData: {},
      gcsFilename: 'temp.jpg',
      originalFilename: 'o.jpg',
    } as any);

    const result = await useCase.execute({
      phoneNumber: '521',
      fieldId: 'cancelar_todo',
    });

    expect(result.success).toBe(true);
    expect(gcsCleanup.deleteTemporaryProcessingFile).toHaveBeenCalledWith(
      'temp.jpg',
      'cancelacion-usuario',
    );
    expect(conversationState.clearContext).toHaveBeenCalledWith('521');
  });

  it('should update field value and return to confirmation state', async () => {
    const data = {
      voucherData: {
        monto: '100',
        fecha_pago: '01/01/2025',
        referencia: 'OLD',
        hora_transaccion: '10:00',
        casa: 10,
      },
      fieldToCorrect: 'referencia',
      gcsFilename: 'g.jpg',
      originalFilename: 'o.jpg',
    };

    conversationState.getContext.mockReturnValue({ data } as any);

    const result = await useCase.execute({
      phoneNumber: '521',
      newValue: 'ABC123',
    });

    expect(result.success).toBe(true);
    expect(conversationState.setContext).toHaveBeenCalledWith(
      '521',
      ConversationState.WAITING_CONFIRMATION,
      expect.objectContaining({
        voucherData: expect.objectContaining({ referencia: 'ABC123' }),
      }),
    );
    expect(whatsappMessaging.sendButtonMessage).toHaveBeenCalled();
  });
});
