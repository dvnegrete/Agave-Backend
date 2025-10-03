/**
 * Mensajes de advertencia para transacciones bancarias
 */
export const TransactionsBankWarningMessages = {
  /**
   * Advertencia cuando se detectan conceptos duplicados
   * @param duplicateConcepts Array de conceptos duplicados
   */
  duplicateConceptsFound: (duplicateConcepts: string[]) =>
    `Conceptos duplicados encontrados: ${duplicateConcepts.join(', ')}`,

  /**
   * Advertencia cuando hay transacciones de monto alto
   * @param count Número de transacciones de monto alto
   */
  highAmountTransactions: (count: number) =>
    `${count} transacciones de monto alto`,

  /**
   * Advertencia cuando se detecta un depósito de monto alto
   */
  highDeposit: 'Depósito de monto alto detectado',

  /**
   * Advertencia cuando se detecta un retiro de monto alto
   */
  highWithdrawal: 'Retiro de monto alto detectado',

  /**
   * Advertencia cuando la transacción es fuera de horario comercial
   */
  outsideBusinessHours: 'Transacción fuera de horario comercial',

  /**
   * Advertencia cuando la transacción es en fin de semana
   */
  weekend: 'Transacción en fin de semana',

  /**
   * Advertencia cuando se detecta un concepto sospechoso
   */
  suspiciousConcept: 'Concepto sospechoso detectado',

  /**
   * Advertencia cuando se detecta un monto redondo alto
   */
  highRoundAmount: 'Monto redondo alto detectado',
} as const;
