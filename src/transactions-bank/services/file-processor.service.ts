import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { TransactionBank } from '../interfaces/bank-transaction.interface';
import { UploadFileDto } from '../dto/upload-file.dto';

@Injectable()
export class FileProcessorService {
  async parseFile(file: Express.Multer.File, options?: UploadFileDto): Promise<TransactionBank[]> {
    try {
      const fileExtension = this.getFileExtension(file.originalname);
      const fileContent = file.buffer.toString('utf-8');

      switch (fileExtension.toLowerCase()) {
        case 'csv':
          return this.parseCSV(fileContent, options);
        case 'xlsx':
          return this.parseXLSX(file.buffer, options);
        case 'txt':
          return this.parseTXT(fileContent, options);
        case 'json':
          return this.parseJSON(fileContent);
        default:
          throw new BadRequestException(`Formato de archivo no soportado: ${fileExtension}`);
      }
    } catch (error) {
      throw new BadRequestException(`Error al procesar el archivo: ${error.message}`);
    }
  }

  private parseCSV(content: string, options?: UploadFileDto): TransactionBank[] {
    const lines = content.split('\n').filter(line => line.trim());
    const transactions: TransactionBank[] = [];

    // Saltar la primera línea si es un encabezado
    const hasHeaderRow = this.hasHeader(lines[0]);
    const dataLines = hasHeaderRow ? lines.slice(1) : lines;

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue;

      try {
        const transaction = this.parseCSVLine(line, i + 1, options);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        console.warn(`Error en línea ${i + 1}: ${error.message}`);
      }
    }

