import { HandleMissingDataUseCase } from './handle-missing-data.use-case';
import {
  ConversationState,
  ConversationStateService,
} from '../infrastructure/persistence/conversation-state.service';
import { WhatsAppMessagingService } from '../infrastructure/whatsapp/whatsapp-messaging.service';
import { GcsCleanupService } from '@/shared/libs/google-cloud';

describe('HandleMissingDataUseCase', () => {
  let useCase: HandleMissingDataUseCase;
  let conversationState: jest.Mocked<ConversationStateService>;
  let whatsappMessaging: jest.Mocked<WhatsAppMessagingService>;
  let gcsCleanup: jest.Mocked<GcsCleanupService>;

  beforeEach(() => {
    conversationState = {
      getContext: jest.fn(),
      clearContext: jest.fn(),
      setContext: jest.fn(),
      saveVoucherForConfirmation: jest.fn(),
    } as any;
    whatsappMessaging = {
      sendTextMessage: jest.fn(),
      sendListMessage: jest.fn(),
      sendButtonMessage: jest.fn(),
    } as any;
    gcsCleanup = {
      deleteTemporaryProcessingFile: jest.fn(),
    } as any;

    useCase = new HandleMissingDataUseCase(
      conversationState,
      whatsappMessaging,
      gcsCleanup,
    );
  });

  it('should fail when no context data exists', async () => {
    conversationState.getContext.mockReturnValue(null as any);

    const result = await useCase.execute({ phoneNumber: '521', messageText: 'x' });

    expect(result.success).toBe(false);
    expect(conversationState.clearContext).toHaveBeenCalledWith('521');
  });

  it('should cleanup and fail when missingFields is empty', async () => {
    conversationState.getContext.mockReturnValue({
      data: {
        voucherData: {},
        missingFields: [],
        gcsFilename: 'temp.jpg',
      },
    } as any);

    const result = await useCase.execute({ phoneNumber: '521', messageText: 'x' });

    expect(result.success).toBe(false);
    expect(gcsCleanup.deleteTemporaryProcessingFile).toHaveBeenCalledWith(
      'temp.jpg',
      'flujo-incompleto-sin-campos-faltantes',
    );
  });

  it('should ask for manual date when user selects otra', async () => {
    conversationState.getContext.mockReturnValue({
      data: {
        voucherData: {
          monto: '100.00',
          fecha_pago: '',
          referencia: 'ABC',
          hora_transaccion: '10:00',
          casa: 10,
        },
        missingFields: ['fecha_pago'],
        gcsFilename: 'g.jpg',
        originalFilename: 'o.jpg',
      },
    } as any);

    const result = await useCase.execute({
      phoneNumber: '521',
      messageText: 'otra',
    });

    expect(result.success).toBe(true);
    expect(whatsappMessaging.sendTextMessage).toHaveBeenCalledWith(
      '521',
      expect.stringContaining('DD/MM/YYYY'),
    );
  });

  it('should move to next missing field when current value is valid', async () => {
    const voucherData = {
      monto: '',
      fecha_pago: '01/01/2025',
      referencia: '',
      hora_transaccion: '10:00',
      casa: 10,
    };
    conversationState.getContext.mockReturnValue({
      data: {
        voucherData,
        missingFields: ['monto', 'referencia'],
        gcsFilename: 'g.jpg',
        originalFilename: 'o.jpg',
      },
    } as any);

    const result = await useCase.execute({
      phoneNumber: '521',
      messageText: '123.45',
    });

    expect(result.success).toBe(true);
    expect(conversationState.setContext).toHaveBeenCalledWith(
      '521',
      ConversationState.WAITING_MISSING_DATA,
      expect.objectContaining({ missingFields: ['referencia'] }),
    );
    expect(whatsappMessaging.sendTextMessage).toHaveBeenCalled();
  });

  it('should save and ask final confirmation when last missing field is completed', async () => {
    const voucherData = {
      monto: '123.45',
      fecha_pago: '01/01/2025',
      referencia: 'OLD',
      hora_transaccion: '10:00',
      casa: 10,
    };
    conversationState.getContext.mockReturnValue({
      data: {
        voucherData,
        missingFields: ['referencia'],
        gcsFilename: 'g.jpg',
        originalFilename: 'o.jpg',
      },
    } as any);

    const result = await useCase.execute({
      phoneNumber: '521',
      messageText: 'ABC123',
    });

    expect(result.success).toBe(true);
    expect(conversationState.saveVoucherForConfirmation).toHaveBeenCalledWith(
      '521',
      voucherData,
      'g.jpg',
      'o.jpg',
    );
    expect(whatsappMessaging.sendButtonMessage).toHaveBeenCalled();
  });
});
