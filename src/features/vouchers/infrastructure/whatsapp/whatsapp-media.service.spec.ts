import { WhatsAppMediaService } from './whatsapp-media.service';
import { WhatsAppApiService } from './whatsapp-api.service';

describe('WhatsAppMediaService', () => {
  let service: WhatsAppMediaService;
  let whatsappApi: jest.Mocked<WhatsAppApiService>;

  beforeEach(() => {
    whatsappApi = {
      getMediaInfo: jest.fn(),
      downloadMedia: jest.fn(),
    } as any;
    service = new WhatsAppMediaService(whatsappApi);
  });

  it('should map API media info fields', async () => {
    whatsappApi.getMediaInfo.mockResolvedValue({
      url: 'https://media.url',
      mime_type: 'image/jpeg',
      sha256: 'hash',
      file_size: 456,
    });

    const result = await service.getMediaInfo('mid-1');

    expect(result).toEqual({
      url: 'https://media.url',
      mimeType: 'image/jpeg',
      sha256: 'hash',
      fileSize: 456,
    });
  });

  it('should download media and generate filename from mimeType', async () => {
    whatsappApi.getMediaInfo.mockResolvedValue({
      url: 'https://media.url',
      mime_type: 'application/pdf',
      sha256: 'hash',
      file_size: 456,
    });
    whatsappApi.downloadMedia.mockResolvedValue(Buffer.from([9, 8, 7]));

    const result = await service.downloadMedia('mid-2');

    expect(result.mimeType).toBe('application/pdf');
    expect(result.filename).toBe('whatsapp-mid-2.pdf');
    expect(result.buffer).toEqual(Buffer.from([9, 8, 7]));
  });

  it('should validate supported media types', () => {
    expect(service.isSupportedMediaType('image/png')).toBe(true);
    expect(service.isSupportedMediaType('application/pdf')).toBe(true);
    expect(service.isSupportedMediaType('video/mp4')).toBe(false);
  });
});
