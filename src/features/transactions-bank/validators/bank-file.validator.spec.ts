import { BankFileValidator } from './bank-file.validator';

function createMockFile(
  originalname: string,
  mimetype: string,
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype,
    size: 1024,
    buffer: Buffer.from('test content'),
    destination: '',
    filename: originalname,
    path: '',
    stream: undefined as any,
  } as Express.Multer.File;
}

describe('BankFileValidator', () => {
  let validator: BankFileValidator;

  beforeEach(() => {
    validator = new BankFileValidator({
      allowedExtensions: ['.csv', '.xlsx', '.txt', '.json'],
      allowedMimeTypes: [
        'text/csv',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'application/json',
      ],
    });
  });

  it('should validate CSV files correctly', () => {
    const file = createMockFile('transactions.csv', 'text/csv');
    expect(validator.isValid(file)).toBe(true);
  });

  it('should validate XLSX files correctly', () => {
    const file = createMockFile(
      'transactions.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(validator.isValid(file)).toBe(true);
  });

  it('should validate TXT files correctly', () => {
    const file = createMockFile('transactions.txt', 'text/plain');
    expect(validator.isValid(file)).toBe(true);
  });

  it('should validate JSON files correctly', () => {
    const file = createMockFile('transactions.json', 'application/json');
    expect(validator.isValid(file)).toBe(true);
  });

  it('should reject unsupported file extensions', () => {
    const file = createMockFile('transactions.pdf', 'application/pdf');
    expect(validator.isValid(file)).toBe(false);
  });

  it('should reject unsupported MIME types', () => {
    const file = createMockFile('transactions.csv', 'application/pdf');
    expect(validator.isValid(file)).toBe(false);
  });

  it('should reject when file is null or undefined', () => {
    expect(validator.isValid(null as any)).toBe(false);
    expect(validator.isValid(undefined)).toBe(false);
  });

  it('should build appropriate error message', () => {
    const errorMessage = validator.buildErrorMessage();
    expect(errorMessage).toContain('Tipo de archivo no soportado');
    expect(errorMessage).toContain(
      'Extensiones permitidas: .csv, .xlsx, .txt, .json',
    );
    expect(errorMessage).toContain('Tipos MIME permitidos');
  });

  it('should handle case insensitive file extensions', () => {
    const file = createMockFile('TRANSACTIONS.CSV', 'text/csv');
    expect(validator.isValid(file)).toBe(true);
  });
});
