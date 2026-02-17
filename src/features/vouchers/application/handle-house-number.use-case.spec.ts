import { HandleHouseNumberUseCase } from './handle-house-number.use-case';
import { ConversationStateService } from '../infrastructure/persistence/conversation-state.service';
import { WhatsAppMessagingService } from '../infrastructure/whatsapp/whatsapp-messaging.service';

describe('HandleHouseNumberUseCase', () => {
  let useCase: HandleHouseNumberUseCase;
  let conversationState: jest.Mocked<ConversationStateService>;
  let whatsappMessaging: jest.Mocked<WhatsAppMessagingService>;

  beforeEach(() => {
    conversationState = {
      getContext: jest.fn(),
      clearContext: jest.fn(),
      saveVoucherForConfirmation: jest.fn(),
    } as any;
    whatsappMessaging = {
      sendTextMessage: jest.fn(),
      sendButtonMessage: jest.fn(),
    } as any;

    useCase = new HandleHouseNumberUseCase(conversationState, whatsappMessaging);
  });

  it('should fail when no context exists', async () => {
    conversationState.getContext.mockReturnValue(null as any);

    const result = await useCase.execute({
      phoneNumber: '521',
      messageText: '10',
    });

    expect(result.success).toBe(false);
    expect(conversationState.clearContext).toHaveBeenCalledWith('521');
    expect(whatsappMessaging.sendTextMessage).toHaveBeenCalled();
  });

  it('should fail when required data is missing', async () => {
    conversationState.getContext.mockReturnValue({
      data: {
        voucherData: { monto: '100' },
        gcsFilename: undefined,
        originalFilename: 'a.jpg',
      },
    } as any);

    const result = await useCase.execute({
      phoneNumber: '521',
      messageText: '10',
    });

    expect(result.success).toBe(false);
    expect(conversationState.clearContext).toHaveBeenCalledWith('521');
  });

  it('should keep conversation when house number is invalid', async () => {
    conversationState.getContext.mockReturnValue({
      data: {
        voucherData: {
          monto: '100',
          fecha_pago: '01/01/2025',
          referencia: 'ABC',
          hora_transaccion: '10:00',
          casa: null,
        },
        gcsFilename: 'f.jpg',
        originalFilename: 'orig.jpg',
      },
    } as any);

    const result = await useCase.execute({
      phoneNumber: '521',
      messageText: '0',
    });

    expect(result.success).toBe(true);
    expect(conversationState.saveVoucherForConfirmation).not.toHaveBeenCalled();
    expect(whatsappMessaging.sendTextMessage).toHaveBeenCalled();
  });

  it('should save voucher and ask confirmation for valid house number', async () => {
    const voucherData = {
      monto: '100',
      fecha_pago: '01/01/2025',
      referencia: 'ABC',
      hora_transaccion: '10:00',
      casa: null,
    };
    conversationState.getContext.mockReturnValue({
      data: {
        voucherData,
        gcsFilename: 'f.jpg',
        originalFilename: 'orig.jpg',
      },
    } as any);

    const result = await useCase.execute({
      phoneNumber: '521',
      messageText: '12',
    });

    expect(result.success).toBe(true);
    expect(conversationState.saveVoucherForConfirmation).toHaveBeenCalledWith(
      '521',
      expect.objectContaining({ casa: 12 }),
      'f.jpg',
      'orig.jpg',
    );
    expect(whatsappMessaging.sendButtonMessage).toHaveBeenCalled();
  });
});
