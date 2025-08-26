import { Injectable } from '@nestjs/common';
import { Transaction, TransactionValidationResult } from '../interfaces/transaction.interface';
import { REFERENCE_PATTERN } from '@/shared/common';

@Injectable()
export class TransactionValidatorService {
  private readonly MAX_AMOUNT = 1000000; // 1 millón
  private readonly MIN_AMOUNT = 0.01; // 1 centavo
  private readonly MAX_DESCRIPTION_LENGTH = 500;
  private readonly ACCOUNT_NUMBER_PATTERN = /^[0-9]{10,20}$/;
  private readonly REFERENCE_PATTERN = REFERENCE_PATTERN;

  async validateTransaction(transaction: Transaction): Promise<TransactionValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar fecha
    this.validateDate(transaction.date, errors);

    // Validar descripción
    this.validateDescription(transaction.description, errors, warnings);

    // Validar monto
    this.validateAmount(transaction.amount, errors, warnings);

    // Validar tipo de transacción
    this.validateTransactionType(transaction.type, errors);

    // Validar número de cuenta
    this.validateAccountNumber(transaction.accountNumber, errors, warnings);

    // Validar referencia
    if (transaction.reference) {
      this.validateReference(transaction.reference, errors, warnings);
    }

    // Validar categoría
    if (transaction.category) {
      this.validateCategory(transaction.category, warnings);
    }

    // Validaciones adicionales de negocio
    this.validateBusinessRules(transaction, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateDate(date: Date, errors: string[]): void {
    if (!date) {
      errors.push('Fecha es requerida');
      return;
    }

    if (isNaN(date.getTime())) {
      errors.push('Fecha inválida');
      return;
    }

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + 30); // 30 días en el futuro

    if (date > futureDate) {
      errors.push('La fecha no puede ser más de 30 días en el futuro');
    }

    const pastDate = new Date();
    pastDate.setFullYear(now.getFullYear() - 10); // 10 años en el pasado

    if (date < pastDate) {
      errors.push('La fecha no puede ser más de 10 años en el pasado');
    }
  }

