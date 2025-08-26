import { Injectable, BadRequestException } from '@nestjs/common';
import { Transaction } from '../interfaces/transaction.interface';
import { ProcessFileDto } from '../dto/process-file.dto';
import {
  getFileExtension,
  bufferToString,
  splitCSVLine,
  hasHeaderKeywords,
  parseAmountFlexible,
  parseDateFlexible,
} from '@/shared/common';

@Injectable()
export class FileProcessorService {
  async parseFile(file: Express.Multer.File, options?: ProcessFileDto): Promise<Transaction[]> {
    try {
      const fileExtension = getFileExtension(file.originalname);
      const fileContent = bufferToString(file.buffer, (options?.encoding as BufferEncoding) || 'utf-8');

      switch (fileExtension.toLowerCase()) {
        case 'csv':
          return this.parseCSV(fileContent, options);
        case 'txt':
          return this.parseTXT(fileContent, options);
        case 'json':
          return this.parseJSON(fileContent);
        case 'xml':
          return this.parseXML(fileContent);
        default:
          throw new BadRequestException(`Formato de archivo no soportado: ${fileExtension}`);
      }
    } catch (error) {
      throw new BadRequestException(`Error al procesar el archivo: ${error.message}`);
    }
  }

  private parseCSV(content: string, options?: ProcessFileDto): Transaction[] {
    const lines = content.split('\n').filter(line => line.trim());
    const transactions: Transaction[] = [];

    // Saltar la primera línea si es un encabezado
    const dataLines = hasHeaderKeywords(lines[0], ['fecha', 'date', 'descripcion', 'description', 'monto', 'amount', 'tipo', 'type'])
      ? lines.slice(1)
      : lines;

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

  private parseCSVLine(line: string, lineNumber: number, options?: ProcessFileDto): Transaction | null {
    const columns = splitCSVLine(line);
    
    if (columns.length < 4) {
      throw new Error('Número insuficiente de columnas');
    }

    const [dateStr, description, amountStr, type, accountNumber, reference, category] = columns;

    const date = parseDateFlexible(dateStr);
    const amount = parseAmountFlexible(amountStr);
    const transactionType = this.parseTransactionType(type);

    return {
      date,
      description: description.trim(),
      amount,
      type: transactionType,
      accountNumber: accountNumber?.trim() || '',
      reference: reference?.trim(),
      category: category?.trim(),
      status: 'pending',
    };
  }

  private parseTXT(content: string, options?: ProcessFileDto): Transaction[] {
    const lines = content.split('\n').filter(line => line.trim());
    const transactions: Transaction[] = [];

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

  private parseTXTLine(line: string, lineNumber: number, options?: ProcessFileDto): Transaction | null {
    // Asumir formato: FECHA|DESCRIPCION|MONTO|TIPO|CUENTA|REFERENCIA|CATEGORIA
    const parts = line.split('|');
    
    if (parts.length < 4) {
      throw new Error('Formato de línea inválido');
    }

    const [dateStr, description, amountStr, type, accountNumber, reference, category] = parts;

    const date = parseDateFlexible(dateStr);
    const amount = parseAmountFlexible(amountStr);
    const transactionType = this.parseTransactionType(type);

    return {
      date,
      description: description.trim(),
      amount,
      type: transactionType,
      accountNumber: accountNumber?.trim() || '',
      reference: reference?.trim(),
      category: category?.trim(),
      status: 'pending',
    };
  }

  private parseJSON(content: string): Transaction[] {
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

  private mapJSONToTransaction(item: any): Transaction {
    return {
      date: new Date(item.date || item.fecha || item.fecha_transaccion),
      description: item.description || item.descripcion || item.concepto || '',
      amount: parseAmountFlexible(item.amount || item.monto || item.importe),
      type: this.parseTransactionType(item.type || item.tipo),
      accountNumber: item.accountNumber || item.numero_cuenta || item.cuenta || '',
      reference: item.reference || item.referencia,
      category: item.category || item.categoria,
      status: 'pending',
    };
  }

  private parseXML(content: string): Transaction[] {
    // Implementación básica para XML
    // En una implementación real, usarías una librería como xml2js
    throw new Error('Parseo de XML no implementado aún');
  }

  private parseTransactionType(typeStr: string): 'credit' | 'debit' {
    if (!typeStr) {
      throw new Error('Tipo de transacción requerido');
    }

    const lowerType = typeStr.toLowerCase().trim();
    
    if (['credit', 'credito', 'c', 'ingreso', 'deposito'].includes(lowerType)) {
      return 'credit';
    } else if (['debit', 'debito', 'd', 'gasto', 'retiro'].includes(lowerType)) {
      return 'debit';
    } else {
      throw new Error(`Tipo de transacción inválido: ${typeStr}`);
    }
  }
}
