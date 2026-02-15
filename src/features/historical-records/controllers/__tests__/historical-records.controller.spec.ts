import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { HistoricalRecordsController } from '../historical-records.controller';
import { UploadHistoricalRecordsUseCase } from '../../application/upload-historical-records.use-case';
import { AuthGuard } from '@/shared/auth/guards/auth.guard';
import { ProcessingResult } from '../../domain/processing-result.value-object';

describe('HistoricalRecordsController', () => {
  let controller: HistoricalRecordsController;
  let uploadHistoricalRecordsUseCase: jest.Mocked<UploadHistoricalRecordsUseCase>;

  const mockFile: Express.Multer.File = {
    fieldname: 'file',
    originalname: 'historical-records.xlsx',
    encoding: '7bit',
    mimetype:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    buffer: Buffer.from('mock excel data'),
    size: 1024,
    stream: null as any,
    destination: '',
    filename: '',
    path: '',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HistoricalRecordsController],
      providers: [
        {
          provide: UploadHistoricalRecordsUseCase,
          useValue: {
            execute: jest.fn(),
          },
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<HistoricalRecordsController>(
      HistoricalRecordsController,
    );
    uploadHistoricalRecordsUseCase = module.get(
      UploadHistoricalRecordsUseCase,
    ) as jest.Mocked<UploadHistoricalRecordsUseCase>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('uploadHistoricalFile', () => {
    it('should successfully process historical file', async () => {
      const bankName = 'BBVA';
      const uploadDto = { validateOnly: false };
      const mockResult = new ProcessingResult(100, 95, 5, [], [1, 2, 3, 4, 5]);

      uploadHistoricalRecordsUseCase.execute.mockResolvedValue(mockResult);

      const result = await controller.uploadHistoricalFile(
        mockFile,
        bankName,
        uploadDto,
      );

      expect(uploadHistoricalRecordsUseCase.execute).toHaveBeenCalledWith(
        mockFile.buffer,
        false,
        bankName,
      );
      expect(result).toBeDefined();
      expect(result.total_rows).toBe(100);
      expect(result.successful).toBe(95);
      expect(result.failed).toBe(5);
      expect(result.success_rate).toBe(95.0);
    });

    it('should process file in validate-only mode', async () => {
      const bankName = 'BBVA';
      const uploadDto = { validateOnly: true };
      const mockResult = new ProcessingResult(
        100,
        90,
        10,
        [
          {
            row_number: 5,
            error_type: 'validation',
            message: 'Amount mismatch',
          },
        ],
        [],
      );

      uploadHistoricalRecordsUseCase.execute.mockResolvedValue(mockResult);

      const result = await controller.uploadHistoricalFile(
        mockFile,
        bankName,
        uploadDto,
      );

      expect(uploadHistoricalRecordsUseCase.execute).toHaveBeenCalledWith(
        mockFile.buffer,
        true,
        bankName,
      );
      expect(result.created_record_ids).toHaveLength(0);
      expect(result.errors).toHaveLength(1);
    });

    it('should throw BadRequestException if bankName is missing', async () => {
      const uploadDto = { validateOnly: false };

      await expect(
        controller.uploadHistoricalFile(mockFile, '', uploadDto),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.uploadHistoricalFile(mockFile, '', uploadDto),
      ).rejects.toThrow('bankName query parameter is required');

      expect(uploadHistoricalRecordsUseCase.execute).not.toHaveBeenCalled();
    });

    it('should throw BadRequestException if bankName is whitespace', async () => {
      const uploadDto = { validateOnly: false };

      await expect(
        controller.uploadHistoricalFile(mockFile, '   ', uploadDto),
      ).rejects.toThrow(BadRequestException);

      expect(uploadHistoricalRecordsUseCase.execute).not.toHaveBeenCalled();
    });

    it('should handle use case errors', async () => {
      const bankName = 'BBVA';
      const uploadDto = { validateOnly: false };
      const error = new Error('Invalid Excel format');

      uploadHistoricalRecordsUseCase.execute.mockRejectedValue(error);

      await expect(
        controller.uploadHistoricalFile(mockFile, bankName, uploadDto),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.uploadHistoricalFile(mockFile, bankName, uploadDto),
      ).rejects.toThrow('Invalid Excel format');
    });

    it('should handle unknown errors gracefully', async () => {
      const bankName = 'BBVA';
      const uploadDto = { validateOnly: false };

      uploadHistoricalRecordsUseCase.execute.mockRejectedValue('Unknown error');

      await expect(
        controller.uploadHistoricalFile(mockFile, bankName, uploadDto),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.uploadHistoricalFile(mockFile, bankName, uploadDto),
      ).rejects.toThrow('Error al procesar el archivo de registros históricos');
    });

    it('should default validateOnly to false if not provided', async () => {
      const bankName = 'BBVA';
      const uploadDto = {} as any;
      const mockResult = new ProcessingResult(10, 10, 0, [], [1, 2]);

      uploadHistoricalRecordsUseCase.execute.mockResolvedValue(mockResult);

      await controller.uploadHistoricalFile(mockFile, bankName, uploadDto);

      expect(uploadHistoricalRecordsUseCase.execute).toHaveBeenCalledWith(
        mockFile.buffer,
        false,
        bankName,
      );
    });

    it('should process file with different bank names', async () => {
      const uploadDto = { validateOnly: false };
      const mockResult = new ProcessingResult(5, 5, 0, [], [1]);
      const banks = ['BBVA', 'Santander', 'BanRegio'];

      for (const bankName of banks) {
        uploadHistoricalRecordsUseCase.execute.mockResolvedValue(mockResult);

        await controller.uploadHistoricalFile(mockFile, bankName, uploadDto);

        expect(uploadHistoricalRecordsUseCase.execute).toHaveBeenCalledWith(
          mockFile.buffer,
          false,
          bankName,
        );
      }
    });

    it('should return response with errors when processing fails partially', async () => {
      const bankName = 'BBVA';
      const uploadDto = { validateOnly: false };
      const mockResult = new ProcessingResult(
        100,
        80,
        20,
        [
          {
            row_number: 15,
            error_type: 'validation',
            message: 'Amount mismatch',
          },
          {
            row_number: 23,
            error_type: 'database',
            message: 'Casa 99 no existe',
            details: { concepto: 'Pago', deposito: 1500, casa: 99 },
          },
        ],
        [1, 2, 3],
      );

      uploadHistoricalRecordsUseCase.execute.mockResolvedValue(mockResult);

      const result = await controller.uploadHistoricalFile(
        mockFile,
        bankName,
        uploadDto,
      );

      expect(result.errors).toHaveLength(2);
      expect(result.errors[0].row_number).toBe(15);
      expect(result.errors[1].row_number).toBe(23);
      expect(result.created_record_ids).toHaveLength(3);
    });
  });
});
