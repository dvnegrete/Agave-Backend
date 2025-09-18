import { BankStatementModel } from './bank-statement-model.interface';
import { SantanderXlsxModel } from './santander-xlsx.model';
import { GenericCsvModel } from './generic-csv.model';

const REGISTERED_MODELS: Record<string, BankStatementModel> = {
  [SantanderXlsxModel.name]: SantanderXlsxModel,
  [GenericCsvModel.name]: GenericCsvModel,
};

export function resolveBankStatementModel(
  modelName?: string,
  opts?: { bankName?: string; fileExtension?: string },
): BankStatementModel {
  // 1) Si se especifica por nombre explícito
  if (modelName && REGISTERED_MODELS[modelName]) {
    return REGISTERED_MODELS[modelName];
  }

  // 2) Heurística por banco/extensión (extensible)
  const normalizedBank = (opts?.bankName || '').toLowerCase();
  const ext = (opts?.fileExtension || '').toLowerCase();

  // For CSV files, use GenericCsvModel
  if (ext === 'csv') {
    return GenericCsvModel;
  }

  if (
    (normalizedBank.includes('santander') || !normalizedBank) &&
    ext === 'xlsx'
  ) {
    return SantanderXlsxModel;
  }

  // 3) Fallback por defecto: SantanderXlsx para XLSX, GenericCsv para CSV
  if (ext === 'csv') {
    return GenericCsvModel;
  }
  return SantanderXlsxModel;
}
