import { FileProcessorService } from './file-processor.service';
import { UploadFileDto } from '../dto/upload-file.dto';

function createFile(
  buffer: Buffer,
  filename: string,
  mimetype = 'application/octet-stream',
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname: filename,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    buffer,
    destination: '',
    filename: filename,
    path: '',
    stream: undefined as any,
  } as unknown as Express.Multer.File;
}

describe('FileProcessorService', () => {
  let service: FileProcessorService;

  beforeEach(() => {
    service = new FileProcessorService();
  });

  it('parsea CSV con encabezado usando modelo SantanderXlsx', async () => {
    const csv =
      'FECHA,HORA,CONCEPTO,RETIRO,DEPOSITO,MONEDA\n31/jul/25,10:30:00,PAGO,150.00,,MXN\n';
    const file = createFile(
      Buffer.from(csv, 'utf-8'),
      'santander.csv',
      'text/csv',
    );
    const options: UploadFileDto = {
      bankName: 'Santander',
      model: 'SantanderXlsx',
    } as any;
    const result = await service.parseFile(file, options);
    expect(result.length).toBe(1);
    expect(result[0].is_deposit).toBe(false);
    expect(result[0].amount).toBe(150);
    expect(result[0].date).toBe('2025-07-31');
  });

  it('parsea XLSX simple con modelo SantanderXlsx', async () => {
    // Construir un XLSX básico en memoria
    const XLSX = require('xlsx');
    const rows = [
      ['FECHA', 'HORA', 'CONCEPTO', 'RETIRO', 'DEPOSITO', 'MONEDA'],
      ['31/jul/25', '14:05:22', 'ABONO', '', 2500, 'MXN'],
    ];
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    const buf = XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' });
    const file = createFile(
      buf,
      'santander.xlsx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    const result = await service.parseFile(file, {
      bankName: 'Santander',
    } as any);
    expect(result.length).toBe(1);
    expect(result[0].is_deposit).toBe(true);
    expect(result[0].amount).toBe(2500);
  });

  it('parsea TXT usando parser genérico si el modelo no define mapTxtLine', async () => {
    const txt = '2025-07-31|10:30:00|PAGO|150.00|MXN|false\n';
    const file = createFile(
      Buffer.from(txt, 'utf-8'),
      'santander.txt',
      'text/plain',
    );
    const result = await service.parseFile(file, {
      bankName: 'Santander',
    } as any);
    expect(result.length).toBe(1);
    expect(result[0].is_deposit).toBe(false);
    expect(result[0].amount).toBe(150);
  });

  it('parsea JSON con llaves equivalentes mediante el modelo', async () => {
    const json = JSON.stringify({
      transactions: [
        {
          fecha: '31/jul/25',
          hora: '10:30:00',
          concepto: 'PAGO',
          monto: 100,
          moneda: 'MXN',
          deposito: false,
        },
      ],
    });
    const file = createFile(
      Buffer.from(json, 'utf-8'),
      'santander.json',
      'application/json',
    );
    const result = await service.parseFile(file, {
      bankName: 'Santander',
    } as any);
    expect(result.length).toBe(1);
    expect(result[0].amount).toBe(100);
    expect(result[0].is_deposit).toBe(false);
  });
});
