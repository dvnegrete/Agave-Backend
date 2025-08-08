import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { TransactionBank } from '../interfaces/bank-transaction.interface';
import { UploadFileDto } from '../dto/upload-file.dto';
import { getFileExtension, hasHeaderKeywords, splitCSVLine, bufferToString } from '../../common';
import { resolveBankStatementModel } from '../models/model-resolver';
import { BankStatementModel } from '../models/bank-statement-model.interface';

@Injectable()
export class FileProcessorService {
  async parseFile(file: Express.Multer.File, options?: UploadFileDto): Promise<TransactionBank[]> {
    try {
      const fileExtension = getFileExtension(file.originalname);
      const model = resolveBankStatementModel(options?.model, {
        bankName: options?.bankName,
        fileExtension,
      });
      const fileContent = bufferToString(file.buffer, 'utf-8');

      switch (fileExtension.toLowerCase()) {
        case 'csv':
          return this.parseCSV(fileContent, options, model);
        case 'xlsx':
          return this.parseXLSX(file.buffer, options, model);
        case 'txt':
          return this.parseTXT(fileContent, options, model);
        case 'json':
          return this.parseJSON(fileContent, options, model);
        default:
          throw new BadRequestException(`Formato de archivo no soportado: ${fileExtension}`);
      }
    } catch (error) {
      throw new BadRequestException(`Error al procesar el archivo: ${error.message}`);
    }
  }

  private parseCSV(content: string, options: UploadFileDto | undefined, model: BankStatementModel): TransactionBank[] {
    const lines = content.split('\n').filter(line => line.trim());
    const transactions: TransactionBank[] = [];

    // Saltar la primera línea si es un encabezado segun el modelo
    const hasHeaderRow = hasHeaderKeywords(lines[0], model.headerKeywords);
    const dataLines = hasHeaderRow ? lines.slice(1) : lines;

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue;

      try {
        const columns = splitCSVLine(line);
        const transaction = model.mapRowToTransaction(columns, options);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        console.warn(`Error en línea ${i + 1}: ${error.message}`);
      }
    }

    return transactions;
  }

  private parseXLSX(buffer: Buffer, options: UploadFileDto | undefined, model: BankStatementModel): TransactionBank[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    const transactions: TransactionBank[] = [];
    
    // Saltar encabezado si existe, segun el modelo
    const hasHeaderRow = hasHeaderKeywords(data[0], model.headerKeywords);
    const dataRows = hasHeaderRow ? data.slice(1) : data;
    
    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      if (!row || row.length === 0) continue;
      
      try {
        const transaction = model.mapRowToTransaction(row, options);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        console.warn(`Error en fila ${i + 1}: ${error.message}`);
      }
    }
    
    return transactions;
  }

  private parseTXT(content: string, options: UploadFileDto | undefined, model: BankStatementModel): TransactionBank[] {
    const lines = content.split('\n').filter(line => line.trim());
    const transactions: TransactionBank[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const transaction = model.mapTxtLine ? model.mapTxtLine(line, options) : this.parseGenericTxtLine(line);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error) {
        console.warn(`Error en línea ${i + 1}: ${error.message}`);
      }
    }

    return transactions;
  }

  private parseGenericTxtLine(line: string): TransactionBank | null {
    // Formato genérico: FECHA|HORA|CONCEPTO|MONTO|MONEDA|TIPO_DEPOSITO (true/false)
    const parts = line.split('|');
    if (parts.length < 6) {
      throw new Error('Formato de línea inválido. Se requieren: fecha, hora, concepto, monto, moneda, tipo_deposito');
    }
    const [dateStr, timeStr, concept, amountStr, currency, isDepositStr] = parts;
    const amount = Number(amountStr.replace(/[^\d.,-]/g, '').replace(',', '.'));
    const bool = isDepositStr.toLowerCase().trim();
    const isDeposit = ['true', '1', 'yes', 'si', 'sí'].includes(bool);
    return {
      date: dateStr.trim(),
      time: timeStr.trim(),
      concept: concept.trim(),
      amount: isNaN(amount) ? 0 : amount,
      currency: currency.trim(),
      is_deposit: isDeposit,
      validation_flag: false,
      status: 'pending',
    };
  }

  private parseJSON(content: string, options: UploadFileDto | undefined, model: BankStatementModel): TransactionBank[] {
    try {
      const data = JSON.parse(content);
      
      if (Array.isArray(data)) {
        return data.map(item => (model.mapJsonItem ? model.mapJsonItem(item, options) : item));
      } else if (data.transactions && Array.isArray(data.transactions)) {
        return data.transactions.map(item => (model.mapJsonItem ? model.mapJsonItem(item, options) : item));
      } else {
        throw new Error('Formato JSON inválido: se esperaba un array o un objeto con propiedad "transactions"');
      }
    } catch (error) {
      throw new Error(`Error al parsear JSON: ${error.message}`);
    }
  }

}
