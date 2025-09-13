import { BankStatementModel } from './bank-statement-model.interface';
import {
  parseAmountWithSign,
  parseBooleanFlexible,
  parseDateFlexible,
} from '../../../shared/common';

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

export const SantanderXlsxModel: BankStatementModel = {
  name: 'SantanderXlsx',
  headerKeywords: [
    'fecha',
    'date',
    'hora',
    'time',
    'concepto',
    'concept',
    'retiro',
    'withdrawal',
    'deposito',
    'deposit',
    'moneda',
    'currency',
  ],

  mapRowToTransaction: (row: unknown[], options?: any) => {
    // Columnas esperadas: FECHA, HORA, CONCEPTO, RETIRO, DEPOSITO, MONEDA
    const [fecha, hora, concepto, retiro, deposito, moneda] = row as [
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
      unknown,
    ];

    let amount = 0;
    let isDeposit = false;

    if (retiro && retiro !== '' && retiro !== 0) {
      const retiroResult = parseAmountWithSign(safeToString(retiro));
      amount = retiroResult.amount; // Always positive (absolute value)
      isDeposit = false; // Withdrawals are not deposits
    } else if (deposito && deposito !== '' && deposito !== 0) {
      const depositoResult = parseAmountWithSign(safeToString(deposito));
      amount = depositoResult.amount; // Always positive (absolute value)
      isDeposit = true; // Deposits are deposits
    } else {
      throw new Error('Debe tener un valor en RETIRO o DEPOSITO');
    }

    let formattedDate = '';
    try {
      const parsedDate = parseDateFlexible(fecha ? safeToString(fecha) : '');
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
      currency: moneda ? safeToString(moneda).trim() : 'MXN',
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