    return transactions;
  }

  private parseCSVLine(line: string, lineNumber: number, options?: UploadFileDto): TransactionBank | null {
    const columns = this.splitCSVLine(line);
    
    if (columns.length < 6) {
      throw new Error(`Número insuficiente de columnas. Se requieren: FECHA, HORA, CONCEPTO, RETIRO, DEPOSITO, MONEDA. Encontradas: ${columns.length}`);
    }

    // Columnas: FECHA, HORA, CONCEPTO, RETIRO, DEPOSITO, MONEDA
    const [fecha, hora, concepto, retiro, deposito, moneda] = columns;

    // Determinar si es depósito o retiro y el monto
    let amount = 0;
    let isDeposit = false;

    if (retiro && retiro !== '' && retiro !== '0') {
      amount = this.parseAmount(retiro);
      isDeposit = false;
    } else if (deposito && deposito !== '' && deposito !== '0') {
      amount = this.parseAmount(deposito);
      isDeposit = true;
    } else {
      throw new Error('Debe tener un valor en RETIRO o DEPOSITO');
    }

    // Parsear y formatear la fecha
    let formattedDate = '';
    try {
      const parsedDate = this.parseDate(fecha.trim());
      formattedDate = parsedDate.toISOString().split('T')[0]; // Formato YYYY-MM-DD
    } catch (error) {
      console.warn(`Error parseando fecha '${fecha}': ${error.message}`);
      formattedDate = fecha.trim();
    }

    return {
      date: formattedDate,
      time: hora.trim(),
      concept: concepto.trim(),
      amount,
      currency: moneda.trim(),
      is_deposit: isDeposit,
      validation_flag: false,
      status: 'pending' as const,
    };
  }

  private parseXLSX(buffer: Buffer, options?: UploadFileDto): TransactionBank[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    const transactions: TransactionBank[] = [];
    
    // Saltar encabezado si existe
    const hasHeaderRow = this.hasHeader(data[0]);
    const dataRows = hasHeaderRow ? data.slice(1) : data;
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length < 6) continue;
      
      try {
        const transaction = this.parseXLSXRow(row, i + 1, options);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        console.warn(`Error en fila ${i + 1}: ${error.message}`);
      }
    }
    
    return transactions;
  }

  private parseXLSXRow(row: any[], rowNumber: number, options?: UploadFileDto): TransactionBank | null {
    // Columnas: FECHA, HORA, CONCEPTO, RETIRO, DEPOSITO, MONEDA
    const [fecha, hora, concepto, retiro, deposito, moneda] = row;

    // Determinar si es depósito o retiro y el monto
    let amount = 0;
    let isDeposit = false;

    if (retiro && retiro !== '' && retiro !== 0) {
      amount = this.parseAmount(retiro.toString());
      isDeposit = false;
    } else if (deposito && deposito !== '' && deposito !== 0) {
      amount = this.parseAmount(deposito.toString());
      isDeposit = true;
    } else {
      throw new Error('Debe tener un valor en RETIRO o DEPOSITO');
    }

    // Parsear y formatear la fecha
    let formattedDate = '';
    try {
      const parsedDate = this.parseDate(fecha || '');
      formattedDate = parsedDate.toISOString().split('T')[0]; // Formato YYYY-MM-DD
    } catch (error) {
      console.warn(`Error parseando fecha '${fecha}': ${error.message}`);
      formattedDate = fecha?.toString().trim() || '';
    }

    return {
      date: formattedDate,
      time: hora?.toString().trim() || '',
      concept: concepto?.toString().trim() || '',
      amount,
      currency: moneda?.toString().trim() || 'MXN',
      is_deposit: isDeposit,
      validation_flag: false,
      status: 'pending' as const,
    };
  }

  private parseTXT(content: string, options?: UploadFileDto): TransactionBank[] {
    const lines = content.split('\n').filter(line => line.trim());
    const transactions: TransactionBank[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const transaction = this.parseTXTLine(line, i + 1, options);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        console.warn(`Error en línea ${i + 1}: ${error.message}`);
      }
    }

    return transactions;
  }

  private parseTXTLine(line: string, lineNumber: number, options?: UploadFileDto): TransactionBank | null {
    // Asumir formato: FECHA|HORA|CONCEPTO|MONTO|MONEDA|TIPO_DEPOSITO
    const parts = line.split('|');
    
    if (parts.length < 6) {
      throw new Error('Formato de línea inválido. Se requieren: fecha, hora, concepto, monto, moneda, tipo_deposito');
    }

    const [dateStr, timeStr, concept, amountStr, currency, isDepositStr] = parts;

    const amount = this.parseAmount(amountStr);
    const isDeposit = this.parseIsDeposit(isDepositStr);

    return {
      date: dateStr.trim(),
      time: timeStr.trim(),
      concept: concept.trim(),
      amount,
      currency: currency.trim(),
      is_deposit: isDeposit,
      validation_flag: false,
      status: 'pending',
    };
  }

  private parseJSON(content: string): TransactionBank[] {
    try {
      const data = JSON.parse(content);
      
      if (Array.isArray(data)) {
        return data.map(item => this.mapJSONToTransaction(item));
      } else if (data.transactions && Array.isArray(data.transactions)) {
        return data.transactions.map(item => this.mapJSONToTransaction(item));
      } else {
        throw new Error('Formato JSON inválido: se esperaba un array o un objeto con propiedad "transactions"');
      }
    } catch (error) {
      throw new Error(`Error al parsear JSON: ${error.message}`);
    }
  }

  private mapJSONToTransaction(item: any): TransactionBank {
    return {
      date: item.date || item.fecha || '',
      time: item.time || item.hora || '',
      concept: item.concept || item.concepto || '',
      amount: this.parseAmount(item.amount || item.monto || item.importe),
      currency: item.currency || item.moneda || 'MXN',
      is_deposit: this.parseIsDeposit(item.is_deposit || item.tipo_deposito || item.deposito),
      validation_flag: item.validation_flag || false,
      status: 'pending',
    };
  }

  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? parts[parts.length - 1] : '';
  }

  private hasHeader(line: any): boolean {
    if (Array.isArray(line)) {
      const headerKeywords = ['fecha', 'date', 'hora', 'time', 'concepto', 'concept', 'retiro', 'withdrawal', 'deposito', 'deposit', 'moneda', 'currency'];
      const lowerLine = line.map(cell => cell?.toString().toLowerCase() || '');
      return headerKeywords.some(keyword => lowerLine.some(cell => cell.includes(keyword)));
    } else if (typeof line === 'string') {
      const headerKeywords = ['fecha', 'date', 'hora', 'time', 'concepto', 'concept', 'retiro', 'withdrawal', 'deposito', 'deposit', 'moneda', 'currency'];
      const lowerLine = line.toLowerCase();
      return headerKeywords.some(keyword => lowerLine.includes(keyword));
    }
    return false;
  }

  private splitCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  private parseDate(dateStr: string | Date, format?: string): Date {
    if (!dateStr) {
      throw new Error('Fecha requerida');
    }

    // Si ya es un objeto Date, devolverlo directamente
    if (dateStr instanceof Date) {
      return dateStr;
    }

    // Intentar parsear formato DD/MMM/YY (ej: 31/jul/25)
    const spanishMonthPattern = /^(\d{1,2})\/(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\/(\d{2,4})$/i;
    const match = dateStr.trim().toLowerCase().match(spanishMonthPattern);
    
    if (match) {
      const [, day, month, year] = match;
      const monthMap: { [key: string]: number } = {
        'ene': 0, 'feb': 1, 'mar': 2, 'abr': 3, 'may': 4, 'jun': 5,
        'jul': 6, 'ago': 7, 'sep': 8, 'oct': 9, 'nov': 10, 'dic': 11
      };
      
      const monthIndex = monthMap[month];
      const dayNum = parseInt(day, 10);
      const yearNum = parseInt(year, 10);
      
      // Ajustar año si es de 2 dígitos
      const fullYear = yearNum < 100 ? 2000 + yearNum : yearNum;
      
      const date = new Date(fullYear, monthIndex, dayNum);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Intentar parsear formato DD/MM/YYYY o DD/MM/YY
    const datePattern = /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/;
    const dateMatch = dateStr.trim().match(datePattern);
    
    if (dateMatch) {
      const [, day, month, year] = dateMatch;
      const dayNum = parseInt(day, 10);
      const monthNum = parseInt(month, 10) - 1; // Meses en JS van de 0-11
      const yearNum = parseInt(year, 10);
      
      // Ajustar año si es de 2 dígitos
      const fullYear = yearNum < 100 ? 2000 + yearNum : yearNum;
      
      const date = new Date(fullYear, monthNum, dayNum);
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Intentar parsear formato YYYY-MM-DD
    const isoPattern = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
    const isoMatch = dateStr.trim().match(isoPattern);
    
    if (isoMatch) {
      const [, year, month, day] = isoMatch;
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      if (!isNaN(date.getTime())) {
        return date;
      }
    }

    // Intentar parsear con Date nativo
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
      return date;
    }

    throw new Error(`Formato de fecha inválido: ${dateStr}`);
  }

  private parseAmount(amountStr: string | number): number {
    if (amountStr === null || amountStr === undefined || amountStr === '') {
      throw new Error('Monto requerido');
    }

    // Si ya es un número, devolverlo directamente
    if (typeof amountStr === 'number') {
      return amountStr;
    }

    // Convertir a string si no lo es
    const strAmount = amountStr.toString();

    // Remover caracteres no numéricos excepto punto y coma
    const cleanAmount = strAmount.replace(/[^\d.,-]/g, '');
    
    const amount = parseFloat(cleanAmount.replace(',', '.'));

    if (isNaN(amount)) {
      throw new Error(`Monto inválido: ${amountStr}`);
    }

    return amount;
  }

  private parseIsDeposit(isDepositStr: string): boolean {
    if (!isDepositStr) {
      throw new Error('Tipo de depósito requerido');
    }

    const lowerValue = isDepositStr.toLowerCase().trim();
    
    if (['true', '1', 'yes', 'si', 'deposit', 'deposito', 'ingreso', 'abono'].includes(lowerValue)) {
      return true;
    } else if (['false', '0', 'no', 'withdrawal', 'retiro', 'gasto', 'cargo'].includes(lowerValue)) {
      return false;
    } else {
      throw new Error(`Valor de depósito inválido: ${isDepositStr}`);
    }
  }
}
