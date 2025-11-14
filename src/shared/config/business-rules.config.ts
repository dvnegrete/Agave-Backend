/**
 * ⚠️ Constantes centralizadas para reglas de negocio del sistema
 * Fuente única de verdad para todas las reglas de negocio
 */

// Rango válido de números de casa (condominio de 1 a 66 propiedades)
export const MIN_HOUSE_NUMBER = 1 as const;
export const MAX_HOUSE_NUMBER = 66 as const;

export interface VouchersBusinessRules {
  maxCasas: number;
  minCasas: number;
}

export interface BusinessRulesConfig {
  vouchers: VouchersBusinessRules;
  houses: {
    min: typeof MIN_HOUSE_NUMBER;
    max: typeof MAX_HOUSE_NUMBER;
  };
}

export const businessRulesConfig: BusinessRulesConfig = {
  houses: {
    min: MIN_HOUSE_NUMBER,
    max: MAX_HOUSE_NUMBER,
  },
  vouchers: {
    maxCasas: MAX_HOUSE_NUMBER,
    minCasas: MIN_HOUSE_NUMBER,
  },
};

export const getVouchersBusinessRules = (): VouchersBusinessRules => {
  return businessRulesConfig.vouchers;
};
