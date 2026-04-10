/**
 * Prompt para detección semántica de columnas en archivos bancarios (CSV/XLSX).
 * Compatible con OpenAI (GPT) y Vertex AI (Gemini).
 */

const COLUMN_ANALYSIS_PROMPT_TEMPLATE = `Eres un experto en análisis de estructuras de archivos bancarios (CSV/XLSX).

Se te proporciona la fila de encabezados y hasta 2 filas de datos de muestra de un estado de cuenta bancario.
Tu tarea es identificar el índice (base 0) de cada columna por su SEMÁNTICA, no solo por su nombre exacto.

ENCABEZADOS:
{headers}

FILAS DE MUESTRA:
{sampleRows}

COLUMNAS A IDENTIFICAR:
- fecha: columna con fechas de transacción (variaciones: "FECHA", "Date", "Fecha operación", "FEC", "Fecha mov")
- hora: columna con la hora del movimiento (variaciones: "HORA", "Time", "Hora operación", "HR")
- concepto: descripción o referencia del movimiento (variaciones: "CONCEPTO", "Concepto", "Descripción", "Reference", "Detalle", "Referencia", "Descripción movimiento")
- retiro: monto de cargo, débito o salida de dinero (variaciones: "RETIRO", "Retiros", "Cargo", "Débito", "withdrawal", "Debit", "Egresos", "Salida")
- deposito: monto de abono, crédito o entrada de dinero (variaciones: "DEPÓSITO", "DEPOSITO", "Depósito", "Abono", "Crédito", "deposit", "Credit", "Ingresos", "Entrada")
- saldo: saldo o balance después del movimiento (variaciones: "SALDO", "Balance", "Saldo final", "Saldo disponible") — puede no existir, usa -1
- referencia: número de referencia, folio u operación bancaria — puede no existir, usa -1

REGLAS:
1. Usa el índice base 0 (la primera columna es índice 0)
2. Si una columna no existe en el archivo, devuelve -1 para ese campo
3. Cuando el nombre sea ambiguo, usa el contenido de las filas de muestra para confirmar
4. retiro y deposito son mutuamente excluyentes por fila: en cada movimiento una tiene valor y la otra está vacía o en 0
5. expectedColumnCount = número total de columnas en el encabezado
6. trailingColumnsAfterDeposito = cantidad de columnas que aparecen DESPUÉS de depositoIndex en el encabezado
   Ejemplo: si deposito está en índice 5 y el encabezado tiene 8 columnas → trailingColumnsAfterDeposito = 2

EJEMPLOS DE REFERENCIA:
Encabezado: "FECHA,HORA,SUCURSAL,CONCEPTO,RETIRO,DEPÓSITO,SALDO,REFERENCIA"
Resultado: fechaIndex:0, horaIndex:1, conceptoIndex:3, retiroIndex:4, depositoIndex:5, saldoIndex:6, referenciaIndex:7, expectedColumnCount:8, trailingColumnsAfterDeposito:2

Encabezado: "FECHA,HORA,CONCEPTO,RETIRO,DEPOSITO,MONEDA"
Resultado: fechaIndex:0, horaIndex:1, conceptoIndex:2, retiroIndex:3, depositoIndex:4, saldoIndex:-1, referenciaIndex:-1, expectedColumnCount:6, trailingColumnsAfterDeposito:1

RESPUESTA (JSON estricto, sin texto adicional):
{
  "fechaIndex": número,
  "horaIndex": número,
  "conceptoIndex": número,
  "retiroIndex": número,
  "depositoIndex": número,
  "saldoIndex": número,
  "referenciaIndex": número,
  "expectedColumnCount": número,
  "trailingColumnsAfterDeposito": número,
  "confidence": "high" | "medium" | "low",
  "reasoning": "explicación breve de los índices asignados"
}`;

export const getColumnAnalysisPrompt = (
  headerRow: string[],
  sampleRows: string[][],
): string => {
  const headersStr = headerRow.map((h, i) => `[${i}] ${h}`).join('\n');

  const sampleStr =
    sampleRows.length > 0
      ? sampleRows
          .map(
            (row, ri) =>
              `Fila ${ri + 1}: ${row.map((cell, ci) => `[${ci}]=${cell}`).join(', ')}`,
          )
          .join('\n')
      : '(sin filas de muestra disponibles)';

  return COLUMN_ANALYSIS_PROMPT_TEMPLATE.replace(
    '{headers}',
    headersStr,
  ).replace('{sampleRows}', sampleStr);
};
