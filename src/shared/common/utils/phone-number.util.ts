/**
 * Parsea y formatea un número de teléfono de WhatsApp a formato numérico con código de país
 *
 * El número de WhatsApp puede venir en diferentes formatos:
 * - "525512345678" (con código de país 52 para México)
 * - "5512345678" (sin código de país)
 * - "+525512345678" (con símbolo +)
 *
 * @param phoneNumber - Número de teléfono de WhatsApp (puede ser string o number)
 * @returns Número de teléfono en formato numérico con código de país (ej: 525512345678)
 * @throws Error si el número no es válido
 */
export function parsePhoneNumberWithCountryCode(phoneNumber: string | number): number {
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

  // Si el número tiene 10 dígitos, asumimos que es México sin código de país
  // Agregamos el código de país 52
  if (phone.length === 10) {
    return parseInt(`52${phone}`, 10);
  }

  // Si el número ya tiene 12 dígitos y empieza con 52, es válido para México
  if (phone.length === 12 && phone.startsWith('52')) {
    return phoneNum;
  }

  // Si tiene 11 dígitos y empieza con 1 (USA/Canadá), es válido
  if (phone.length === 11 && phone.startsWith('1')) {
    return phoneNum;
  }

  // Para otros casos, si tiene entre 10 y 15 dígitos, aceptamos como válido
  // (formato internacional estándar E.164)
  if (phone.length >= 10 && phone.length <= 15) {
    return phoneNum;
  }

  // Si no cumple ninguna condición, lanzar error
  throw new Error(
    `Número de teléfono inválido: ${phoneNumber}. Debe tener entre 10 y 15 dígitos`,
  );
}

/**
 * Formatea un número de teléfono para mostrar en formato legible
 *
 * @param phoneNumber - Número de teléfono en formato numérico
 * @returns String formateado (ej: "+52 55 1234 5678")
 */
export function formatPhoneNumber(phoneNumber: number): string {
  const phone = String(phoneNumber);

  // Si empieza con 52 (México) y tiene 12 dígitos
  if (phone.startsWith('52') && phone.length === 12) {
    const countryCode = phone.substring(0, 2);
    const areaCode = phone.substring(2, 4);
    const firstPart = phone.substring(4, 8);
    const secondPart = phone.substring(8, 12);
    return `+${countryCode} ${areaCode} ${firstPart} ${secondPart}`;
  }

  // Si empieza con 1 (USA/Canadá) y tiene 11 dígitos
  if (phone.startsWith('1') && phone.length === 11) {
    const countryCode = phone.substring(0, 1);
    const areaCode = phone.substring(1, 4);
    const firstPart = phone.substring(4, 7);
    const secondPart = phone.substring(7, 11);
    return `+${countryCode} (${areaCode}) ${firstPart}-${secondPart}`;
  }

  // Formato genérico
  return `+${phone}`;
}

/**
 * Valida si un número de teléfono es válido para WhatsApp
 *
 * @param phoneNumber - Número de teléfono a validar
 * @returns true si es válido, false en caso contrario
 */
export function isValidWhatsAppPhoneNumber(phoneNumber: string | number): boolean {
  try {
    parsePhoneNumberWithCountryCode(phoneNumber);
    return true;
  } catch {
    return false;
  }
}
