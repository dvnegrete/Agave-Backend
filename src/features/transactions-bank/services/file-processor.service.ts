import { Injectable, BadRequestException } from '@nestjs/common';
import * as XLSX from 'xlsx';
import { TransactionBank } from '../interfaces/transaction-bank.interface';
import { UploadFileDto } from '../dto/upload-file.dto';
import {
  getFileExtension,
  findHeaderRowIndex,
  splitCSVLine,
  bufferToString,
  parseAmountWithSign,
} from '../../../shared/common';
import { resolveBankStatementModel } from '../models/model-resolver';
import { BankStatementModel } from '../models/bank-statement-model.interface';

@Injectable()
export class FileProcessorService {
  async parseFile(
    file: Express.Multer.File,
    options?: UploadFileDto,
  ): Promise<TransactionBank[]> {
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
          throw new BadRequestException(
            `Formato de archivo no soportado: ${fileExtension}`,
          );
      }
    } catch (error: any) {
      throw new BadRequestException(
        `Error al procesar el archivo: ${error.message}`,
      );
    }
  }

  private parseCSV(
    content: string,
    options: UploadFileDto | undefined,
    model: BankStatementModel,
  ): TransactionBank[] {
    const lines = content.split('\n').filter((line) => line.trim());
    const transactions: TransactionBank[] = [];

    // Encontrar automáticamente la fila de encabezados
    const headerRowIndex = findHeaderRowIndex(lines, model.headerKeywords);
    const dataLines =
      headerRowIndex >= 0 ? lines.slice(headerRowIndex + 1) : lines;

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i].trim();
      if (!line) continue;

      try {
        const columns = splitCSVLine(line);
        const transaction = model.mapRowToTransaction(columns, options);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error: any) {
        console.warn(`Error en línea ${i + 1}: ${error.message}`);
      }
    }

    return transactions;
  }

  private parseXLSX(
    buffer: Buffer,
    options: UploadFileDto | undefined,
    model: BankStatementModel,
  ): TransactionBank[] {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    const transactions: TransactionBank[] = [];

    // Encontrar automáticamente la fila de encabezados
    const headerRowIndex = findHeaderRowIndex(
      data as unknown[][],
      model.headerKeywords,
    );
    const dataRows =
      headerRowIndex >= 0 ? data.slice(headerRowIndex + 1) : data;

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i] as any[];
      if (!row || !Array.isArray(row) || row.length === 0) continue;

      try {
        const transaction = model.mapRowToTransaction(row, options);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error: any) {
        console.warn(`Error en fila ${i + 1}: ${error.message}`);
      }
    }

    return transactions;
  }

  private parseTXT(
    content: string,
    options: UploadFileDto | undefined,
    model: BankStatementModel,
  ): TransactionBank[] {
    const lines = content.split('\n').filter((line) => line.trim());
    const transactions: TransactionBank[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      try {
        const transaction = model.mapTxtLine
          ? model.mapTxtLine(line, options)
          : this.parseGenericTxtLine(line, options);
        if (transaction) {
          transactions.push(transaction);
        }
      } catch (error: any) {
        console.warn(`Error en línea ${i + 1}: ${error.message}`);
      }
    }

    return transactions;
  }

  private parseGenericTxtLine(
    line: string,
    options?: UploadFileDto,
  ): TransactionBank | null {
    // Formato genérico: FECHA|HORA|CONCEPTO|MONTO|MONEDA|TIPO_DEPOSITO (true/false)
    const parts = line.split('|');
    if (parts.length < 6) {
      throw new Error(
        'Formato de línea inválido. Se requieren: fecha, hora, concepto, monto, moneda, tipo_deposito',
      );
    }
    const [dateStr, timeStr, concept, amountStr, currency, isDepositStr] =
      parts;

    // Handle negative amounts properly
    const amountResult = parseAmountWithSign(amountStr);
    const bool = isDepositStr.toLowerCase().trim();
    let isDeposit = ['true', '1', 'yes', 'si', 'sí'].includes(bool);

    // If no explicit deposit flag and amount is negative, treat as withdrawal
    if (
      !['true', '1', 'yes', 'si', 'sí', 'false', '0', 'no'].includes(bool) &&
      amountResult.isNegative
    ) {
      isDeposit = false;
    }

    // Determine bank name from options
    const bankName = options?.bankName || '';

    return {
      date: dateStr.trim(),
      time: timeStr.trim(),
      concept: concept.trim(),
      amount: amountResult.amount, // Always positive (absolute value)
      currency: currency.trim(),
      is_deposit: isDeposit,
      bank_name: bankName,
      validation_flag: false,
      status: 'pending',
    };
  }

  private parseJSON(
    content: string,
    options: UploadFileDto | undefined,
    model: BankStatementModel,
  ): TransactionBank[] {
    try {
      const data = JSON.parse(content);

      if (Array.isArray(data)) {
        return data.map((item) =>
          model.mapJsonItem ? model.mapJsonItem(item, options) : item,
        );
      } else if (data.transactions && Array.isArray(data.transactions)) {
        return data.transactions.map((item) =>
          model.mapJsonItem ? model.mapJsonItem(item, options) : item,
        );
      } else {
        throw new Error(
          'Formato JSON inválido: se esperaba un array o un objeto con propiedad "transactions"',
        );
      }
    } catch (error: any) {
      throw new Error(`Error al parsear JSON: ${error.message}`);
    }
  }
}
