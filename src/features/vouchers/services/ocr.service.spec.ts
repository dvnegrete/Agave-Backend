import { Test, TestingModule } from '@nestjs/testing';
import { OcrService } from './ocr.service';
import { GoogleCloudConfigService } from '../../config/google-cloud.config';
import { BadRequestException } from '@nestjs/common';

describe('OcrService', () => {
  let service: OcrService;
  let googleCloudConfig: GoogleCloudConfigService;

  const mockGoogleCloudConfig = {
    isEnabled: true,
    applicationCredentials: '/path/to/credentials.json',
    projectId: 'test-project',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OcrService,
        {
          provide: GoogleCloudConfigService,
          useValue: mockGoogleCloudConfig,
        },
      ],
    }).compile();

    service = module.get<OcrService>(OcrService);
    googleCloudConfig = module.get<GoogleCloudConfigService>(
      GoogleCloudConfigService,
    );
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
