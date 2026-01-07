import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { HistoricalRecordRow } from '../../domain/historical-record-row.entity';

/**
 * Service to parse historical records Excel files
 * Expected columns: FECHA, HORA, CONCEPTO, DEPOSITO, Casa, Cuota Extra, Mantto, Penalizacion, Agua
 */
@Injectable()
export class HistoricalExcelParserService {
  private readonly logger = new Logger(HistoricalExcelParserService.name);

  private readonly EXPECTED_COLUMNS = [
    'FECHA',
    'HORA',
    'CONCEPTO',
    'DEPOSITO',
    'Casa',
    'Cuota Extra',
    'Mantto',
    'Penalizacion',
    'Agua',
  ];

  /**
   * Parse Excel buffer and return array of HistoricalRecordRow entities
   */
  async parseFile(buffer: Buffer): Promise<HistoricalRecordRow[]> {
    try {
      this.logger.debug('Starting Excel file parsing');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];

      if (!sheetName) {
        throw new BadRequestException('El archivo Excel está vacío');
      }

      this.logger.debug(`Processing sheet: ${sheetName}`);
      const worksheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(worksheet, {
        header: 1,
        raw: false,
        dateNF: 'yyyy-mm-dd',
      }) as any[][];

      // Find header row
      const headerRowIndex = this.findHeaderRow(data);
      if (headerRowIndex === -1) {
        throw new BadRequestException(
          `No se encontró la fila de encabezados. Se esperan columnas: ${this.EXPECTED_COLUMNS.join(', ')}`,
        );
      }

      this.logger.debug(`Header row found at index: ${headerRowIndex}`);
      const headers = data[headerRowIndex] as string[];
      const dataRows = data.slice(headerRowIndex + 1) as any[][];

      // Parse each row
      const records: HistoricalRecordRow[] = [];
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        const actualRowNumber = headerRowIndex + i + 2; // +2 for Excel row number (1-indexed, header offset)

        // Skip empty rows
        if (!row || row.length === 0 || row.every((cell) => !cell)) {
          this.logger.debug(`Skipping empty row ${actualRowNumber}`);
          continue;
        }

        try {
          const record = this.parseRow(row, headers, actualRowNumber);
          records.push(record);
        } catch (error) {
          throw new BadRequestException(
            `Error en fila ${actualRowNumber}: ${error instanceof Error ? error.message : 'Error desconocido'}`,
          );
        }
      }

      if (records.length === 0) {
        throw new BadRequestException('No se encontraron registros válidos en el archivo');
      }

