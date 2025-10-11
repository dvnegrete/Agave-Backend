import { Test, TestingModule } from '@nestjs/testing';
import { OcrService } from '../infrastructure/ocr/ocr.service';
import {
  GoogleCloudClient,
  CloudStorageService,
} from '@/shared/libs/google-cloud';
import { OpenAIService } from '@/shared/libs/openai/openai.service';
import { VertexAIService } from '@/shared/libs/vertex-ai/vertex-ai.service';
import { BadRequestException } from '@nestjs/common';

describe('OcrService', () => {
  let service: OcrService;
  let googleCloudClient: GoogleCloudClient;
  let cloudStorageService: CloudStorageService;

  const mockGoogleCloudClient = {
    getVisionClient: jest.fn(),
    getConfig: jest.fn(() => ({
      projectId: 'test-project',
      voucherBucketName: 'test-bucket',
    })),
    isReady: jest.fn(() => true),
  };

  const mockCloudStorageService = {
    upload: jest.fn(),
    downloadFile: jest.fn(),
    getAllFiles: jest.fn(),
    deleteMultipleFiles: jest.fn(),
  };

  const mockOpenAIService = {
    processTextWithPrompt: jest.fn(),
  };

  const mockVertexAIService = {
    processTextWithPrompt: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OcrService,
        {
          provide: GoogleCloudClient,
          useValue: mockGoogleCloudClient,
        },
        {
          provide: CloudStorageService,
          useValue: mockCloudStorageService,
        },
        {
          provide: OpenAIService,
          useValue: mockOpenAIService,
        },
        {
          provide: VertexAIService,
          useValue: mockVertexAIService,
        },
      ],
    }).compile();

    service = module.get<OcrService>(OcrService);
    googleCloudClient = module.get<GoogleCloudClient>(GoogleCloudClient);
    cloudStorageService = module.get<CloudStorageService>(CloudStorageService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('validateImageFormat', () => {
    it('should validate JPEG format', async () => {
      const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
      await expect(
        service.validateImageFormat(jpegBuffer, 'test.jpg'),
      ).resolves.not.toThrow();
    });

    it('should validate PNG format', async () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]);
      await expect(
        service.validateImageFormat(pngBuffer, 'test.png'),
      ).resolves.not.toThrow();
    });

    it('should throw error for invalid format', async () => {
      const invalidBuffer = Buffer.from([0x00, 0x01, 0x02, 0x03]);
      await expect(
        service.validateImageFormat(invalidBuffer, 'test.txt'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
