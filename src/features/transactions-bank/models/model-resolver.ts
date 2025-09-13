import { BankStatementModel } from './bank-statement-model.interface';
import { SantanderXlsxModel } from './santander-xlsx.model';

const REGISTERED_MODELS: Record<string, BankStatementModel> = {
  [SantanderXlsxModel.name]: SantanderXlsxModel,
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

  if (
    (normalizedBank.includes('santander') || !normalizedBank) &&
    ext === 'xlsx'
  ) {
    return SantanderXlsxModel;
  }

  // 3) Fallback por defecto: SantanderXlsx
  return SantanderXlsxModel;
}
