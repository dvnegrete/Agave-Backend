export interface VouchersBusinessRules {
  maxCasas: number;
  minCasas: number;
}

export interface BusinessRulesConfig {
  vouchers: VouchersBusinessRules;
}

export const businessRulesConfig: BusinessRulesConfig = {
  vouchers: {
    maxCasas: 66,
    minCasas: 1,
  },
};

export const getVouchersBusinessRules = (): VouchersBusinessRules => {
  return businessRulesConfig.vouchers;
};
