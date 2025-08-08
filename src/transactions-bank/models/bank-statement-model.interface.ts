import { TransactionBank } from '../interfaces/bank-transaction.interface';
import { UploadFileDto } from '../dto/upload-file.dto';

export interface BankStatementModel {
  /** Nombre del modelo (identificador) */
  name: string;

  /** Palabras clave para detectar encabezados en CSV/XLSX */
  headerKeywords: string[];

  /** Mapea una fila (CSV/XLSX) a la entidad de dominio */
  mapRowToTransaction(row: any[], options?: UploadFileDto): TransactionBank | null;

  /** Opcional: mapea una línea TXT al dominio */
  mapTxtLine?: (line: string, options?: UploadFileDto) => TransactionBank | null;

  /** Opcional: mapea un item JSON al dominio */
  mapJsonItem?: (item: any, options?: UploadFileDto) => TransactionBank;
}


