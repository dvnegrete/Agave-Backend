import { Test, TestingModule } from '@nestjs/testing';
import { UploadVoucherFrontendUseCase } from './upload-voucher-frontend.use-case';
import { VoucherProcessorService } from '../infrastructure/ocr/voucher-processor.service';

describe('UploadVoucherFrontendUseCase', () => {
  let useCase: UploadVoucherFrontendUseCase;
  let mockVoucherProcessor: any;

  beforeEach(async () => {
    mockVoucherProcessor = {
      processVoucher: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadVoucherFrontendUseCase,
        {
          provide: VoucherProcessorService,
          useValue: mockVoucherProcessor,
        },
      ],
    }).compile();

    useCase = module.get<UploadVoucherFrontendUseCase>(
      UploadVoucherFrontendUseCase,
    );
  });

  describe('execute', () => {
    it('should successfully process a voucher image and return structured data', async () => {
      const fileBuffer = Buffer.from('mock image data');
      const filename = 'receipt.png';
      const language = 'es';

      const mockOcrResult = {
        structuredData: {
          monto: '150.50',
          fecha_pago: '2024-12-01',
          hora_transaccion: '14:30:00',
          casa: 15,
          referencia: 'REF001',
          hora_asignada_automaticamente: false,
        },
        gcsFilename: 'gs://bucket/file123.png',
        originalFilename: 'receipt.png',
      };

      mockVoucherProcessor.processVoucher.mockResolvedValue(mockOcrResult);

      const result = await useCase.execute({
        fileBuffer,
        filename,
        language,
      });

      expect(result.success).toBe(true);
      expect(result.structuredData).toEqual(mockOcrResult.structuredData);
      expect(result.gcsFilename).toBe(mockOcrResult.gcsFilename);
      expect(result.originalFilename).toBe(filename);
      expect(result.validation.isValid).toBe(true);
      expect(result.validation.missingFields).toEqual([]);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions!.casaDetectedFromCentavos).toBe(true);
      expect(result.suggestions!.autoAssignedTime).toBe(false);
    });

    it('should detect missing required fields', async () => {
      const fileBuffer = Buffer.from('mock image data');
      const filename = 'receipt.png';

      const mockOcrResult = {
        structuredData: {
          monto: '',
          fecha_pago: '2024-12-01',
          hora_transaccion: undefined,
          casa: null,
          referencia: 'REF001',
        },
        gcsFilename: 'gs://bucket/file123.png',
        originalFilename: 'receipt.png',
      };

      mockVoucherProcessor.processVoucher.mockResolvedValue(mockOcrResult);

      const result = await useCase.execute({
        fileBuffer,
        filename,
      });

      expect(result.success).toBe(true);
      expect(result.validation.isValid).toBe(false);
      expect(result.validation.missingFields).toContain('monto');
      expect(result.validation.missingFields).toContain('hora_transaccion');
      expect(result.validation.missingFields).toContain('casa');
    });

    it('should validate monto format', async () => {
      const fileBuffer = Buffer.from('mock image data');
      const filename = 'receipt.png';

      const mockOcrResult = {
        structuredData: {
          monto: 'invalid',
          fecha_pago: '2024-12-01',
          hora_transaccion: '14:30:00',
          casa: 15,
        },
        gcsFilename: 'gs://bucket/file123.png',
        originalFilename: 'receipt.png',
      };

      mockVoucherProcessor.processVoucher.mockResolvedValue(mockOcrResult);

      const result = await useCase.execute({
        fileBuffer,
        filename,
      });

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors.monto).toBeDefined();
    });

    it('should reject negative or zero amounts', async () => {
      const fileBuffer = Buffer.from('mock image data');
      const filename = 'receipt.png';

      const mockOcrResult = {
        structuredData: {
          monto: '-100',
          fecha_pago: '2024-12-01',
          hora_transaccion: '14:30:00',
          casa: 15,
        },
        gcsFilename: 'gs://bucket/file123.png',
        originalFilename: 'receipt.png',
      };

      mockVoucherProcessor.processVoucher.mockResolvedValue(mockOcrResult);

      const result = await useCase.execute({
        fileBuffer,
        filename,
      });

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors.monto).toBeDefined();
    });

    it('should validate casa is within range 1-66', async () => {
      const fileBuffer = Buffer.from('mock image data');
      const filename = 'receipt.png';

      const mockOcrResult = {
        structuredData: {
          monto: '150.50',
          fecha_pago: '2024-12-01',
          hora_transaccion: '14:30:00',
          casa: 100, // Out of range
        },
        gcsFilename: 'gs://bucket/file123.png',
        originalFilename: 'receipt.png',
      };

      mockVoucherProcessor.processVoucher.mockResolvedValue(mockOcrResult);

      const result = await useCase.execute({
        fileBuffer,
        filename,
      });

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors.casa).toBeDefined();
    });

    it('should validate date format YYYY-MM-DD', async () => {
      const fileBuffer = Buffer.from('mock image data');
      const filename = 'receipt.png';

      const mockOcrResult = {
        structuredData: {
          monto: '150.50',
          fecha_pago: 'invalid-date',
          hora_transaccion: '14:30:00',
          casa: 15,
        },
        gcsFilename: 'gs://bucket/file123.png',
        originalFilename: 'receipt.png',
      };

      mockVoucherProcessor.processVoucher.mockResolvedValue(mockOcrResult);

      const result = await useCase.execute({
        fileBuffer,
        filename,
      });

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors.fecha_pago).toBeDefined();
    });

    it('should validate time format HH:MM:SS', async () => {
      const fileBuffer = Buffer.from('mock image data');
      const filename = 'receipt.png';

      const mockOcrResult = {
        structuredData: {
          monto: '150.50',
          fecha_pago: '2024-12-01',
          hora_transaccion: '25:99:99', // Invalid time
          casa: 15,
        },
        gcsFilename: 'gs://bucket/file123.png',
        originalFilename: 'receipt.png',
      };

      mockVoucherProcessor.processVoucher.mockResolvedValue(mockOcrResult);

      const result = await useCase.execute({
        fileBuffer,
        filename,
      });

      expect(result.validation.isValid).toBe(false);
      expect(result.validation.errors.hora_transaccion).toBeDefined();
    });

    it('should include warning when time is auto-assigned', async () => {
      const fileBuffer = Buffer.from('mock image data');
      const filename = 'receipt.png';

      const mockOcrResult = {
        structuredData: {
          monto: '150.50',
          fecha_pago: '2024-12-01',
          hora_transaccion: '12:00:00',
          casa: 15,
          hora_asignada_automaticamente: true,
        },
        gcsFilename: 'gs://bucket/file123.png',
        originalFilename: 'receipt.png',
      };

      mockVoucherProcessor.processVoucher.mockResolvedValue(mockOcrResult);

      const result = await useCase.execute({
        fileBuffer,
        filename,
      });

      expect(result.validation.warnings).toBeDefined();
      expect(result.validation.warnings?.length).toBeGreaterThan(0);
      expect(result.suggestions).toBeDefined();
      expect(result.suggestions!.autoAssignedTime).toBe(true);
    });

    it('should handle OCR processing errors gracefully', async () => {
      const fileBuffer = Buffer.from('mock image data');
      const filename = 'invalid.txt';

      mockVoucherProcessor.processVoucher.mockRejectedValue(
        new Error('Unsupported file format'),
      );

      await expect(
        useCase.execute({
          fileBuffer,
          filename,
        }),
      ).rejects.toThrow('Unsupported file format');
    });

    it('should use default language if not provided', async () => {
      const fileBuffer = Buffer.from('mock image data');
      const filename = 'receipt.png';

      const mockOcrResult = {
        structuredData: {
          monto: '150.50',
          fecha_pago: '2024-12-01',
          hora_transaccion: '14:30:00',
          casa: 15,
        },
        gcsFilename: 'gs://bucket/file123.png',
        originalFilename: 'receipt.png',
      };

      mockVoucherProcessor.processVoucher.mockResolvedValue(mockOcrResult);

      await useCase.execute({
        fileBuffer,
        filename,
      });

      expect(mockVoucherProcessor.processVoucher).toHaveBeenCalledWith(
        fileBuffer,
        filename,
        'es',
      );
    });
  });
});
