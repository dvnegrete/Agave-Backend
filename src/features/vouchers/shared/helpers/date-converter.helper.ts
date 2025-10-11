import { formatDateToDDMMYYYY, MONTH_NAMES } from '@/shared/common/utils';

/**
 * Opciones de fecha para listas de WhatsApp
 */
export interface DateOption {
  id: string;
  title: string;
  description: string;
}

/**
 * Genera una lista de fechas recientes para selección rápida
 * (hoy, ayer, antier + opción manual)
 * @returns Array de opciones de fecha
 */
export function generateRecentDates(): DateOption[] {
  const today = new Date();
  const options: DateOption[] = [];

  // Hoy
  options.push({
    id: 'hoy',
    title: `Hoy ${today.getDate()}`,
    description: `${today.getDate()} de ${MONTH_NAMES[today.getMonth()]} ${today.getFullYear()}`,
  });

  // Ayer
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  options.push({
    id: 'fecha_1',
    title: `Ayer ${yesterday.getDate()}`,
    description: `${yesterday.getDate()} de ${MONTH_NAMES[yesterday.getMonth()]} ${yesterday.getFullYear()}`,
  });

  // Antier
  const dayBeforeYesterday = new Date(today);
  dayBeforeYesterday.setDate(today.getDate() - 2);
  options.push({
    id: 'fecha_2',
    title: `Antier ${dayBeforeYesterday.getDate()}`,
    description: `${dayBeforeYesterday.getDate()} de ${MONTH_NAMES[dayBeforeYesterday.getMonth()]} ${dayBeforeYesterday.getFullYear()}`,
  });

  // Opción para escribir manualmente
  options.push({
    id: 'otra',
    title: 'Otra fecha',
    description: 'Escribir manualmente',
  });

  return options;
}

/**
 * Convierte un ID de fecha (hoy, fecha_1, fecha_2) a formato DD/MM/YYYY
 * @param dateId - ID de fecha seleccionado por el usuario
 * @returns Fecha en formato DD/MM/YYYY o null si no es un ID válido
 */
export function convertDateIdToString(dateId: string): string | null {
  const today = new Date();
  let targetDate: Date | null = null;

  if (dateId === 'hoy') {
    targetDate = today;
  } else if (dateId.startsWith('fecha_')) {
    const daysAgo = parseInt(dateId.replace('fecha_', ''), 10);
    // Solo acepta fecha_1 (ayer) y fecha_2 (antier)
    if (!isNaN(daysAgo) && daysAgo >= 1 && daysAgo <= 2) {
      targetDate = new Date(today);
      targetDate.setDate(today.getDate() - daysAgo);
    }
  }

  return targetDate ? formatDateToDDMMYYYY(targetDate) : null;
}
