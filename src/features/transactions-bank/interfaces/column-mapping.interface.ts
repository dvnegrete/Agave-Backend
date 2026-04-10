export interface ColumnMapping {
  fechaIndex: number;
  horaIndex: number;
  conceptoIndex: number;
  retiroIndex: number;
  depositoIndex: number;
  saldoIndex: number; // -1 si no existe
  referenciaIndex: number; // -1 si no existe

  /**
   * Total de columnas en el encabezado original del archivo.
   * Permite detectar filas con comas sin escapar en el CONCEPTO:
   * si row.length > expectedColumnCount, hay columnas extra por comas internas.
   */
  expectedColumnCount: number;

  /**
   * Columnas que aparecen DESPUÉS de depositoIndex en el encabezado (ej: saldo, referencia).
   * Se usa para reconstruir RETIRO/DEPÓSITO desde la derecha cuando el CONCEPTO
   * tiene comas sin escapar que desplazan las columnas.
   */
  trailingColumnsAfterDeposito: number;
}
