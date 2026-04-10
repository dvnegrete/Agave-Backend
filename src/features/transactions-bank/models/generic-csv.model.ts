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
    // Índices dinámicos si hay columnMapping detectado por IA, hardcodeados como fallback.
    const mapping = options?.columnMapping;
    const fechaIdx    = mapping?.fechaIndex    ?? 0;
    const horaIdx     = mapping?.horaIndex     ?? 1;
    const conceptoIdx = mapping?.conceptoIndex ?? 3;
    const retiroIdx   = mapping?.retiroIndex   ?? 4;
    const depositoIdx = mapping?.depositoIndex ?? 5;

    const minRequired =
      Math.max(fechaIdx, horaIdx, conceptoIdx, retiroIdx, depositoIdx) + 1;

    if (row.length < minRequired) {
      throw new Error(
        `CSV debe tener al menos ${minRequired} columnas según el mapeo detectado`,
      );
    }

    const fecha = row[fechaIdx];
    const hora = row[horaIdx];

    // Parse-from-right: cuando el CONCEPTO contiene comas sin escapar, las columnas
    // se desplazan hacia la derecha (row.length > expectedColumnCount).
    // Se reconstruye el concepto uniendo las partes intermedias y se recalculan
    // RETIRO/DEPÓSITO desde la derecha usando trailingColumnsAfterDeposito.
    let concepto: unknown;
    let retiro: unknown;
    let deposito: unknown;

    if (mapping && row.length > mapping.expectedColumnCount) {
      const trailing = mapping.trailingColumnsAfterDeposito;
      deposito = row[row.length - trailing - 1];
      retiro = row[row.length - trailing - 2];
      concepto = (row as string[])
        .slice(conceptoIdx, row.length - trailing - 2)
        .join(', ');
    } else {
      concepto = row[conceptoIdx];
      retiro = row[retiroIdx];
      deposito = row[depositoIdx];
    }

    let amount = 0;
    let isDeposit = false;
    const currency = 'MXN'; // Siempre usar MXN como default

    // Determinar monto y tipo basado en RETIRO/DEPÓSITO
    const retiroStr = safeToString(retiro).trim();
    const depositoStr = safeToString(deposito).trim();
    // Valida que el valor sea numérico antes de interpretarlo como monto.
    // Previene que texto desplazado por comas sin comillas en el CONCEPTO
    // (ej: "casa 7") sea procesado como monto de RETIRO.
    const isNumericAmount = (str: string): boolean => /^-?[\d,.]+$/.test(str);

    if (retiroStr && retiroStr !== '0' && isNumericAmount(retiroStr)) {
      // Es un retiro
      const retiroResult = parseAmountWithSign(retiroStr);
      amount = retiroResult.amount;
      isDeposit = false;
    } else if (
      depositoStr &&
      depositoStr !== '0' &&
      isNumericAmount(depositoStr)
    ) {
      // Es un depósito
      const depositoResult = parseAmountWithSign(depositoStr);
      amount = depositoResult.amount;
      isDeposit = true;
    } else {
      throw new Error(
        'Debe tener un valor numérico en RETIRO o DEPÓSITO. ' +
        'Verifique que el CONCEPTO no contenga comas sin comillas.',
      );
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
