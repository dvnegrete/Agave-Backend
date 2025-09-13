import { FileValidator } from '@nestjs/common';

export interface BankFileValidatorOptions {
  allowedExtensions?: string[];
  allowedMimeTypes?: string[];
}

export class BankFileValidator extends FileValidator<BankFileValidatorOptions> {
  constructor(options: BankFileValidatorOptions) {
    super(options);
  }

  public isValid(file?: Express.Multer.File): boolean {
    if (!file) {
      return false;
    }

    const { allowedExtensions = [], allowedMimeTypes = [] } = this.validationOptions;

    // Validar extensión de archivo
    const fileExtension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf('.'));

    const isValidExtension = allowedExtensions.length === 0 || 
      allowedExtensions.includes(fileExtension);

    // Validar tipo MIME
    const isValidMimeType = allowedMimeTypes.length === 0 || 
      allowedMimeTypes.includes(file.mimetype);

    return isValidExtension && isValidMimeType;
  }

  public buildErrorMessage(): string {
    const { allowedExtensions = [], allowedMimeTypes = [] } = this.validationOptions;
    
    let message = 'Tipo de archivo no soportado.';
    
    if (allowedExtensions.length > 0) {
      message += ` Extensiones permitidas: ${allowedExtensions.join(', ')}.`;
    }
    
    if (allowedMimeTypes.length > 0) {
      message += ` Tipos MIME permitidos: ${allowedMimeTypes.join(', ')}.`;
    }
    
    return message;
  }
}