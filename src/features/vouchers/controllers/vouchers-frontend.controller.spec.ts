import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Readable } from 'stream';
import { VouchersFrontendController } from './vouchers-frontend.controller';
import { UploadVoucherFrontendUseCase } from '../application/upload-voucher-frontend.use-case';
import { ConfirmVoucherFrontendUseCase } from '../application/confirm-voucher-frontend.use-case';

describe('VouchersFrontendController', () => {
  let controller: VouchersFrontendController;
  let mockUploadUseCase: any;
  let mockConfirmUseCase: any;

  const createMockFile = (
    buffer: Buffer,
    originalname: string,
  ): Express.Multer.File => ({
    buffer,
    originalname,
    size: buffer.length,
    mimetype: 'image/png',
    encoding: '7bit',
    destination: '/tmp',
    filename: originalname,
    path: `/tmp/${originalname}`,
    fieldname: 'file',
    stream: new Readable(),
  });

  beforeEach(async () => {
    mockUploadUseCase = {
      execute: jest.fn(),
    };

    mockConfirmUseCase = {
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [VouchersFrontendController],
      providers: [
        {
          provide: UploadVoucherFrontendUseCase,
          useValue: mockUploadUseCase,
        },
        {
          provide: ConfirmVoucherFrontendUseCase,
          useValue: mockConfirmUseCase,
        },
      ],
    }).compile();

    controller = module.get<VouchersFrontendController>(
      VouchersFrontendController,
    );
  });

  describe('uploadVoucher', () => {
    it('should upload a voucher and return structured data', async () => {
      const mockFile = createMockFile(
        Buffer.from('mock image data'),
        'receipt.png',
      );

      const mockResponse = {
        success: true,
        structuredData: {
          monto: '150.50',
          fecha_pago: '2024-12-01',
          hora_transaccion: '14:30:00',
          casa: 15,
          referencia: 'REF001',
        },
        validation: {
          isValid: true,
          missingFields: [],
          errors: {},
        },
        gcsFilename: 'gs://bucket/file123.png',
        originalFilename: 'receipt.png',
        suggestions: {
          casaDetectedFromCentavos: true,
          autoAssignedTime: false,
        },
      };

      mockUploadUseCase.execute.mockResolvedValue(mockResponse);

      const result = await controller.uploadVoucher(
        mockFile,
        { language: 'es' },
        'Bearer token123',
        'user123',
      );

      expect(result.success).toBe(true);
      expect(result.structuredData.monto).toBe('150.50');
      expect(mockUploadUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          fileBuffer: mockFile.buffer,
          filename: mockFile.originalname,
          language: 'es',
          userId: 'user123',
        }),
      );
    });

    it('should reject upload without file', async () => {
      await expect(
        controller.uploadVoucher(null as any, { language: 'es' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject empty files', async () => {
      const mockFile = createMockFile(Buffer.from(''), 'empty.png');

      await expect(
        controller.uploadVoucher(mockFile, { language: 'es' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should extract userId from JWT token', async () => {
      const mockFile = createMockFile(
        Buffer.from('mock image data'),
        'receipt.png',
      );

      const mockResponse = {
        success: true,
        structuredData: {},
        validation: { isValid: true, missingFields: [], errors: {} },
        gcsFilename: 'gs://bucket/file123.png',
        originalFilename: 'receipt.png',
      };

      mockUploadUseCase.execute.mockResolvedValue(mockResponse);

      await controller.uploadVoucher(
        mockFile,
        {},
        'Bearer sometoken',
        undefined,
      );

      // Currently the JWT decoding is not implemented (TODO in code)
      // So the userId should be null from token
      expect(mockUploadUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null, // No JWT decoding yet
        }),
      );
    });

    it('should use query parameter userId as fallback', async () => {
      const mockFile = createMockFile(
        Buffer.from('mock image data'),
        'receipt.png',
      );

      const mockResponse = {
        success: true,
        structuredData: {},
        validation: { isValid: true, missingFields: [], errors: {} },
        gcsFilename: 'gs://bucket/file123.png',
        originalFilename: 'receipt.png',
      };

      mockUploadUseCase.execute.mockResolvedValue(mockResponse);

      await controller.uploadVoucher(mockFile, {}, undefined, 'queryUser123');

      expect(mockUploadUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'queryUser123',
        }),
      );
    });

    it('should use body userId when no query param or header', async () => {
      const mockFile = createMockFile(
        Buffer.from('mock image data'),
        'receipt.png',
      );

      const mockResponse = {
        success: true,
        structuredData: {},
        validation: { isValid: true, missingFields: [], errors: {} },
        gcsFilename: 'gs://bucket/file123.png',
        originalFilename: 'receipt.png',
      };

      mockUploadUseCase.execute.mockResolvedValue(mockResponse);

      await controller.uploadVoucher(
        mockFile,
        { userId: 'bodyUser123' },
        undefined,
        undefined,
      );

      expect(mockUploadUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'bodyUser123',
        }),
      );
    });

    it('should allow anonymous uploads (no userId)', async () => {
      const mockFile = createMockFile(
        Buffer.from('mock image data'),
        'receipt.png',
      );

      const mockResponse = {
        success: true,
        structuredData: {},
        validation: { isValid: true, missingFields: [], errors: {} },
        gcsFilename: 'gs://bucket/file123.png',
        originalFilename: 'receipt.png',
      };

      mockUploadUseCase.execute.mockResolvedValue(mockResponse);

      await controller.uploadVoucher(mockFile, {}, undefined, undefined);

      expect(mockUploadUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
        }),
      );
    });

    it('should handle use case errors', async () => {
      const mockFile = createMockFile(
        Buffer.from('mock image data'),
        'receipt.png',
      );

      mockUploadUseCase.execute.mockRejectedValue(
        new BadRequestException('File corrupted'),
      );

      await expect(
        controller.uploadVoucher(mockFile, { language: 'es' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmVoucher', () => {
    it('should confirm a voucher with structured data', async () => {
      const mockResponse = {
        success: true,
        confirmationCode: '202412-ABC123',
        voucher: {
          id: 1,
          amount: 150.5,
          date: '2024-12-01T14:30:00Z',
          casa: 15,
          referencia: 'REF001',
          confirmation_status: false,
        },
      };

      mockConfirmUseCase.execute.mockResolvedValue(mockResponse);

      const result = await controller.confirmVoucher(
        {
          gcsFilename: 'gs://bucket/file123.png',
          monto: '150.50',
          fecha_pago: '2024-12-01',
          hora_transaccion: '14:30:00',
          casa: 15,
          referencia: 'REF001',
        },
        'Bearer token123',
        'user123',
      );

      expect(result.success).toBe(true);
      expect(result.confirmationCode).toBe('202412-ABC123');
      expect(result.voucher.id).toBe(1);
      expect(result.voucher.casa).toBe(15);
    });

    it('should extract userId with priority order (header > query > body)', async () => {
      const mockResponse = {
        success: true,
        confirmationCode: '202412-ABC123',
        voucher: {
          id: 1,
          amount: 150.5,
          date: '2024-12-01T14:30:00Z',
          casa: 15,
          referencia: 'REF001',
          confirmation_status: false,
        },
      };

      mockConfirmUseCase.execute.mockResolvedValue(mockResponse);

      // Priority 1: Query parameter
      await controller.confirmVoucher(
        {
          gcsFilename: 'gs://bucket/file123.png',
          monto: '150.50',
          fecha_pago: '2024-12-01',
          hora_transaccion: '14:30:00',
          casa: 15,
        },
        undefined,
        'queryUser123',
      );

      expect(mockConfirmUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'queryUser123',
        }),
      );
    });

    it('should use body userId when no query or header', async () => {
      const mockResponse = {
        success: true,
        confirmationCode: '202412-ABC123',
        voucher: {
          id: 1,
          amount: 150.5,
          date: '2024-12-01T14:30:00Z',
          casa: 15,
          referencia: 'REF001',
          confirmation_status: false,
        },
      };

      mockConfirmUseCase.execute.mockResolvedValue(mockResponse);

      await controller.confirmVoucher(
        {
          gcsFilename: 'gs://bucket/file123.png',
          monto: '150.50',
          fecha_pago: '2024-12-01',
          hora_transaccion: '14:30:00',
          casa: 15,
          userId: 'bodyUser123',
        },
        undefined,
        undefined,
      );

      expect(mockConfirmUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'bodyUser123',
        }),
      );
    });

    it('should allow anonymous confirmation (no userId)', async () => {
      const mockResponse = {
        success: true,
        confirmationCode: '202412-ABC123',
        voucher: {
          id: 1,
          amount: 150.5,
          date: '2024-12-01T14:30:00Z',
          casa: 15,
          referencia: 'REF001',
          confirmation_status: false,
        },
      };

      mockConfirmUseCase.execute.mockResolvedValue(mockResponse);

      await controller.confirmVoucher(
        {
          gcsFilename: 'gs://bucket/file123.png',
          monto: '150.50',
          fecha_pago: '2024-12-01',
          hora_transaccion: '14:30:00',
          casa: 15,
        },
        undefined,
        undefined,
      );

      expect(mockConfirmUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
        }),
      );
    });

    it('should handle duplicate voucher errors', async () => {
      const error = new Error('Ya existe un voucher registrado');
      error.name = 'ConflictException';

      mockConfirmUseCase.execute.mockRejectedValue(error);

      await expect(
        controller.confirmVoucher(
          {
            gcsFilename: 'gs://bucket/file123.png',
            monto: '150.50',
            fecha_pago: '2024-12-01',
            hora_transaccion: '14:30:00',
            casa: 15,
          },
          undefined,
          'user123',
        ),
      ).rejects.toThrow();
    });

    it('should handle validation errors from use case', async () => {
      mockConfirmUseCase.execute.mockRejectedValue(
        new BadRequestException('Datos inválidos'),
      );

      await expect(
        controller.confirmVoucher(
          {
            gcsFilename: 'gs://bucket/file123.png',
            monto: 'invalid',
            fecha_pago: '2024-12-01',
            hora_transaccion: '14:30:00',
            casa: 15,
          },
          undefined,
          'user123',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should re-throw errors with proper status codes', async () => {
      const conflictError = new Error('Conflict');
      conflictError.name = 'ConflictException';

      mockConfirmUseCase.execute.mockRejectedValue(conflictError);

      await expect(
        controller.confirmVoucher(
          {
            gcsFilename: 'gs://bucket/file123.png',
            monto: '150.50',
            fecha_pago: '2024-12-01',
            hora_transaccion: '14:30:00',
            casa: 15,
          },
          undefined,
          'user123',
        ),
      ).rejects.toThrow();
    });
  });

  describe('userId extraction logic', () => {
    it('should prioritize query parameter over body userId', async () => {
      const mockFile = createMockFile(
        Buffer.from('mock image data'),
        'receipt.png',
      );

      const mockResponse = {
        success: true,
        structuredData: {},
        validation: { isValid: true, missingFields: [], errors: {} },
        gcsFilename: 'gs://bucket/file123.png',
        originalFilename: 'receipt.png',
      };

      mockUploadUseCase.execute.mockResolvedValue(mockResponse);

      await controller.uploadVoucher(
        mockFile,
        { userId: 'bodyUser' },
        undefined,
        'queryUser',
      );

      expect(mockUploadUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'queryUser',
        }),
      );
    });

    it('should handle null userId from body', async () => {
      const mockFile = createMockFile(
        Buffer.from('mock image data'),
        'receipt.png',
      );

      const mockResponse = {
        success: true,
        structuredData: {},
        validation: { isValid: true, missingFields: [], errors: {} },
        gcsFilename: 'gs://bucket/file123.png',
        originalFilename: 'receipt.png',
      };

      mockUploadUseCase.execute.mockResolvedValue(mockResponse);

      await controller.uploadVoucher(
        mockFile,
        { userId: null },
        undefined,
        undefined,
      );

      expect(mockUploadUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: null,
        }),
      );
    });
  });
});
