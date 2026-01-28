/**
 * Configuración centralizada de prompts para extracción de datos de comprobantes de pago
 * Este archivo es el único punto de verdad para los prompts de OCR
 * Usar estas constantes en OpenAIService y VertexAIService
 */

/**
 * Prompt estricto y detallado para extracción de datos de comprobantes de pago
 *
 * INSTRUCCIONES CRÍTICAS:
 * - NUNCA inventes, asumas o adivines datos
 * - Solo extrae lo que está EXPLÍCITAMENTE en el documento
 * - Los campos MONTO, FECHA_PAGO y HORA_TRANSACCION son OBLIGATORIOS
 * - Si falta alguno de estos, debe indicarse en 'faltan_datos'
 *
 * CAMPOS A EXTRAER:
 * - monto: Cantidad numérica en formato 0.00 (SOLO si está visible en el comprobante)
 * - fecha_pago: Formato YYYY-MM-DD (SOLO si está explícitamente)
 * - referencia: Número de referencia/autorización (puede estar vacío)
 * - hora_transaccion: Formato HH:MM:SS (SOLO si aparece - NO inventar)
 *
 * RESPUESTA JSON:
 * {
 *   "monto": "solo si está en el documento, sino: ''",
 *   "fecha_pago": "YYYY-MM-DD o '' si no existe",
 *   "referencia": "texto o '' si no existe",
 *   "hora_transaccion": "HH:MM:SS o '' si no existe",
 *   "faltan_datos": true si algún campo obligatorio está vacío, false si todos están presentes,
 *   "pregunta": "Si faltan_datos es true, pregunta clara. Si no faltan datos, este campo vacío."
 * }
 */
export const OCR_EXTRACTION_PROMPT = `SISTEMA DE EXTRACCIÓN DE DATOS DE COMPROBANTES DE PAGO - MODO ESTRICTO

INSTRUCCIONES CRÍTICAS:
1. NUNCA inventes, asumas o adivines datos. Solo extrae lo que está EXPLÍCITAMENTE en el documento.
2. Si NO encuentras un campo EXACTAMENTE en el comprobante, marca como vacío ("").
3. Los campos MONTO, FECHA_PAGO y HORA_TRANSACCION son OBLIGATORIOS. Si falta alguno, debes indicarlo.

CAMPOS A EXTRAER:
- monto: Cantidad numérica en formato 0.00 (SOLO si está visible en el comprobante)
- fecha_pago: Formato YYYY-MM-DD (SOLO si está explícitamente en el comprobante)
- referencia: Número de referencia/autorización (puede estar vacío si no existe)
- hora_transaccion: Formato HH:MM:SS (SOLO si aparece en el comprobante - NO inventar)

REGLAS DE VALIDACIÓN:
- Monto: Debe ser un número decimal positivo (ej: 150.50, 1000, 500.00)
- Fecha: Debe ser una fecha válida (no futura, no en 1900s)
- Hora: Debe estar en formato HH:MM:SS o HH:MM con valores válidos (00:00 a 23:59)
- Referencia: Alfanumérica, puede contener números y letras

CASOS ESPECIALES:
- Si es una captura de pantalla SIN fecha: marca fecha como vacío, NO uses fecha actual
- Si la hora aparece en formato 12h (AM/PM), convierte a 24h
- Si encuentras múltiples fechas: usa la que corresponda al movimiento del pago
- Si hay campos cortados o ilegibles: NO inventes, marca como vacío

RESPUESTA JSON:
{
  "monto": "solo si está en el documento, sino: ''",
  "fecha_pago": "YYYY-MM-DD o '' si no existe",
  "referencia": "texto o '' si no existe",
  "hora_transaccion": "HH:MM:SS o '' si no existe",
  "faltan_datos": true si algún campo obligatorio está vacío, false si todos están presentes,
  "pregunta": "Si faltan_datos es true, pregunta clara y breve por los campos faltantes. Si no faltan datos, este campo debe estar vacío."
}

PRIORIDAD: Exactitud sobre completitud. Mejor tener campos vacíos que datos incorrectos.`;

/**
 * Interfaz para configuración de prompts de OCR
 */
export interface OCRPromptsConfig {
  extractionPrompt: string;
}

/**
 * Configuración exportada de prompts de OCR
 */
export const ocrPromptsConfig: OCRPromptsConfig = {
  extractionPrompt: OCR_EXTRACTION_PROMPT,
};

/**
 * Función helper para obtener el prompt de extracción
 * Útil si en el futuro se necesita lógica condicional
 *
 * @param customPrompt - Prompt personalizado (opcional, usa el default si no se proporciona)
 * @returns El prompt a usar para la extracción
 */
export const getOCRExtractionPrompt = (customPrompt?: string): string => {
  return customPrompt || ocrPromptsConfig.extractionPrompt;
};

/**
 * Función helper para obtener el prompt de extracción con documento incluido
 * Esta versión es para Vertex AI que necesita el documento en el prompt
 *
 * @param text - Texto del documento a analizar
 * @param customPrompt - Prompt personalizado (opcional)
 * @returns El prompt completo con documento incluido
 */
export const getOCRExtractionPromptWithDocument = (
  text: string,
  customPrompt?: string,
): string => {
  const basePrompt = getOCRExtractionPrompt(customPrompt);
  return `${basePrompt}\n\nDOCUMENTO A ANALIZAR:\n${text}`;
};