      this.logger.log(`Successfully parsed ${records.length} rows from Excel file`);
      return records;
    } catch (error: any) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`Excel parsing failed: ${error.message}`);
      throw new BadRequestException(
        `Error al procesar el archivo Excel: ${error.message}`,
      );
    }
  }

  /**
   * Find the row containing headers by looking for expected column names
   */
  private findHeaderRow(data: any[][]): number {
    for (let i = 0; i < Math.min(10, data.length); i++) {
      const row = data[i];
      if (!row) continue;

      // Check if row contains most expected columns
      const matchedColumns = this.EXPECTED_COLUMNS.filter((col) =>
        row.some(
          (cell) =>
            cell &&
            cell.toString().toLowerCase().includes(col.toLowerCase()),
        ),
      );

      if (matchedColumns.length >= 7) {
        // At least 7 out of 9 columns
        return i;
      }
    }
    return -1;
  }

  /**
   * Parse a single row into HistoricalRecordRow entity
   */
  private parseRow(
    row: any[],
    headers: string[],
    rowNumber: number,
  ): HistoricalRecordRow {
    // Map columns by name (case-insensitive)
    const getValue = (columnName: string): any => {
      const index = headers.findIndex(
        (h) =>
          h &&
          h.toLowerCase().includes(columnName.toLowerCase()),
      );
      return index >= 0 ? row[index] : undefined;
    };

    // Parse FECHA
    const fechaRaw = getValue('FECHA');
    const fecha = this.parseDate(fechaRaw, rowNumber);

    // Parse HORA
    const hora = this.parseTime(getValue('HORA'));

    // Parse CONCEPTO
    const concepto = String(getValue('CONCEPTO') || '').trim();

    // Parse DEPOSITO
    const deposito = this.parseNumber(getValue('DEPOSITO'), 'DEPOSITO', rowNumber);

    // Parse Casa
    const casa = this.parseNumber(getValue('Casa'), 'Casa', rowNumber, true) || 0;

    // Parse cta_* amounts (allow 0 or missing)
    const cuotaExtra = this.parseNumber(getValue('Cuota Extra'), 'Cuota Extra', rowNumber, true) || 0;
    const mantto = this.parseNumber(getValue('Mantto'), 'Mantto', rowNumber, true) || 0;
    const penalizacion = this.parseNumber(getValue('Penalizacion'), 'Penalizacion', rowNumber, true) || 0;
    const agua = this.parseNumber(getValue('Agua'), 'Agua', rowNumber, true) || 0;

    return HistoricalRecordRow.create({
      fecha,
      hora,
      concepto,
      deposito,
      casa,
      cuotaExtra,
      mantto,
      penalizacion,
      agua,
      rowNumber,
    });
  }

  /**
   * Parse date from various formats
   * Supports: ISO (YYYY-MM-DD), DD/MM/YYYY, DD/MM, Excel serial dates
   */
  private parseDate(value: any, rowNumber: number): Date {
    if (!value) {
      throw new Error(`FECHA es requerida`);
    }

    // Try parsing as Date object
    if (value instanceof Date) {
      return value;
    }

    // Try parsing as string
    const str = String(value).trim();

    // Try ISO format (YYYY-MM-DD)
    let date = new Date(str);
    if (!isNaN(date.getTime())) {
      return date;
    }

    // Try DD/MM/YYYY format
    const parts = str.split('/');
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
      const year = parseInt(parts[2], 10);
      date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Try DD/MM format (assume current year)
    if (parts.length === 2) {
      const day = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // JS months are 0-indexed
      const year = new Date().getFullYear();
      date = new Date(year, month, day);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Try Excel serial date number (days since 1900-01-01)
    const serialDate = parseFloat(str);
    if (!isNaN(serialDate)) {
      date = new Date((serialDate - 25569) * 86400 * 1000);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    throw new Error(`FECHA inválida: ${value}`);
  }

  /**
   * Parse time string into HH:MM:SS format
   */
  private parseTime(value: any): string {
    if (!value) {
      return '00:00:00';
    }

    const str = String(value).trim();

    // If already in HH:MM:SS or HH:MM format
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(str)) {
      return str.length === 5 ? `${str}:00` : str;
    }

    // Excel time serial (0.5 = 12:00:00)
    const serialTime = parseFloat(str);
    if (!isNaN(serialTime) && serialTime >= 0 && serialTime <= 1) {
      const totalSeconds = Math.round(serialTime * 86400);
      const hours = Math.floor(totalSeconds / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const seconds = totalSeconds % 60;
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    return str;
  }

  /**
   * Parse number with validation
   * @param value Value to parse
   * @param fieldName Name of the field (for error messages)
   * @param rowNumber Row number (for error messages)
   * @param allowZero Whether to allow 0 as a valid value
   */
  private parseNumber(
    value: any,
    fieldName: string,
    rowNumber: number,
    allowZero: boolean = false,
  ): number {
    if (value === null || value === undefined || value === '') {
      if (allowZero) {
        return 0;
      }
      throw new Error(`${fieldName} es requerido`);
    }

    const num = typeof value === 'number'
      ? value
      : parseFloat(String(value).replace(/,/g, ''));

    if (isNaN(num)) {
      throw new Error(`${fieldName} debe ser un número válido: ${value}`);
    }

    return num;
  }
}
