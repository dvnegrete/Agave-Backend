import { BankStatementModel } from './bank-statement-model.interface';
import {
  parseAmountWithSign,
  parseBooleanFlexible,
} from '../../../shared/common';
import { parseContextualDate } from '../utils/date-parser';

const safeToString = (value: unknown): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[object]';
    }
  }
  // For other primitive types like symbol, bigint, etc.
  if (typeof value === 'function') {
    return '[function]';
  }
  if (typeof value === 'symbol') {
    return '[symbol]';
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return '';
};

export const GenericCsvModel: BankStatementModel = {
  name: 'GenericCsv',
  headerKeywords: [
    'fecha',
    'date',
    'hora',
    'time',
    'sucursal',
    'branch',
    'concepto',
    'concept',
    'retiro',
    'withdrawal',
    'deposito',
    'depósito',
    'deposit',
    'saldo',
    'balance',
  ],

  mapRowToTransaction: (row: unknown[], options?: any) => {
    // Formato específico esperado: FECHA,HORA,SUCURSAL,CONCEPTO,RETIRO,DEPÓSITO,SALDO
    // Solo procesamos: FECHA(0), HORA(1), CONCEPTO(3), RETIRO(4), DEPÓSITO(5)
    // Ignoramos: SUCURSAL(2), SALDO(6) y cualquier campo adicional

    if (row.length < 6) {
      throw new Error(
        'CSV debe tener al menos 6 columnas: FECHA,HORA,SUCURSAL,CONCEPTO,RETIRO,DEPÓSITO',
      );
    }

    // Mapear campos por posición específica
    const fecha = row[0]; // FECHA
    const hora = row[1]; // HORA
    // row[2] es SUCURSAL - ignoramos
    const concepto = row[3]; // CONCEPTO
    const retiro = row[4]; // RETIRO
    const deposito = row[5]; // DEPÓSITO
    // row[6] es SALDO - ignoramos

    let amount = 0;
    let isDeposit = false;
    const currency = 'MXN'; // Siempre usar MXN como default

    // Determinar monto y tipo basado en RETIRO/DEPÓSITO
    const retiroStr = safeToString(retiro).trim();
    const depositoStr = safeToString(deposito).trim();

    if (retiroStr && retiroStr !== '' && retiroStr !== '0') {
      // Es un retiro
      const retiroResult = parseAmountWithSign(retiroStr);
      amount = retiroResult.amount;
      isDeposit = false;
    } else if (depositoStr && depositoStr !== '' && depositoStr !== '0') {
      // Es un depósito
      const depositoResult = parseAmountWithSign(depositoStr);
      amount = depositoResult.amount;
      isDeposit = true;
    } else {
      throw new Error('Debe tener un valor en RETIRO o DEPÓSITO');
    }

    let formattedDate = '';
    try {
      // Use MM/DD format preference for CSV files
      const parsedDate = parseContextualDate(
        fecha ? safeToString(fecha) : '',
        'MM/DD',
      );
      formattedDate = parsedDate.toISOString().split('T')[0];
    } catch {
      // En caso de error, mantener valor original como string
      formattedDate = fecha ? safeToString(fecha).trim() : '';
    }

    // Determine bank name from options
    const bankName = options?.bank || options?.bankName || '';

    return {
      date: formattedDate,
      time: hora ? safeToString(hora).trim() : '',
      concept: concepto ? safeToString(concepto).trim() : '',
      amount,
      currency,
      is_deposit: isDeposit,
      bank_name: bankName,
      validation_flag: false,
      status: 'pending' as const,
    };
  },

  mapJsonItem: (item: Record<string, unknown>, options?: any) => {
    // Handle amount and determine transaction type
    let amount = 0;
    let isDeposit = false;

    // Check if explicit amount and type are provided
    if (item.amount || item.monto || item.importe) {
      const amountResult = parseAmountWithSign(
        (item.amount ?? item.monto ?? item.importe ?? 0) as string | number,
      );
      amount = amountResult.amount;

      // If explicit deposit flag is provided, use it
      if (
        item.is_deposit !== undefined ||
        item.tipo_deposito !== undefined ||
        item.deposito !== undefined
      ) {
        isDeposit = parseBooleanFlexible(
          item.is_deposit || item.tipo_deposito || item.deposito || false,
        );
      } else {
        // If no explicit flag, determine from amount sign
        isDeposit = !amountResult.isNegative;
      }
    } else {
      // Handle separate retiro/deposito columns
      if (item.retiro && item.retiro !== '' && item.retiro !== 0) {
        const retiroResult = parseAmountWithSign(
          item.retiro as string | number,
        );
        amount = retiroResult.amount;
        isDeposit = false;
      } else if (item.deposito && item.deposito !== '' && item.deposito !== 0) {
        const depositoResult = parseAmountWithSign(
          item.deposito as string | number,
        );
        amount = depositoResult.amount;
        isDeposit = true;
      } else {
        throw new Error(
          'Debe tener un valor en amount/monto/importe o en retiro/deposito',
        );
      }
    }

    // Determine bank name from options
    const bankName = options?.bank || options?.bankName || '';

    return {
      date: safeToString(item.date || item.fecha || ''),
      time: safeToString(item.time || item.hora || ''),
      concept: safeToString(item.concept || item.concepto || ''),
      amount,
      currency: safeToString(item.currency || item.moneda || 'MXN'),
      is_deposit: isDeposit,
      bank_name: bankName,
      validation_flag: Boolean(item.validation_flag) || false,
      status: 'pending' as const,
    };
  },
};

