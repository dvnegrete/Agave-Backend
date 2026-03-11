import { HandleWhatsAppMessageUseCase } from './handle-whatsapp-message.use-case';
import {
  ConversationState,
  ConversationStateService,
} from '../infrastructure/persistence/conversation-state.service';
import { ConfirmVoucherUseCase } from './confirm-voucher.use-case';
import { HandleMissingDataUseCase } from './handle-missing-data.use-case';
import { HandleHouseNumberUseCase } from './handle-house-number.use-case';
import { CorrectVoucherDataUseCase } from './correct-voucher-data.use-case';
import { WhatsAppMessagingService } from '../infrastructure/whatsapp/whatsapp-messaging.service';

describe('HandleWhatsAppMessageUseCase', () => {
  let useCase: HandleWhatsAppMessageUseCase;
  let conversationState: jest.Mocked<ConversationStateService>;
  let confirmVoucher: jest.Mocked<ConfirmVoucherUseCase>;
  let handleMissingData: jest.Mocked<HandleMissingDataUseCase>;
  let handleHouseNumber: jest.Mocked<HandleHouseNumberUseCase>;
  let correctVoucherData: jest.Mocked<CorrectVoucherDataUseCase>;
  let whatsappMessaging: jest.Mocked<WhatsAppMessagingService>;

  beforeEach(() => {
    conversationState = {
      getContext: jest.fn(),
      updateLastMessageTime: jest.fn(),
      isConfirmationMessage: jest.fn(),
      isNegationMessage: jest.fn(),
      setContext: jest.fn(),
      clearContext: jest.fn(),
    } as any;

    confirmVoucher = { execute: jest.fn() } as any;
    handleMissingData = { execute: jest.fn() } as any;
    handleHouseNumber = { execute: jest.fn() } as any;
    correctVoucherData = { execute: jest.fn() } as any;
    whatsappMessaging = {
      sendTextMessage: jest.fn(),
      sendListMessage: jest.fn(),
    } as any;

    useCase = new HandleWhatsAppMessageUseCase(
      conversationState,
      confirmVoucher,
      handleMissingData,
      handleHouseNumber,
      correctVoucherData,
      whatsappMessaging,
    );
  });

  it('should do nothing when there is no active context', async () => {
    conversationState.getContext.mockReturnValue(null as any);

    const result = await useCase.execute({ phoneNumber: '521', messageText: 'hola' });

    expect(result).toEqual({ success: true });
    expect(conversationState.updateLastMessageTime).not.toHaveBeenCalled();
  });

  it('should delegate confirmation to confirmVoucher use case', async () => {
    conversationState.getContext.mockReturnValue({
      state: ConversationState.WAITING_CONFIRMATION,
      data: {},
    } as any);
    conversationState.isConfirmationMessage.mockReturnValue(true);
    confirmVoucher.execute.mockResolvedValue({ success: true } as any);

    const result = await useCase.execute({ phoneNumber: '521', messageText: 'si' });

    expect(confirmVoucher.execute).toHaveBeenCalledWith({ phoneNumber: '521' });
    expect(result).toEqual({ success: true });
  });

  it('should offer correction when user negates confirmation', async () => {
    conversationState.getContext
      .mockReturnValueOnce({
        state: ConversationState.WAITING_CONFIRMATION,
        data: { voucherData: {} },
      } as any)
      .mockReturnValueOnce({
        state: ConversationState.WAITING_CONFIRMATION,
        data: { voucherData: {} },
      } as any);
    conversationState.isConfirmationMessage.mockReturnValue(false);
    conversationState.isNegationMessage.mockReturnValue(true);

    const result = await useCase.execute({ phoneNumber: '521', messageText: 'no' });

    expect(result).toEqual({ success: true });
    expect(conversationState.setContext).toHaveBeenCalledWith(
      '521',
      ConversationState.WAITING_CORRECTION_TYPE,
      expect.any(Object),
    );
    expect(whatsappMessaging.sendListMessage).toHaveBeenCalled();
  });

  it('should delegate waiting states to their corresponding use cases', async () => {
    conversationState.getContext.mockReturnValue({
      state: ConversationState.WAITING_HOUSE_NUMBER,
      data: {},
    } as any);
    handleHouseNumber.execute.mockResolvedValue({ success: true } as any);

    await useCase.execute({ phoneNumber: '521', messageText: '12' });

    expect(handleHouseNumber.execute).toHaveBeenCalledWith({
      phoneNumber: '521',
      messageText: '12',
    });

    conversationState.getContext.mockReturnValue({
      state: ConversationState.WAITING_MISSING_DATA,
      data: {},
    } as any);
    handleMissingData.execute.mockResolvedValue({ success: true } as any);

    await useCase.execute({ phoneNumber: '521', messageText: '123.45' });
    expect(handleMissingData.execute).toHaveBeenCalled();

    conversationState.getContext.mockReturnValue({
      state: ConversationState.WAITING_CORRECTION_VALUE,
      data: {},
    } as any);
    correctVoucherData.execute.mockResolvedValue({ success: true } as any);

    await useCase.execute({ phoneNumber: '521', messageText: 'ABC123' });
    expect(correctVoucherData.execute).toHaveBeenCalledWith({
      phoneNumber: '521',
      newValue: 'ABC123',
    });
  });
});
