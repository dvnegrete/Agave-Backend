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

    // Parse DEPOSITO (keep decimals for cent-based house identification)
    // IMPORTANT: Do NOT round. Decimals are used to identify house via cents.
    // Validation uses floor(DEPOSITO) for comparison, not rounded value.
    const deposito = this.parseNumber(getValue('DEPOSITO'), 'DEPOSITO', rowNumber);

    // Parse Casa (use round for house number)
    const casa = Math.round(this.parseNumber(getValue('Casa'), 'Casa', rowNumber, true) || 0);

    // Parse cta_* amounts (allow 0 or missing, FLOOR to integers - NOT round)
    // cta_* amounts must always be integers per business rules
    // CRITICAL: Use Math.floor() NOT Math.round()
    // Reason: decimals in Excel are carried from DEPOSITO cents for house identification
    // floor(DEPOSITO) must equal sum(cta_*) where cta_* are floored values
    // Example: DEPOSITO=850.51, agua=250.51 → floor(850.51)=850, floor(250.51)=250
    const cuotaExtra = Math.floor(this.parseNumber(getValue('Cuota Extra'), 'Cuota Extra', rowNumber, true) || 0);
    const mantto = Math.floor(this.parseNumber(getValue('Mantto'), 'Mantto', rowNumber, true) || 0);
    const penalizacion = Math.floor(this.parseNumber(getValue('Penalizacion'), 'Penalizacion', rowNumber, true) || 0);
    const agua = Math.floor(this.parseNumber(getValue('Agua'), 'Agua', rowNumber, true) || 0);

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
   * Supports various formats: 850, 850.00, $850.00, $850,00, 1,000.00, $1,000.00, $1,050
   * Intelligently detects decimal vs thousands separators
   * CRITICAL: Uses parseFloat() which NEVER rounds. For exact integer values, caller must round.
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

    let num: number;

    if (typeof value === 'number') {
      // If already a number, use it as-is (no rounding)
      num = value;
    } else {
      // Convert to string and remove currency formatting
      let str = String(value)
        .trim()
        .replace(/\$/g, '') // Remove dollar sign
        .replace(/\s/g, ''); // Remove spaces

      // Intelligently detect decimal separator vs thousands separator
      str = this.normalizeNumberString(str);

      // parseFloat NEVER rounds - it preserves all decimal places
      num = parseFloat(str);
    }

    if (isNaN(num)) {
      throw new Error(`${fieldName} debe ser un número válido: ${value}`);
    }

    // CRITICAL: Return raw number without any rounding
    // Caller must use Math.round() if integer is needed, or Math.floor() to truncate
    return num;
  }

  /**
   * Normalize number string by detecting decimal vs thousands separators
   * Examples:
   * - "1,050" → "1050" (comma is thousands separator, no decimals)
   * - "1,050.00" → "1050.00" (comma is thousands, dot is decimal)
   * - "1,050,00" → "1050.00" (comma is decimal, other commas are thousands)
   * - "1.050" → "1050" (dot is thousands separator, no decimals)
   * - "1.050,00" → "1050.00" (dot is thousands, comma is decimal)
   */
  private normalizeNumberString(str: string): string {
    // Count occurrences of dots and commas
    const dotCount = (str.match(/\./g) || []).length;
    const commaCount = (str.match(/,/g) || []).length;

    // No separators
    if (dotCount === 0 && commaCount === 0) {
      return str;
    }

    // Only one separator
    if (dotCount + commaCount === 1) {
      const lastSeparatorIndex = Math.max(str.lastIndexOf('.'), str.lastIndexOf(','));
      const digitsAfter = str.length - lastSeparatorIndex - 1;

      // If there are 1-3 digits after the separator, it's likely decimal
      if (digitsAfter >= 1 && digitsAfter <= 3) {
        // Convert to standard decimal (dot)
        return str.replace(/,/g, '.');
      } else {
        // It's a thousands separator, remove it
        return str.replace(/[.,]/g, '');
      }
    }

    // Multiple separators - determine which is decimal based on position
    const lastDotIndex = str.lastIndexOf('.');
    const lastCommaIndex = str.lastIndexOf(',');
    const lastSeparatorIndex = Math.max(lastDotIndex, lastCommaIndex);
    const digitsAfter = str.length - lastSeparatorIndex - 1;

    // The last separator is decimal if there are 1-3 digits after it
    if (digitsAfter >= 1 && digitsAfter <= 3) {
      // Last separator is decimal
      if (lastSeparatorIndex === lastCommaIndex) {
        // Last separator is comma (decimal), remove other separators and convert comma to dot
        return str.replace(/\./g, '').replace(/,/, '.');
      } else {
        // Last separator is dot (decimal), remove other separators
        return str.replace(/,/g, '');
      }
    } else {
      // Last separator is thousands, remove all separators
      return str.replace(/[.,]/g, '');
    }
  }
}
