import { BankStatementModel } from './bank-statement-model.interface';
import {
  parseAmountFlexible,
  parseBooleanFlexible,
  parseDateFlexible,
} from '../../../shared/common';

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

  mapRowToTransaction: (row) => {
    // Columnas esperadas: FECHA, HORA, CONCEPTO, RETIRO, DEPOSITO, MONEDA
    const [fecha, hora, concepto, retiro, deposito, moneda] = row;

    let amount = 0;
    let isDeposit = false;

    if (retiro && retiro !== '' && retiro !== 0) {
      amount = parseAmountFlexible(retiro.toString());
      isDeposit = false;
    } else if (deposito && deposito !== '' && deposito !== 0) {
      amount = parseAmountFlexible(deposito.toString());
      isDeposit = true;
    } else {
      throw new Error('Debe tener un valor en RETIRO o DEPOSITO');
    }

    let formattedDate = '';
    try {
      const parsedDate = parseDateFlexible(fecha || '');
      formattedDate = parsedDate.toISOString().split('T')[0];
    } catch (error: any) {
      // En caso de error, mantener valor original como string
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
      status: 'pending',
    };
  },

  mapJsonItem: (item: any) => {
    return {
      date: item.date || item.fecha || '',
      time: item.time || item.hora || '',
      concept: item.concept || item.concepto || '',
      amount: parseAmountFlexible(item.amount || item.monto || item.importe),
      currency: item.currency || item.moneda || 'MXN',
      is_deposit: parseBooleanFlexible(
        item.is_deposit || item.tipo_deposito || item.deposito,
      ),
      validation_flag: item.validation_flag || false,
      status: 'pending',
    };
  },
};
