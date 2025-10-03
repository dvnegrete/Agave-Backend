/**
 * Prompt para extraer datos de comprobantes de pago usando IA
 */

export class OCRExtractorPrompt {
  /**
   * Construye el prompt por defecto para extraer datos de comprobantes
   * @param text Texto extraído por OCR
   * @returns Prompt completo para la IA
   */
  static buildDefault(text: string): string {
    return `Eres un extractor de datos de comprobantes de pago. Responde SOLO en JSON. Campos requeridos: monto (MXN), fecha_pago (YYYY-MM-DD), referencia, hora_transaccion. Si algún campo falta o es inválido, incluye 'faltan_datos': true y 'pregunta' con texto breve para pedirlo. Si todo está correcto, 'faltan_datos': false. El texto a analizar es:

${text}`;
  }

  /**
   * Permite construir un prompt personalizado
   * @param customPrompt Prompt personalizado completo
   * @returns El prompt personalizado
   */
  static buildCustom(customPrompt: string): string {
    return customPrompt;
  }
}
