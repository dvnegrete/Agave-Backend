import { WhatsAppApiService } from './whatsapp-api.service';

describe('WhatsAppApiService', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = {
      ...originalEnv,
      TOKEN_WA: 'token-test',
      PHONE_NUMBER_ID_WA: '12345',
    };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('should return configured=true when env vars are present', () => {
    const service = new WhatsAppApiService();
    expect(service.isConfigured()).toBe(true);
    expect(service.getPhoneNumberId()).toBe('12345');
  });

  it('should throw when request is made without configuration', async () => {
    process.env = { ...originalEnv, TOKEN_WA: '', PHONE_NUMBER_ID_WA: '' };
    const service = new WhatsAppApiService();

    await expect(service.request('/messages')).rejects.toThrow(
      'WhatsApp API not configured',
    );
  });

  it('should perform POST request with body and return data', async () => {
    const service = new WhatsAppApiService();
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ id: 'ok' }),
    });
    (global as any).fetch = fetchMock;

    const payload = { type: 'text' };
    const result = await service.request('/12345/messages', 'POST', payload);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://graph.facebook.com/v23.0/12345/messages',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    );
    expect(result).toEqual({ id: 'ok' });
  });

  it('should wrap sendMessage with expected endpoint', async () => {
    const service = new WhatsAppApiService();
    const requestSpy = jest
      .spyOn(service, 'request')
      .mockResolvedValue({ messages: [] } as any);

    await service.sendMessage({ to: '551234' });

    expect(requestSpy).toHaveBeenCalledWith('/12345/messages', 'POST', {
      to: '551234',
    });
  });

  it('should download media buffer successfully', async () => {
    const service = new WhatsAppApiService();
    const bytes = new Uint8Array([1, 2, 3, 4]);
    (global as any).fetch = jest.fn().mockResolvedValue({
      ok: true,
      arrayBuffer: async () => bytes.buffer,
    });

    const result = await service.downloadMedia('https://fake/media');

    expect(result).toEqual(Buffer.from([1, 2, 3, 4]));
  });
});
