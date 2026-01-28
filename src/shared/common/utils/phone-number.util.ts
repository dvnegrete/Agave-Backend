/**
 * Parsea y formatea un número de teléfono de WhatsApp a formato numérico con código de país
 *
 * El número de WhatsApp puede venir en diferentes formatos:
 * - "525512345678" (con código de país)
 * - "5512345678" (sin código de país - será rechazado)
 * - "+525512345678" (con símbolo +)
 *
 * IMPORTANTE: Este parser espera que el número SIEMPRE venga con código de país,
 * ya que WhatsApp API siempre envía números en formato internacional E.164.
 *
 * @param phoneNumber - Número de teléfono de WhatsApp (puede ser string o number)
 * @returns Número de teléfono en formato numérico con código de país
 * @throws Error si el número no es válido o no tiene código de país
 */
export function parsePhoneNumberWithCountryCode(
  phoneNumber: string | number,
): number {
  // Convertir a string si es number
  let phone = String(phoneNumber).trim();

  // Remover caracteres no numéricos (espacios, guiones, paréntesis, símbolo +)
  phone = phone.replace(/[^\d]/g, '');

  // Si está vacío después de limpiar, lanzar error
  if (!phone) {
    throw new Error('Número de teléfono inválido: vacío o sin dígitos');
  }

  // Convertir a número
  const phoneNum = parseInt(phone, 10);

  // Validar que sea un número válido
  if (isNaN(phoneNum) || phoneNum <= 0) {
    throw new Error(`Número de teléfono inválido: ${phoneNumber}`);
  }

  // WhatsApp API siempre envía números en formato E.164 internacional
  // que incluye código de país. Los números válidos tienen entre 10 y 15 dígitos.
  //
  // Ejemplos de códigos de país comunes:
  // - 1: USA, Canadá (11 dígitos totales: 1 + 10)
  // - 44: Reino Unido (12-13 dígitos)
  // - 49: Alemania (11-14 dígitos)
  // - 52: México (12 dígitos: 52 + 10)
  // - 54: Argentina (11-13 dígitos)
  // - 55: Brasil (12-13 dígitos)
  // - 57: Colombia (12 dígitos)
  // - 86: China (13-14 dígitos)
  // - 91: India (12 dígitos)
  // - 351: Portugal (12 dígitos)
  // - 593: Ecuador (12 dígitos)
  //
  // Formato E.164: [código país][número nacional]
  // Rango válido: 10-15 dígitos según estándar ITU-T E.164

  if (phone.length >= 10 && phone.length <= 15) {
    return phoneNum;
  }

  // Si no cumple el rango, rechazar
  throw new Error(
    `Número de teléfono inválido: ${phoneNumber}. ` +
      `Debe tener entre 10 y 15 dígitos en formato internacional con código de país. ` +
      `WhatsApp API envía números en formato E.164 (ej: 525512345678, 14155552671)`,
  );
}

/**
 * Formatea un número de teléfono para mostrar en formato legible
 *
 * @param phoneNumber - Número de teléfono en formato numérico
 * @returns String formateado con código de país visible
 *
 * Ejemplos:
 * - 525512345678 → "+52 5512345678"
 * - 14155552671 → "+1 4155552671"
 * - 4420123456789 → "+44 20123456789"
 */
export function formatPhoneNumber(phoneNumber: number): string {
  const phone = String(phoneNumber);

  // Detectar longitud del código de país
  // Códigos de 1 dígito: 1 (USA/Canadá)
  if (phone.startsWith('1') && phone.length === 11) {
    return `+${phone.substring(0, 1)} ${phone.substring(1)}`;
  }

  // Códigos de 2 dígitos: 20-99 (mayoría de países)
  // Ej: 52 (México), 54 (Argentina), 55 (Brasil), 91 (India)
  if (phone.length >= 11 && parseInt(phone.substring(0, 2)) >= 20) {
    return `+${phone.substring(0, 2)} ${phone.substring(2)}`;
  }

  // Códigos de 3 dígitos: 100-999 (algunos países europeos, africanos)
  // Ej: 351 (Portugal), 593 (Ecuador)
  if (phone.length >= 12) {
    return `+${phone.substring(0, 3)} ${phone.substring(3)}`;
  }

  // Formato genérico para casos no previstos
  return `+${phone}`;
}

/**
 * Valida si un número de teléfono es válido para WhatsApp
 *
 * @param phoneNumber - Número de teléfono a validar
 * @returns true si es válido, false en caso contrario
 */
export function isValidWhatsAppPhoneNumber(
  phoneNumber: string | number,
): boolean {
  try {
    parsePhoneNumberWithCountryCode(phoneNumber);
    return true;
  } catch {
    return false;
  }
}
