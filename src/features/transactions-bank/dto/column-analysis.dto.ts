/**
 * DTOs para análisis de estructura de columnas bancarias con IA
 */

/**
 * Respuesta de OpenAI/Vertex AI para detección semántica de columnas
 */
export interface ColumnAnalysisAIResponse {
  fechaIndex: number;
  horaIndex: number;
  conceptoIndex: number;
  retiroIndex: number;
  depositoIndex: number;
  saldoIndex: number;
  referenciaIndex: number;
  expectedColumnCount: number;
  trailingColumnsAfterDeposito: number;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
}
