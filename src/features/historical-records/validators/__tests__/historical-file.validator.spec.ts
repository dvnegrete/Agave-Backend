import { HistoricalFileValidator } from '../historical-file.validator';

describe('HistoricalFileValidator', () => {
  let validator: HistoricalFileValidator;

  beforeEach(() => {
    validator = new HistoricalFileValidator();
  });

  describe('isValid', () => {
    it('should validate .xlsx file with correct MIME type', () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'historical-records.xlsx',
        encoding: '7bit',
        mimetype:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('mock data'),
        size: 1024,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      expect(validator.isValid(mockFile)).toBe(true);
    });

    it('should reject file without .xlsx extension', () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'historical-records.xls',
        encoding: '7bit',
        mimetype:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('mock data'),
        size: 1024,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      expect(validator.isValid(mockFile)).toBe(false);
    });

    it('should reject file with incorrect MIME type', () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'historical-records.xlsx',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: Buffer.from('mock data'),
        size: 1024,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      expect(validator.isValid(mockFile)).toBe(false);
    });

    it('should reject .csv files', () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'historical-records.csv',
        encoding: '7bit',
        mimetype: 'text/csv',
        buffer: Buffer.from('mock data'),
        size: 1024,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      expect(validator.isValid(mockFile)).toBe(false);
    });

    it('should reject .txt files', () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'historical-records.txt',
        encoding: '7bit',
        mimetype: 'text/plain',
        buffer: Buffer.from('mock data'),
        size: 1024,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      expect(validator.isValid(mockFile)).toBe(false);
    });

    it('should reject undefined file', () => {
      expect(validator.isValid(undefined)).toBe(false);
    });

    it('should handle uppercase file extension', () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'HISTORICAL-RECORDS.XLSX',
        encoding: '7bit',
        mimetype:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('mock data'),
        size: 1024,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      expect(validator.isValid(mockFile)).toBe(true);
    });

    it('should handle mixed case file extension', () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'historical-records.XlSx',
        encoding: '7bit',
        mimetype:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('mock data'),
        size: 1024,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      expect(validator.isValid(mockFile)).toBe(true);
    });

    it('should reject file with multiple dots in filename', () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'historical.records.xls',
        encoding: '7bit',
        mimetype:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('mock data'),
        size: 1024,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      expect(validator.isValid(mockFile)).toBe(false);
    });

    it('should accept file with multiple dots but correct extension', () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'file',
        originalname: 'historical.records.2025.xlsx',
        encoding: '7bit',
        mimetype:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        buffer: Buffer.from('mock data'),
        size: 1024,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      expect(validator.isValid(mockFile)).toBe(true);
    });
  });

  describe('buildErrorMessage', () => {
    it('should return appropriate error message', () => {
      expect(validator.buildErrorMessage()).toBe(
        'Solo se permiten archivos Excel (.xlsx)',
      );
    });
  });
});
