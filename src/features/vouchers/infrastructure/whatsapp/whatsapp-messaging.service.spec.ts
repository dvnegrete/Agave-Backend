import { WhatsAppMessagingService } from './whatsapp-messaging.service';
import { WhatsAppApiService } from './whatsapp-api.service';

describe('WhatsAppMessagingService', () => {
  let service: WhatsAppMessagingService;
  let whatsappApi: jest.Mocked<WhatsAppApiService>;

  beforeEach(() => {
    whatsappApi = {
      sendMessage: jest.fn(),
    } as any;

    service = new WhatsAppMessagingService(whatsappApi);
  });

  it('should send text message with expected payload', async () => {
    await service.sendTextMessage('521234567890', 'hola');

    expect(whatsappApi.sendMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        to: '521234567890',
        type: 'text',
      }),
    );
  });

  it('should trim button payload to max 3 buttons', async () => {
    await service.sendButtonMessage('521234567890', 'elige', [
      { id: '1', title: 'A' },
      { id: '2', title: 'B' },
      { id: '3', title: 'C' },
      { id: '4', title: 'D' },
    ]);

    const payload = whatsappApi.sendMessage.mock.calls[0][0];
    expect(payload.interactive.action.buttons).toHaveLength(3);
    expect(payload.interactive.action.buttons[2].reply.id).toBe('3');
  });

  it('should send list and document messages', async () => {
    await service.sendListMessage('52x', 'body', 'ver opciones', [
      {
        rows: [{ id: 'a', title: 'opcion a' }],
      },
    ]);

    await service.sendDocumentMessage('52x', 'https://doc', 'recibo.pdf', 'cap');

    expect(whatsappApi.sendMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        type: 'interactive',
        interactive: expect.objectContaining({ type: 'list' }),
      }),
    );

    expect(whatsappApi.sendMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        type: 'document',
        document: expect.objectContaining({ filename: 'recibo.pdf' }),
      }),
    );
  });
});
