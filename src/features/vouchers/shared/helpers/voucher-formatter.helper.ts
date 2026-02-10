/**
 * Funciones auxiliares para formatear datos de vouchers en mensajes de WhatsApp
 * Protege contra valores vacíos/nulos para evitar mostrar "**" en los mensajes
 */

/**
 * Formatea un valor de campo del voucher protegiendo contra vacíos
 * @param value - Valor a formatear
 * @param placeholder - Texto a mostrar si está vacío (default: 'No disponible')
 * @returns Valor formateado o placeholder
 */
export function formatVoucherField(
  value: string | number | null | undefined,
  placeholder: string = 'No disponible',
): string {
  if (value === null || value === undefined || value === '') {
    return placeholder;
  }
  return String(value).trim();
}

/**
 * Formatea un monto con símbolo de moneda
 * @param monto - Monto a formatear
 * @returns Monto formateado como "$X.XX" o "No disponible"
 */
export function formatMonto(monto: string | number | null | undefined): string {
  if (monto === null || monto === undefined || monto === '') {
    return 'No disponible';
  }
  return `$${String(monto).trim()}`;
}

/**
 * Formatea un número de casa
 * @param casa - Número de casa
 * @returns Casa formateada o "No disponible"
 */
export function formatCasa(casa: number | null | undefined): string {
  if (casa === null || casa === undefined) {
    return 'No disponible';
  }
  return String(casa);
}

/**
 * Formatea una fecha
 * @param fecha - Fecha a formatear (formato esperado: YYYY-MM-DD o DD/MM/YYYY)
 * @returns Fecha formateada en formato DD-MMMM-YYYY (ej: 24-agosto-2025) o "No disponible"
 */
export function formatFecha(fecha: string | null | undefined): string {
  if (fecha === null || fecha === undefined || fecha === '') {
    return 'No disponible';
  }

  const fechaStr = String(fecha).trim();

  try {
    let day: number;
    let month: number;
    let year: number;

    if (fechaStr.includes('/')) {
      // Formato: DD/MM/YYYY
      const [dayStr, monthStr, yearStr] = fechaStr.split('/');
      day = parseInt(dayStr, 10);
      month = parseInt(monthStr, 10);
      year = parseInt(yearStr, 10);
    } else if (fechaStr.includes('-')) {
      // Formato: YYYY-MM-DD
      const [yearStr, monthStr, dayStr] = fechaStr.split('-');
      day = parseInt(dayStr, 10);
      month = parseInt(monthStr, 10);
      year = parseInt(yearStr, 10);
    } else {
      return fechaStr; // Si no es un formato reconocido, retornar como está
    }

    // Validar valores
    if (
      isNaN(day) ||
      isNaN(month) ||
      isNaN(year) ||
      day < 1 ||
      day > 31 ||
      month < 1 ||
      month > 12
    ) {
      return fechaStr; // Si la fecha es inválida, retornar como está
    }

    // Meses en español
    const meses = [
      'enero',
      'febrero',
      'marzo',
      'abril',
      'mayo',
      'junio',
      'julio',
      'agosto',
      'septiembre',
      'octubre',
      'noviembre',
      'diciembre',
    ];

    const dayFormatted = String(day).padStart(2, '0');
    const monthName = meses[month - 1];

    return `${dayFormatted}-${monthName}-${year}`;
  } catch (error) {
    return fechaStr; // Si algo sale mal, retornar como está
  }
}

/**
 * Formatea una hora
 * @param hora - Hora a formatear (formato esperado: HH:MM:SS)
 * @returns Hora formateada o "No disponible"
 */
export function formatHora(hora: string | null | undefined): string {
  if (hora === null || hora === undefined || hora === '') {
    return 'No disponible';
  }
  return String(hora).trim();
}

/**
 * Formatea una referencia
 * @param referencia - Referencia bancaria
 * @returns Referencia formateada o "No disponible"
 */
export function formatReferencia(
  referencia: string | null | undefined,
): string {
  if (referencia === null || referencia === undefined || referencia === '') {
    return 'No disponible';
  }
  return String(referencia).trim();
}
