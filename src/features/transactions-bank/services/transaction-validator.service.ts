import { Injectable } from '@nestjs/common';
import { TransactionBank, BankTransactionValidationResult } from '../interfaces/transaction-bank.interface';
import { TIME_PATTERN, DATE_ISO_PATTERN, CURRENCY_CODE_PATTERN } from '../../../shared/common';

@Injectable()
export class TransactionValidatorService {
  private readonly MAX_AMOUNT = 10000000; // 10 millones
  private readonly MIN_AMOUNT = 0.01; // 1 centavo
  private readonly MAX_CONCEPT_LENGTH = 500;
  private readonly DATE_PATTERN = DATE_ISO_PATTERN;
  private readonly TIME_PATTERN = TIME_PATTERN;
  private readonly CURRENCY_PATTERN = CURRENCY_CODE_PATTERN;

  async validateTransaction(transaction: TransactionBank): Promise<BankTransactionValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Validar fecha
    this.validateDate(transaction.date, errors);

    // Validar hora
    this.validateTime(transaction.time, errors);

    // Validar concepto
    this.validateConcept(transaction.concept, errors, warnings);

    // Validar monto
    this.validateAmount(transaction.amount, errors, warnings);

    // Validar moneda
    this.validateCurrency(transaction.currency, errors);

    // Validar tipo de depósito
    this.validateIsDeposit(transaction.is_deposit, errors);

    // Validaciones adicionales de negocio
    this.validateBusinessRules(transaction, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateDate(date: string, errors: string[]): void {
    if (!date || date.trim().length === 0) {
      errors.push('Fecha es requerida');
      return;
    }

    if (!this.DATE_PATTERN.test(date.trim())) {
      errors.push('Formato de fecha inválido. Use YYYY-MM-DD');
      return;
    }

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      errors.push('Fecha inválida');
      return;
    }

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + 30); // 30 días en el futuro

    if (dateObj > futureDate) {
      errors.push('La fecha no puede ser más de 30 días en el futuro');
    }

    const pastDate = new Date();
    pastDate.setFullYear(now.getFullYear() - 10); // 10 años en el pasado

    if (dateObj < pastDate) {
      errors.push('La fecha no puede ser más de 10 años en el pasado');
    }
  }

  private validateTime(time: string, errors: string[]): void {
    if (!time || time.trim().length === 0) {
      errors.push('Hora es requerida');
      return;
    }

    if (!this.TIME_PATTERN.test(time.trim())) {
      errors.push('Formato de hora inválido. Use HH:MM:SS');
    }
  }

  private validateConcept(concept: string, errors: string[], warnings: string[]): void {
    if (!concept || concept.trim().length === 0) {
      errors.push('Concepto es requerido');
      return;
    }

    if (concept.trim().length > this.MAX_CONCEPT_LENGTH) {
      errors.push(`El concepto no puede exceder ${this.MAX_CONCEPT_LENGTH} caracteres`);
    }

    if (concept.trim().length < 3) {
      warnings.push('El concepto es muy corto');
    }

    // Verificar caracteres especiales sospechosos
    const suspiciousPatterns = [
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i,
      /data:text\/html/i,
    ];

    for (const pattern of suspiciousPatterns) {
      if (pattern.test(concept)) {
        errors.push('El concepto contiene caracteres no permitidos');
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
    const suspiciousAmounts = [999999, 1000000, 0, 1, 9999999, 10000000];
    if (suspiciousAmounts.includes(amount)) {
      warnings.push('Monto sospechoso detectado');
    }
  }

  private validateCurrency(currency: string, errors: string[]): void {
    if (!currency || currency.trim().length === 0) {
      errors.push('Moneda es requerida');
      return;
    }

    if (!this.CURRENCY_PATTERN.test(currency.trim())) {
      errors.push('Formato de moneda inválido. Use código de 3 letras (ej: MXN, USD)');
    }

    // Verificar monedas soportadas
    const supportedCurrencies = ['MXN', 'USD', 'EUR', 'CAD'];
    if (!supportedCurrencies.includes(currency.trim().toUpperCase())) {
      errors.push(`Moneda no soportada: ${currency}. Monedas soportadas: ${supportedCurrencies.join(', ')}`);
    }
  }

  private validateIsDeposit(isDeposit: boolean, errors: string[]): void {
    if (typeof isDeposit !== 'boolean') {
      errors.push('Tipo de depósito debe ser un valor booleano');
    }
  }



  private validateBusinessRules(transaction: TransactionBank, errors: string[], warnings: string[]): void {
    // Regla: Depósitos muy grandes requieren atención especial
    if (transaction.is_deposit && transaction.amount > 100000) {
      warnings.push('Depósito de monto alto detectado');
    }

    // Regla: Retiros muy grandes requieren atención especial
    if (!transaction.is_deposit && transaction.amount > 50000) {
      warnings.push('Retiro de monto alto detectado');
    }

    // Regla: Verificar transacciones en horarios no comerciales
    const timeParts = transaction.time.split(':');
    const hour = parseInt(timeParts[0]);
    if (hour < 6 || hour > 22) {
      warnings.push('Transacción fuera de horario comercial');
    }

    // Regla: Verificar transacciones en fines de semana
    const dateObj = new Date(transaction.date);
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      warnings.push('Transacción en fin de semana');
    }

    // Regla: Verificar conceptos sospechosos
    const suspiciousKeywords = [
      'test', 'prueba', 'demo', 'temporal', 'temp',
      'xxxxx', 'aaaaa', 'zzzzz', 'unknown', 'desconocido',
      'deposito', 'retiro', 'transferencia'
    ];

    const concept = transaction.concept.toLowerCase();
    for (const keyword of suspiciousKeywords) {
      if (concept.includes(keyword)) {
        warnings.push('Concepto sospechoso detectado');
        break;
      }
    }

    // Regla: Verificar montos redondos sospechosos
    if (transaction.amount % 1000 === 0 && transaction.amount > 10000) {
      warnings.push('Monto redondo alto detectado');
    }
  }

  // Método para validar múltiples transacciones y detectar duplicados
  async validateBatch(transactions: TransactionBank[]): Promise<{
    duplicates: TransactionBank[];
    suspicious: TransactionBank[];
    valid: TransactionBank[];
  }> {
    const duplicates: TransactionBank[] = [];
    const suspicious: TransactionBank[] = [];
    const valid: TransactionBank[] = [];
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

  private generateTransactionKey(transaction: TransactionBank): string {
    return `${transaction.date}_${transaction.time}_${transaction.amount}_${transaction.concept.substring(0, 20)}`;
  }
}
