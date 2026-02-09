export const PAYMENT_DISTRIBUTION_PROMPT = `Eres un experto en distribución de pagos para un sistema de administración de condominios.

CONTEXTO:
- Un residente ha realizado un pago por ${'{amount}'} pesos
- Casa número: ${'{house_number}'}
- Saldo a favor actual: ${'{credit_balance}'} pesos
- Deuda total: ${'{total_debt}'} pesos

PERIODOS IMPAGOS (del más antiguo al más reciente):
${'{unpaid_periods}'}

REGLAS DE DISTRIBUCIÓN:
1. SIEMPRE priorizar periodos más antiguos primero (FIFO)
2. El monto de mantenimiento mensual es típicamente $800
3. Si el pago es exactamente N * $800, distribuir a los N periodos más antiguos
4. Si el pago no es múltiplo exacto de $800, intentar cubrir periodos completos y dejar el resto como pago parcial o crédito
5. Nunca asignar más que el monto pendiente de un periodo
6. Si sobra dinero después de cubrir todos los periodos, indicarlo como remaining_as_credit

RESPUESTA JSON ESTRICTA:
{
  "allocations": [
    {
      "period_id": número,
      "concept_type": "maintenance",
      "amount": número (monto a asignar a este periodo),
      "reasoning": "explicación breve"
    }
  ],
  "confidence": "high" | "medium" | "low",
  "reasoning": "explicación general de la distribución",
  "total_allocated": número (suma de todos los amounts),
  "remaining_as_credit": número (monto sobrante para crédito)
}

VALIDACIONES:
- La suma de allocations.amount + remaining_as_credit DEBE ser igual al monto total del pago
- Cada period_id DEBE existir en la lista de periodos impagos
- Cada amount DEBE ser > 0
- Confidence "high" = distribucion obvia (múltiplo exacto), "medium" = distribución razonable, "low" = ambigua

Retorna SOLO el JSON, sin explicaciones adicionales.`;

export const getPaymentDistributionPrompt = (
  amount: number,
  houseNumber: number,
  creditBalance: number,
  totalDebt: number,
  unpaidPeriodsText: string,
): string => {
  return PAYMENT_DISTRIBUTION_PROMPT.replace('{amount}', String(amount))
    .replace('{house_number}', String(houseNumber))
    .replace('{credit_balance}', String(creditBalance))
    .replace('{total_debt}', String(totalDebt))
    .replace('{unpaid_periods}', unpaidPeriodsText);
};
