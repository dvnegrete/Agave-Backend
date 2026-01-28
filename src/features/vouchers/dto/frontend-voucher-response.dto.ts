export class ValidationResultDto {
  isValid: boolean;
  missingFields: string[];
  errors: Record<string, string>;
  warnings?: string[];
}

export class FrontendVoucherResponseDto {
  success: boolean;
  structuredData: any;
  validation: ValidationResultDto;
  gcsFilename: string | undefined;
  originalFilename: string;
  suggestions?: {
    casaDetectedFromCentavos: boolean;
    autoAssignedTime: boolean;
  };
}

export class ConfirmVoucherResponseDto {
  success: boolean;
  confirmationCode: string;
  voucher: {
    id: number;
    amount: number;
    date: string;
    casa: number;
    referencia: string;
    confirmation_status: boolean;
  };
}
