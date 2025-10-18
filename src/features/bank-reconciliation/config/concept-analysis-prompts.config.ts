/**
 * Prompts para análisis de conceptos bancarios con IA
 * Se utiliza cuando los patrones regex no son conclusivos
 *
 * Prompt único genérico que funciona con OpenAI (GPT-3.5-turbo/GPT-4) y Vertex AI (Gemini)
 */

export const CONCEPT_ANALYSIS_PROMPT = `Eres un experto en análisis de transacciones bancarias para un sistema de administración de condominios/apartamientos.

Analiza el siguiente concepto de transacción bancaria para extraer:
1. Número de casa/apartamento (1-66)
2. Mes del pago (si está indicado)
3. Tipo de pago (mantenimiento, agua, luz, etc.)

REGLAS IMPORTANTES:
- Los usuarios a menudo abrevian o escriben el número de forma informal
- Patrones comunes: "casa 5", "c5", "c-50", "apto 5", "cs02", "C64"
- Puede haber información de mes: "enero", "febrero", "mes 3", "03", etc.
- Puede incluir tipo de pago: "mantenimiento", "agua", "cuota", "administración", etc.

CONCEPTO: "{concept}"

INSTRUCCIONES:
1. Busca CUALQUIER número entre 1-66 que pueda representar una casa
2. Considera el contexto: palabras como "casa", "apto", "apartamento", "propiedad", "inmueble"
3. Si encuentras abreviaturas (c, cs, apt, etc.), extrae el número que las acompaña
4. Extrae información de mes si existe
5. Identifica el tipo de pago basado en palabras clave

RESPUESTA JSON ESTRICTA:
{
  "house_number": número entre 1-66 o null si no se puede determinar,
  "confidence": "high" (claro), "medium" (probable), "low" (incierto), o "none" (no encontrado),
  "month_number": número de mes 1-12 o null,
  "month_name": nombre del mes en español o null,
  "payment_type": tipo de pago identificado o null,
  "keywords": array de palabras clave encontradas,
  "reasoning": explicación breve de por qué se extrajo este número,
  "indicators": {
    "clear_house_pattern": true/false,
    "month_indicator": true/false,
    "payment_type_found": true/false
  }
}

EJEMPLOS VÁLIDOS:
- Concepto: "Pago c50 enero" → house_number: 50, month_number: 1
- Concepto: "Casa 5 mantenimiento" → house_number: 5, payment_type: "mantenimiento"
- Concepto: "Transferencia c-1" → house_number: 1, confidence: "high"
- Concepto: "Apto 64 cuota admin" → house_number: 64, payment_type: "administración"

PRIORIDAD: Exactitud sobre completitud. Retorna SOLO el JSON, sin explicaciones adicionales.`;

/**
 * Obtiene el prompt formateado con el concepto a analizar
 * Compatible con OpenAI (GPT-3.5-turbo/GPT-4) y Vertex AI (Gemini)
 *
 * @param concept - Concepto bancario a analizar
 * @returns Prompt formateado listo para enviar a IA
 */
export const getConceptAnalysisPrompt = (concept: string): string => {
  return CONCEPT_ANALYSIS_PROMPT.replace('{concept}', concept);
};
