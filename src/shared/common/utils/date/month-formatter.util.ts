import { MONTH_NAMES } from '../../constants/messages';

/**
 * Formatea un mes y año como nombre completo
 * @param month - Número de mes (1-12)
 * @param year - Año
 * @returns Formato: "Enero 2026"
 */
export function formatMonthName(month: number, year: number): string {
  if (month < 1 || month > 12) {
    throw new Error(`Mes inválido: ${month}. Debe ser entre 1 y 12`);
  }
  return `${MONTH_NAMES[month - 1]} ${year}`;
}
