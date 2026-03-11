import { Test, TestingModule } from '@nestjs/testing';
import { OcrService } from './ocr.service';
import {
  GoogleCloudClient,
  CloudStorageService,
} from '@/shared/libs/google-cloud';
import { OpenAIService } from '@/shared/libs/openai/openai.service';
import { VertexAIService } from '@/shared/libs/vertex-ai/vertex-ai.service';
import { BadRequestException } from '@nestjs/common';

describe('OcrService (infrastructure)', () => {
  let service: OcrService;
  let googleCloudClient: jest.Mocked<GoogleCloudClient>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OcrService,
        {
          provide: GoogleCloudClient,
          useValue: {
            getVisionClient: jest.fn(),
            getConfig: jest.fn(),
          },
        },
        {
          provide: CloudStorageService,
          useValue: {
            upload: jest.fn(),
            getAllFiles: jest.fn(),
            downloadFile: jest.fn(),
            deleteMultipleFiles: jest.fn(),
          },
        },
        {
          provide: OpenAIService,
          useValue: {
            processTextWithPrompt: jest.fn(),
          },
        },
        {
          provide: VertexAIService,
          useValue: {
            processTextWithPrompt: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(OcrService);
    googleCloudClient = module.get(GoogleCloudClient);
  });

  it('should return simulated OCR result when vision client is unavailable', async () => {
    googleCloudClient.getVisionClient.mockReturnValue(null as any);
    googleCloudClient.getConfig.mockReturnValue({ voucherBucketName: '' } as any);

    const result = await service.extractTextFromImage(
      Buffer.from([0xff, 0xd8, 0xff]),
      'ticket.jpg',
    );

    expect(result.originalFilename).toBe('ticket.jpg');
    expect(result.structuredData.monto).toBe('123.45');
    expect(result.gcsFilename).toContain('simulated');
  });

  it('should normalize structured data coercing values to safe strings', () => {
    const normalized = (service as any).normalizeStructuredData({
      monto: 1200.5,
      fecha_pago: ' 2025-01-01 ',
      referencia: null,
      hora_transaccion: 930,
      faltan_datos: 'true',
      pregunta: undefined,
      extra: 1,
    });

    expect(normalized).toEqual(
      expect.objectContaining({
        monto: '1200.5',
        fecha_pago: '2025-01-01',
        referencia: '',
        hora_transaccion: '930',
        faltan_datos: true,
        pregunta: '',
        extra: 1,
      }),
    );
  });

  it('should resolve mime types and fallback to octet-stream', () => {
    expect((service as any).getMimeType('pdf')).toBe('application/pdf');
    expect((service as any).getMimeType('PNG')).toBe('image/png');
    expect((service as any).getMimeType('unknown')).toBe(
      'application/octet-stream',
    );
  });

  it('should validate supported file signatures', async () => {
    await expect(
      service.validateImageFormat(
        Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d]),
        'voucher.pdf',
      ),
    ).resolves.not.toThrow();

    await expect(
      service.validateImageFormat(Buffer.from([0x00, 0x01, 0x02]), 'bad.bin'),
    ).rejects.toThrow(BadRequestException);
  });
});
