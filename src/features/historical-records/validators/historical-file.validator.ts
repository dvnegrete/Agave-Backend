import { FileValidator } from '@nestjs/common';

/**
 * Validator for historical records Excel files
 * Ensures only .xlsx files with correct MIME type are accepted
 */
export class HistoricalFileValidator extends FileValidator<Record<string, any>> {
  constructor() {
    super({});
  }

  /**
   * Validate file extension and MIME type
   */
  isValid(file?: Express.Multer.File): boolean {
    if (!file) {
      return false;
    }

    // Validate file extension - only .xlsx allowed
    const allowedExtensions = ['.xlsx'];
    const fileExtension = file.originalname
      .toLowerCase()
      .substring(file.originalname.lastIndexOf('.'));

    if (!allowedExtensions.includes(fileExtension)) {
      return false;
    }

    // Validate MIME type
    const allowedMimeTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];

    if (!allowedMimeTypes.includes(file.mimetype)) {
      return false;
    }

    return true;
  }

  /**
   * Build error message for failed validation
   */
  buildErrorMessage(): string {
    return 'Solo se permiten archivos Excel (.xlsx)';
  }
}
