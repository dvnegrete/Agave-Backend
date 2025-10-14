import { Injectable } from '@nestjs/common';
import {
  TransactionBank,
  BankTransactionValidationResult,
} from '../interfaces/transaction-bank.interface';
import {
  TIME_PATTERN,
  DATE_ISO_PATTERN,
  CURRENCY_CODE_PATTERN,
} from '../../../shared/common';
import {
  TransactionsBankValidationMessages,
  TransactionsBankWarningMessages,
  BusinessValues,
} from '@/shared/content';

@Injectable()
export class TransactionValidatorService {
  private readonly MAX_AMOUNT = BusinessValues.transactionsBank.maxAmount;
  private readonly MIN_AMOUNT = BusinessValues.transactionsBank.minAmount;
  private readonly MAX_CONCEPT_LENGTH =
    BusinessValues.transactionsBank.maxConceptLength;
  private readonly DATE_PATTERN = DATE_ISO_PATTERN;
  private readonly TIME_PATTERN = TIME_PATTERN;
  private readonly CURRENCY_PATTERN = CURRENCY_CODE_PATTERN;
  private readonly SUPPORTED_CURRENCIES =
    BusinessValues.transactionsBank.supportedCurrencies;
  private readonly SUSPICIOUS_KEYWORDS =
    BusinessValues.transactionsBank.suspiciousKeywords;
  private readonly SUSPICIOUS_AMOUNTS =
    BusinessValues.transactionsBank.suspiciousAmounts;

  async validateTransaction(
    transaction: TransactionBank,
  ): Promise<BankTransactionValidationResult> {
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
      errors.push(TransactionsBankValidationMessages.date.required);
      return;
    }

    if (!this.DATE_PATTERN.test(date.trim())) {
      errors.push(TransactionsBankValidationMessages.date.invalidFormat);
      return;
    }

    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      errors.push(TransactionsBankValidationMessages.date.invalid);
      return;
    }

    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(
      now.getDate() +
        BusinessValues.transactionsBank.dateValidation.maxFutureDays,
    );

    if (dateObj > futureDate) {
      errors.push(TransactionsBankValidationMessages.date.tooFarInFuture);
    }

    const pastDate = new Date();
    pastDate.setFullYear(
      now.getFullYear() -
        BusinessValues.transactionsBank.dateValidation.maxPastYears,
    );

    if (dateObj < pastDate) {
      errors.push(TransactionsBankValidationMessages.date.tooFarInPast);
    }
  }

  private validateTime(time: string, errors: string[]): void {
    if (!time || time.trim().length === 0) {
      errors.push(TransactionsBankValidationMessages.time.required);
      return;
    }

    if (!this.TIME_PATTERN.test(time.trim())) {
      errors.push(TransactionsBankValidationMessages.time.invalidFormat);
    }
  }

  private validateConcept(
    concept: string,
    errors: string[],
    warnings: string[],
  ): void {
    if (!concept || concept.trim().length === 0) {
      errors.push(TransactionsBankValidationMessages.concept.required);
      return;
    }

    if (concept.trim().length > this.MAX_CONCEPT_LENGTH) {
      errors.push(
        TransactionsBankValidationMessages.concept.tooLong(
          this.MAX_CONCEPT_LENGTH,
        ),
      );
    }

    if (concept.trim().length < 3) {
      warnings.push(TransactionsBankValidationMessages.concept.tooShort);
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
        errors.push(
          TransactionsBankValidationMessages.concept.invalidCharacters,
        );
        break;
      }
    }
  }

  private validateAmount(
    amount: number,
    errors: string[],
    warnings: string[],
  ): void {
    if (typeof amount !== 'number' || isNaN(amount)) {
      errors.push(TransactionsBankValidationMessages.amount.invalid);
      return;
    }

    if (amount < this.MIN_AMOUNT) {
      errors.push(
        TransactionsBankValidationMessages.amount.belowMinimum(this.MIN_AMOUNT),
      );
    }

    if (amount > this.MAX_AMOUNT) {
      errors.push(
        TransactionsBankValidationMessages.amount.aboveMaximum(this.MAX_AMOUNT),
      );
    }

    // Verificar si el monto es un número entero (sin decimales)
    if (amount % 1 === 0) {
      warnings.push(TransactionsBankValidationMessages.amount.noDecimals);
    }

    // Verificar montos sospechosos
    if ((this.SUSPICIOUS_AMOUNTS as readonly number[]).includes(amount)) {
      warnings.push(TransactionsBankValidationMessages.amount.suspicious);
    }
  }

  private validateCurrency(currency: string, errors: string[]): void {
    if (!currency || currency.trim().length === 0) {
      errors.push(TransactionsBankValidationMessages.currency.required);
      return;
    }

    if (!this.CURRENCY_PATTERN.test(currency.trim())) {
      errors.push(TransactionsBankValidationMessages.currency.invalidFormat);
    }

    // Verificar monedas soportadas
    const currencyUpper = currency.trim().toUpperCase();
    if (
      !(this.SUPPORTED_CURRENCIES as readonly string[]).includes(currencyUpper)
    ) {
      errors.push(
        TransactionsBankValidationMessages.currency.notSupported(currency, [
          ...this.SUPPORTED_CURRENCIES,
        ]),
      );
    }
  }

  private validateIsDeposit(isDeposit: boolean, errors: string[]): void {
    if (typeof isDeposit !== 'boolean') {
      errors.push(TransactionsBankValidationMessages.isDeposit.invalid);
    }
  }

  private validateBusinessRules(
    transaction: TransactionBank,
    errors: string[],
    warnings: string[],
  ): void {
    // Regla: Depósitos muy grandes requieren atención especial
    if (
      transaction.is_deposit &&
      transaction.amount >
        BusinessValues.transactionsBank.highAmountThresholds.deposit
    ) {
      warnings.push(TransactionsBankWarningMessages.highDeposit);
    }

    // Regla: Retiros muy grandes requieren atención especial
    if (
      !transaction.is_deposit &&
      transaction.amount >
        BusinessValues.transactionsBank.highAmountThresholds.withdrawal
    ) {
      warnings.push(TransactionsBankWarningMessages.highWithdrawal);
    }

    // Regla: Verificar transacciones en horarios no comerciales
    const timeParts = transaction.time.split(':');
    const hour = parseInt(timeParts[0]);
    if (hour < 6 || hour > 22) {
      warnings.push(TransactionsBankWarningMessages.outsideBusinessHours);
    }

    // Regla: Verificar transacciones en fines de semana
    const dateObj = new Date(transaction.date);
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      warnings.push(TransactionsBankWarningMessages.weekend);
    }

    // Regla: Verificar conceptos sospechosos
    const concept = transaction.concept.toLowerCase();
    for (const keyword of this.SUSPICIOUS_KEYWORDS) {
      if (concept.includes(keyword)) {
        warnings.push(TransactionsBankWarningMessages.suspiciousConcept);
        break;
      }
    }

    // Regla: Verificar montos redondos sospechosos
    if (transaction.amount % 1000 === 0 && transaction.amount > 10000) {
      warnings.push(TransactionsBankWarningMessages.highRoundAmount);
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
