/**
 * ⚠️ IMPORTANTE: Constantes centralizadas para número de casa del sistema
 */
export const MIN_HOUSE_NUMBER = 1;
export const MAX_HOUSE_NUMBER = 66;

export interface VouchersBusinessRules {
  maxCasas: number;
  minCasas: number;
}

export interface BusinessRulesConfig {
  vouchers: VouchersBusinessRules;
}

export const businessRulesConfig: BusinessRulesConfig = {
  vouchers: {
    maxCasas: MAX_HOUSE_NUMBER,
    minCasas: MIN_HOUSE_NUMBER,
  },
};

export const getVouchersBusinessRules = (): VouchersBusinessRules => {
  return businessRulesConfig.vouchers;
};
