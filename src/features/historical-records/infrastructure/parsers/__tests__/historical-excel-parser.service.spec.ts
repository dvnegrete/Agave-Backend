import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { HistoricalExcelParserService } from '../historical-excel-parser.service';
import * as XLSX from 'xlsx';

describe('HistoricalExcelParserService', () => {
  let service: HistoricalExcelParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HistoricalExcelParserService],
    }).compile();

    service = module.get<HistoricalExcelParserService>(
      HistoricalExcelParserService,
    );
  });

  describe('parseFile', () => {
    it('should successfully parse valid Excel file', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {},
        },
      };

      const mockData = [
        [
          'FECHA',
          'HORA',
          'CONCEPTO',
          'DEPOSITO',
          'Casa',
          'Cuota Extra',
          'Mantto',
          'Penalizacion',
          'Agua',
        ],
        [
          '2025-01-15',
          '10:30:00',
          'Pago mensual',
          '1500',
          '42',
          '100',
          '800',
          '50',
          '550',
        ],
      ];

      jest.spyOn(XLSX, 'read').mockReturnValue(mockWorkbook as any);
      jest.spyOn(XLSX.utils, 'sheet_to_json').mockReturnValue(mockData as any);

      const buffer = Buffer.from('mock excel data');
      const result = await service.parseFile(buffer);

      expect(result).toHaveLength(1);
      expect(result[0].casa).toBe(42);
      expect(result[0].deposito).toBe(1500);
      expect(result[0].mantto).toBe(800);
    });

    it('should throw error for empty Excel file', async () => {
      const mockWorkbook = {
        SheetNames: [],
        Sheets: {},
      };

      jest.spyOn(XLSX, 'read').mockReturnValue(mockWorkbook as any);

      const buffer = Buffer.from('mock excel data');

      await expect(service.parseFile(buffer)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.parseFile(buffer)).rejects.toThrow(
        'El archivo Excel está vacío',
      );
    });

    it('should throw error when headers not found', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {},
        },
      };

      const mockData = [['Invalid', 'Headers', 'Row']];

      jest.spyOn(XLSX, 'read').mockReturnValue(mockWorkbook as any);
      jest.spyOn(XLSX.utils, 'sheet_to_json').mockReturnValue(mockData as any);

      const buffer = Buffer.from('mock excel data');

      await expect(service.parseFile(buffer)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.parseFile(buffer)).rejects.toThrow(
        'No se encontró la fila de encabezados',
      );
    });

    it('should skip empty rows', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {},
        },
      };

      const mockData = [
        [
          'FECHA',
          'HORA',
          'CONCEPTO',
          'DEPOSITO',
          'Casa',
          'Cuota Extra',
          'Mantto',
          'Penalizacion',
          'Agua',
        ],
        [],
        [
          '2025-01-15',
          '10:30:00',
          'Pago mensual',
          '1500',
          '42',
          '0',
          '800',
          '0',
          '700',
        ],
        ['', '', '', '', '', '', '', '', ''],
        [
          '2025-01-16',
          '11:00:00',
          'Otro pago',
          '800',
          '15',
          '0',
          '800',
          '0',
          '0',
        ],
      ];

      jest.spyOn(XLSX, 'read').mockReturnValue(mockWorkbook as any);
      jest.spyOn(XLSX.utils, 'sheet_to_json').mockReturnValue(mockData as any);

      const buffer = Buffer.from('mock excel data');
      const result = await service.parseFile(buffer);

      expect(result).toHaveLength(2);
    });

    it('should throw error when no valid records found', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {},
        },
      };

      const mockData = [
        [
          'FECHA',
          'HORA',
          'CONCEPTO',
          'DEPOSITO',
          'Casa',
          'Cuota Extra',
          'Mantto',
          'Penalizacion',
          'Agua',
        ],
      ];

      jest.spyOn(XLSX, 'read').mockReturnValue(mockWorkbook as any);
      jest.spyOn(XLSX.utils, 'sheet_to_json').mockReturnValue(mockData as any);

      const buffer = Buffer.from('mock excel data');

      await expect(service.parseFile(buffer)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.parseFile(buffer)).rejects.toThrow(
        'No se encontraron registros válidos',
      );
    });

    it('should handle Excel parsing errors', async () => {
      jest.spyOn(XLSX, 'read').mockImplementation(() => {
        throw new Error('Invalid Excel format');
      });

      const buffer = Buffer.from('invalid data');

      await expect(service.parseFile(buffer)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.parseFile(buffer)).rejects.toThrow(
        'Error al procesar el archivo Excel',
      );
    });

    it('should parse dates in different formats', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {},
        },
      };

      const mockData = [
        [
          'FECHA',
          'HORA',
          'CONCEPTO',
          'DEPOSITO',
          'Casa',
          'Cuota Extra',
          'Mantto',
          'Penalizacion',
          'Agua',
        ],
        [
          '15/01/2025',
          '10:30:00',
          'Pago',
          '800',
          '42',
          '0',
          '800',
          '0',
          '0',
        ],
      ];

      jest.spyOn(XLSX, 'read').mockReturnValue(mockWorkbook as any);
      jest.spyOn(XLSX.utils, 'sheet_to_json').mockReturnValue(mockData as any);

      const buffer = Buffer.from('mock excel data');
      const result = await service.parseFile(buffer);

      expect(result).toHaveLength(1);
      expect(result[0].fecha).toBeInstanceOf(Date);
    });

    it('should handle currency formatting in amounts', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {},
        },
      };

      const mockData = [
        [
          'FECHA',
          'HORA',
          'CONCEPTO',
          'DEPOSITO',
          'Casa',
          'Cuota Extra',
          'Mantto',
          'Penalizacion',
          'Agua',
        ],
        [
          '2025-01-15',
          '10:30:00',
          'Pago',
          '$1,500.00',
          '42',
          '$100',
          '$800',
          '$0',
          '$600',
        ],
      ];

      jest.spyOn(XLSX, 'read').mockReturnValue(mockWorkbook as any);
      jest.spyOn(XLSX.utils, 'sheet_to_json').mockReturnValue(mockData as any);

      const buffer = Buffer.from('mock excel data');
      const result = await service.parseFile(buffer);

      expect(result[0].deposito).toBe(1500);
      expect(result[0].cuotaExtra).toBe(100);
      expect(result[0].mantto).toBe(800);
    });

    it('should parse time in different formats', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {},
        },
      };

      const mockData = [
        [
          'FECHA',
          'HORA',
          'CONCEPTO',
          'DEPOSITO',
          'Casa',
          'Cuota Extra',
          'Mantto',
          'Penalizacion',
          'Agua',
        ],
        [
          '2025-01-15',
          '10:30',
          'Pago 1',
          '800',
          '42',
          '0',
          '800',
          '0',
          '0',
        ],
        [
          '2025-01-15',
          '0.5',
          'Pago 2',
          '800',
          '15',
          '0',
          '800',
          '0',
          '0',
        ],
      ];

      jest.spyOn(XLSX, 'read').mockReturnValue(mockWorkbook as any);
      jest.spyOn(XLSX.utils, 'sheet_to_json').mockReturnValue(mockData as any);

      const buffer = Buffer.from('mock excel data');
      const result = await service.parseFile(buffer);

      expect(result).toHaveLength(2);
      expect(result[0].hora).toBe('10:30:00');
      expect(result[1].hora).toBe('12:00:00');
    });

    it('should handle dash as zero in amounts', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {},
        },
      };

      const mockData = [
        [
          'FECHA',
          'HORA',
          'CONCEPTO',
          'DEPOSITO',
          'Casa',
          'Cuota Extra',
          'Mantto',
          'Penalizacion',
          'Agua',
        ],
        [
          '2025-01-15',
          '10:30:00',
          'Pago',
          '800',
          '42',
          '-',
          '800',
          '-',
          '-',
        ],
      ];

      jest.spyOn(XLSX, 'read').mockReturnValue(mockWorkbook as any);
      jest.spyOn(XLSX.utils, 'sheet_to_json').mockReturnValue(mockData as any);

      const buffer = Buffer.from('mock excel data');
      const result = await service.parseFile(buffer);

      expect(result[0].cuotaExtra).toBe(0);
      expect(result[0].penalizacion).toBe(0);
      expect(result[0].agua).toBe(0);
    });

    it('should floor cta_* amounts to integers', async () => {
      const mockWorkbook = {
        SheetNames: ['Sheet1'],
        Sheets: {
          Sheet1: {},
        },
      };

      const mockData = [
        [
          'FECHA',
          'HORA',
          'CONCEPTO',
          'DEPOSITO',
          'Casa',
          'Cuota Extra',
          'Mantto',
          'Penalizacion',
          'Agua',
        ],
        [
          '2025-01-15',
          '10:30:00',
          'Pago',
          '1500.99',
          '42',
          '100.99',
          '800.50',
          '50.75',
          '549.25',
        ],
      ];

      jest.spyOn(XLSX, 'read').mockReturnValue(mockWorkbook as any);
      jest.spyOn(XLSX.utils, 'sheet_to_json').mockReturnValue(mockData as any);

      const buffer = Buffer.from('mock excel data');
      const result = await service.parseFile(buffer);

      expect(result[0].cuotaExtra).toBe(100);
      expect(result[0].mantto).toBe(800);
      expect(result[0].penalizacion).toBe(50);
      expect(result[0].agua).toBe(549);
    });
  });
});
