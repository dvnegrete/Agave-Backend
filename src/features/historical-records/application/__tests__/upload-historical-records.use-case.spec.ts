import { Test, TestingModule } from '@nestjs/testing';
import { UploadHistoricalRecordsUseCase } from '../upload-historical-records.use-case';
import { HistoricalExcelParserService } from '../../infrastructure/parsers/historical-excel-parser.service';
import { HistoricalRowProcessorService } from '../../infrastructure/processors/historical-row-processor.service';
import { HistoricalRecordRow } from '../../domain/historical-record-row.entity';

describe('UploadHistoricalRecordsUseCase', () => {
  let useCase: UploadHistoricalRecordsUseCase;
  let excelParser: jest.Mocked<HistoricalExcelParserService>;
  let rowProcessor: jest.Mocked<HistoricalRowProcessorService>;

  const mockRow = HistoricalRecordRow.create({
    fecha: new Date('2025-01-15'),
    hora: '10:30:00',
    concepto: 'Pago mensual',
    deposito: 1500.42,
    casa: 42,
    cuotaExtra: 100,
    mantto: 800,
    penalizacion: 50,
    agua: 550,
    rowNumber: 2,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadHistoricalRecordsUseCase,
        {
          provide: HistoricalExcelParserService,
          useValue: {
            parseFile: jest.fn(),
          },
        },
        {
          provide: HistoricalRowProcessorService,
          useValue: {
            processRow: jest.fn(),
          },
        },
      ],
    }).compile();

    useCase = module.get<UploadHistoricalRecordsUseCase>(
      UploadHistoricalRecordsUseCase,
    );
    excelParser = module.get(
      HistoricalExcelParserService,
    ) as jest.Mocked<HistoricalExcelParserService>;
    rowProcessor = module.get(
      HistoricalRowProcessorService,
    ) as jest.Mocked<HistoricalRowProcessorService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('execute', () => {
    it('should successfully process all valid rows', async () => {
      const buffer = Buffer.from('mock excel data');
      const bankName = 'BBVA';
      const rows = [mockRow];

      excelParser.parseFile.mockResolvedValue(rows);
      rowProcessor.processRow.mockResolvedValue({
        success: true,
        recordId: 1,
      });

      const result = await useCase.execute(buffer, false, bankName);

      expect(excelParser.parseFile).toHaveBeenCalledWith(buffer);
      expect(rowProcessor.processRow).toHaveBeenCalledWith(mockRow, bankName);
      expect(result.totalRows).toBe(1);
      expect(result.successfulRows).toBe(1);
      expect(result.failedRows).toBe(0);
      expect(result.createdRecordIds).toEqual([1]);
    });

    it('should filter out invalid rows before processing', async () => {
      const buffer = Buffer.from('mock excel data');
      const bankName = 'BBVA';
      const invalidRow = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: '',
        deposito: -100,
        casa: 42,
        cuotaExtra: 0,
        mantto: 0,
        penalizacion: 0,
        agua: 0,
        rowNumber: 3,
      });

      excelParser.parseFile.mockResolvedValue([mockRow, invalidRow]);
      rowProcessor.processRow.mockResolvedValue({
        success: true,
        recordId: 1,
      });

      const result = await useCase.execute(buffer, false, bankName);

      expect(rowProcessor.processRow).toHaveBeenCalledTimes(1);
      expect(rowProcessor.processRow).toHaveBeenCalledWith(mockRow, bankName);
      expect(result.totalRows).toBe(2);
      expect(result.successfulRows).toBe(1);
      expect(result.failedRows).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].row_number).toBe(3);
      expect(result.errors[0].error_type).toBe('validation');
    });

    it('should handle validate-only mode', async () => {
      const buffer = Buffer.from('mock excel data');
      const bankName = 'BBVA';
      const rows = [mockRow];

      excelParser.parseFile.mockResolvedValue(rows);

      const result = await useCase.execute(buffer, true, bankName);

      expect(excelParser.parseFile).toHaveBeenCalledWith(buffer);
      expect(rowProcessor.processRow).not.toHaveBeenCalled();
      expect(result.totalRows).toBe(1);
      expect(result.successfulRows).toBe(1);
      expect(result.failedRows).toBe(0);
      expect(result.createdRecordIds).toHaveLength(0);
    });

    it('should handle processing errors from rowProcessor', async () => {
      const buffer = Buffer.from('mock excel data');
      const bankName = 'BBVA';
      const rows = [mockRow];

      excelParser.parseFile.mockResolvedValue(rows);
      rowProcessor.processRow.mockResolvedValue({
        success: false,
        error: {
          row_number: 2,
          error_type: 'database',
          message: 'Casa 42 no existe',
        },
      });

      const result = await useCase.execute(buffer, false, bankName);

      expect(result.totalRows).toBe(1);
      expect(result.successfulRows).toBe(0);
      expect(result.failedRows).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toBe('Casa 42 no existe');
    });

    it('should handle mixed success and failure rows', async () => {
      const buffer = Buffer.from('mock excel data');
      const bankName = 'BBVA';
      const row1 = mockRow;
      const row2 = HistoricalRecordRow.create({
        fecha: new Date('2025-01-16'),
        hora: '11:00:00',
        concepto: 'Otro pago',
        deposito: 800.0,
        casa: 15,
        cuotaExtra: 0,
        mantto: 800,
        penalizacion: 0,
        agua: 0,
        rowNumber: 3,
      });

      excelParser.parseFile.mockResolvedValue([row1, row2]);
      rowProcessor.processRow
        .mockResolvedValueOnce({ success: true, recordId: 1 })
        .mockResolvedValueOnce({
          success: false,
          error: {
            row_number: 3,
            error_type: 'database',
            message: 'Database error',
          },
        });

      const result = await useCase.execute(buffer, false, bankName);

      expect(result.totalRows).toBe(2);
      expect(result.successfulRows).toBe(1);
      expect(result.failedRows).toBe(1);
      expect(result.createdRecordIds).toEqual([1]);
      expect(result.errors).toHaveLength(1);
    });

    it('should handle rowProcessor exceptions', async () => {
      const buffer = Buffer.from('mock excel data');
      const bankName = 'BBVA';
      const rows = [mockRow];

      excelParser.parseFile.mockResolvedValue(rows);
      rowProcessor.processRow.mockRejectedValue(
        new Error('Unexpected database error'),
      );

      const result = await useCase.execute(buffer, false, bankName);

      expect(result.totalRows).toBe(1);
      expect(result.successfulRows).toBe(0);
      expect(result.failedRows).toBe(1);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].error_type).toBe('database');
      expect(result.errors[0].message).toBe('Unexpected database error');
    });

    it('should process multiple rows sequentially', async () => {
      const buffer = Buffer.from('mock excel data');
      const bankName = 'BBVA';
      const rows = [mockRow, mockRow, mockRow];

      excelParser.parseFile.mockResolvedValue(rows);
      rowProcessor.processRow.mockResolvedValue({
        success: true,
        recordId: 1,
      });

      const result = await useCase.execute(buffer, false, bankName);

      expect(rowProcessor.processRow).toHaveBeenCalledTimes(3);
      expect(result.successfulRows).toBe(3);
    });

    it('should handle empty file (no valid rows)', async () => {
      const buffer = Buffer.from('mock excel data');
      const bankName = 'BBVA';

      excelParser.parseFile.mockResolvedValue([]);

      const result = await useCase.execute(buffer, false, bankName);

      expect(rowProcessor.processRow).not.toHaveBeenCalled();
      expect(result.totalRows).toBe(0);
      expect(result.successfulRows).toBe(0);
      expect(result.failedRows).toBe(0);
    });

    it('should handle rows without recordId', async () => {
      const buffer = Buffer.from('mock excel data');
      const bankName = 'BBVA';
      const unidentifiedRow = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: 'Pago sin casa',
        deposito: 1500.0,
        casa: 0,
        cuotaExtra: 0,
        mantto: 0,
        penalizacion: 0,
        agua: 0,
        rowNumber: 2,
      });

      excelParser.parseFile.mockResolvedValue([unidentifiedRow]);
      rowProcessor.processRow.mockResolvedValue({
        success: true,
      });

      const result = await useCase.execute(buffer, false, bankName);

      expect(result.successfulRows).toBe(1);
      expect(result.createdRecordIds).toHaveLength(0);
    });

    it('should handle all rows having validation errors', async () => {
      const buffer = Buffer.from('mock excel data');
      const bankName = 'BBVA';
      const invalidRow1 = HistoricalRecordRow.create({
        fecha: new Date('2025-01-15'),
        hora: '10:30:00',
        concepto: '',
        deposito: -100,
        casa: 42,
        cuotaExtra: 0,
        mantto: 0,
        penalizacion: 0,
        agua: 0,
        rowNumber: 2,
      });
      const invalidRow2 = HistoricalRecordRow.create({
        fecha: new Date('2025-01-16'),
        hora: '11:00:00',
        concepto: '',
        deposito: 0,
        casa: 15,
        cuotaExtra: 0,
        mantto: 0,
        penalizacion: 0,
        agua: 0,
        rowNumber: 3,
      });

      excelParser.parseFile.mockResolvedValue([invalidRow1, invalidRow2]);

      const result = await useCase.execute(buffer, false, bankName);

      expect(rowProcessor.processRow).not.toHaveBeenCalled();
      expect(result.totalRows).toBe(2);
      expect(result.successfulRows).toBe(0);
      expect(result.failedRows).toBe(2);
      expect(result.errors).toHaveLength(2);
    });
  });
});