  private validateDescription(description: string, errors: string[], warnings: string[]): void {
    if (!description || description.trim().length === 0) {
      errors.push('Descripción es requerida');
      return;
    }

    if (description.trim().length > this.MAX_DESCRIPTION_LENGTH) {
      errors.push(`La descripción no puede exceder ${this.MAX_DESCRIPTION_LENGTH} caracteres`);
    }

    if (description.trim().length < 3) {
      warnings.push('La descripción es muy corta');
    }

    // Verificar caracteres especiales sospechosos
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:text\/html/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(description)) {
        errors.push('La descripción contiene caracteres no permitidos');
        break;
      }
    }
  }

  private validateAmount(amount: number, errors: string[], warnings: string[]): void {
    if (typeof amount !== 'number' || isNaN(amount)) {
      errors.push('Monto debe ser un número válido');
      return;
    }

    if (amount < this.MIN_AMOUNT) {
      errors.push(`El monto mínimo es ${this.MIN_AMOUNT}`);
    }

    if (amount > this.MAX_AMOUNT) {
      errors.push(`El monto máximo es ${this.MAX_AMOUNT}`);
    }

    // Verificar si el monto es un número entero (sin decimales)
    if (amount % 1 === 0) {
      warnings.push('El monto no tiene decimales');
    }

    // Verificar montos sospechosos
    const suspiciousAmounts = [999999, 1000000, 0, 1];
    if (suspiciousAmounts.includes(amount)) {
      warnings.push('Monto sospechoso detectado');
    }
  }

  private validateTransactionType(type: string, errors: string[]): void {
    if (!type) {
      errors.push('Tipo de transacción es requerido');
      return;
    }

    if (!['credit', 'debit'].includes(type)) {
      errors.push('Tipo de transacción debe ser "credit" o "debit"');
    }
  }

  private validateAccountNumber(accountNumber: string, errors: string[], warnings: string[]): void {
    if (!accountNumber || accountNumber.trim().length === 0) {
      errors.push('Número de cuenta es requerido');
      return;
    }

    if (!this.ACCOUNT_NUMBER_PATTERN.test(accountNumber.trim())) {
      errors.push('Número de cuenta debe tener entre 10 y 20 dígitos numéricos');
    }

    // Verificar si es una cuenta de prueba
    const testAccounts = ['0000000000', '1111111111', '9999999999'];
    if (testAccounts.includes(accountNumber.trim())) {
      warnings.push('Cuenta de prueba detectada');
    }

    // Verificar dígitos repetidos
    if (/(\d)\1{9,}/.test(accountNumber)) {
      warnings.push('Número de cuenta con muchos dígitos repetidos');
    }
  }

  private validateReference(reference: string, errors: string[], warnings: string[]): void {
    if (!reference || reference.trim().length === 0) {
      return; // Referencia es opcional
    }

    if (!this.REFERENCE_PATTERN.test(reference.trim())) {
      errors.push('Referencia debe contener solo letras, números, guiones y guiones bajos (máximo 50 caracteres)');
    }

    if (reference.trim().length < 3) {
      warnings.push('Referencia muy corta');
    }
  }

  private validateCategory(category: string, warnings: string[]): void {
    if (!category || category.trim().length === 0) {
      return;
    }

    const validCategories = [
      'alimentacion', 'transporte', 'servicios', 'entretenimiento',
      'salud', 'educacion', 'vivienda', 'ropa', 'otros'
    ];

    if (!validCategories.includes(category.toLowerCase().trim())) {
      warnings.push('Categoría no reconocida');
    }
  }

  private validateBusinessRules(transaction: Transaction, errors: string[], warnings: string[]): void {
    // Regla: Transacciones de crédito muy grandes requieren atención especial
    if (transaction.type === 'credit' && transaction.amount > 100000) {
      warnings.push('Transacción de crédito de monto alto detectada');
    }

    // Regla: Transacciones de débito muy grandes requieren atención especial
    if (transaction.type === 'debit' && transaction.amount > 50000) {
      warnings.push('Transacción de débito de monto alto detectada');
    }

    // Regla: Verificar transacciones en horarios no comerciales
    const hour = transaction.date.getHours();
    if (hour < 6 || hour > 22) {
      warnings.push('Transacción fuera de horario comercial');
    }

    // Regla: Verificar transacciones en fines de semana
    const dayOfWeek = transaction.date.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      warnings.push('Transacción en fin de semana');
    }

    // Regla: Verificar descripciones sospechosas
    const suspiciousKeywords = [
      'test', 'prueba', 'demo', 'temporal', 'temp',
      'xxxxx', 'aaaaa', 'zzzzz', 'unknown', 'desconocido'
    ];

    const description = transaction.description.toLowerCase();
    for (const keyword of suspiciousKeywords) {
      if (description.includes(keyword)) {
        warnings.push('Descripción sospechosa detectada');
        break;
      }
    }
  }

  // Método para validar múltiples transacciones y detectar duplicados
  async validateBatch(transactions: Transaction[]): Promise<{
    duplicates: Transaction[];
    suspicious: Transaction[];
    valid: Transaction[];
  }> {
    const duplicates: Transaction[] = [];
    const suspicious: Transaction[] = [];
    const valid: Transaction[] = [];
    const seen = new Set<string>();

    for (const transaction of transactions) {
      const key = this.generateTransactionKey(transaction);
      
      if (seen.has(key)) {
        duplicates.push(transaction);
      } else {
        seen.add(key);
        
        const validation = await this.validateTransaction(transaction);
        if (validation.isValid) {
          if (validation.warnings.length > 0) {
            suspicious.push(transaction);
          } else {
            valid.push(transaction);
          }
        }
      }
    }

    return { duplicates, suspicious, valid };
  }

  private generateTransactionKey(transaction: Transaction): string {
    return `${transaction.date.toISOString().split('T')[0]}_${transaction.amount}_${transaction.accountNumber}_${transaction.description.substring(0, 20)}`;
  }
}
