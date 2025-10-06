import { Injectable, Logger } from '@nestjs/common';
import { StructuredDataWithCasa } from './voucher-processor.service';
import { BusinessValues } from '@/shared/content';

/**
 * Estados posibles de una conversación
 */
export enum ConversationState {
  IDLE = 'idle', // Sin conversación activa
  WAITING_CONFIRMATION = 'waiting_confirmation', // Esperando "SI" para confirmar datos del voucher
  WAITING_HOUSE_NUMBER = 'waiting_house_number', // Esperando número de casa
  WAITING_MISSING_DATA = 'waiting_missing_data', // Esperando datos faltantes
  WAITING_CORRECTION_TYPE = 'waiting_correction_type', // Esperando qué dato corregir (monto, fecha, casa, referencia, hora)
  WAITING_CORRECTION_VALUE = 'waiting_correction_value', // Esperando el nuevo valor del dato a corregir
}

/**
 * Contexto de una conversación activa
 */
export interface ConversationContext {
  phoneNumber: string;
  state: ConversationState;
  lastMessageAt: Date;
  data?: {
    voucherData?: StructuredDataWithCasa;
    gcsFilename?: string;
    originalFilename?: string;
    confirmationCode?: string;
    missingFields?: string[];
    fieldToCorrect?: string; // Campo que el usuario está corrigiendo
    [key: string]: any;
  };
}

@Injectable()
export class ConversationStateService {
  private readonly logger = new Logger(ConversationStateService.name);
  private readonly conversations: Map<string, ConversationContext> = new Map();
  private readonly SESSION_TIMEOUT_MS = BusinessValues.session.timeoutMs;

  constructor() {
    // Limpiar sesiones expiradas automáticamente
    setInterval(
      () => this.cleanExpiredSessions(),
      BusinessValues.session.cleanupIntervalMs,
    );
  }

  /**
   * Obtiene el contexto de una conversación
   */
  getContext(phoneNumber: string): ConversationContext | null {
    const context = this.conversations.get(phoneNumber);

    if (!context) {
      return null;
    }

    // Verificar si la sesión ha expirado
    const isExpired = Date.now() - context.lastMessageAt.getTime() > this.SESSION_TIMEOUT_MS;

    if (isExpired) {
      this.logger.log(`Sesión expirada para ${phoneNumber}, limpiando contexto`);
      this.clearContext(phoneNumber);
      return null;
    }

    return context;
  }

  /**
   * Establece o actualiza el contexto de una conversación
   */
  setContext(
    phoneNumber: string,
    state: ConversationState,
    data?: ConversationContext['data'],
  ): void {
    const context: ConversationContext = {
      phoneNumber,
      state,
      lastMessageAt: new Date(),
      data: data || {},
    };

    this.conversations.set(phoneNumber, context);

    this.logger.log(
      `Contexto actualizado para ${phoneNumber}: ${state}${data ? ` con ${JSON.stringify(Object.keys(data))}` : ''}`,
    );
  }

  /**
   * Actualiza solo el timestamp de último mensaje (para mantener la sesión activa)
   */
  updateLastMessageTime(phoneNumber: string): void {
    const context = this.conversations.get(phoneNumber);
    if (context) {
      context.lastMessageAt = new Date();
    }
  }

  /**
   * Limpia el contexto de una conversación (vuelve a IDLE)
   */
  clearContext(phoneNumber: string): void {
    this.conversations.delete(phoneNumber);
    this.logger.log(`Contexto limpiado para ${phoneNumber}`);
  }

  /**
   * Verifica si el usuario está esperando una confirmación
   */
  isWaitingConfirmation(phoneNumber: string): boolean {
    const context = this.getContext(phoneNumber);
    return context?.state === ConversationState.WAITING_CONFIRMATION;
  }

  /**
   * Verifica si el usuario está esperando un número de casa
   */
  isWaitingHouseNumber(phoneNumber: string): boolean {
    const context = this.getContext(phoneNumber);
    return context?.state === ConversationState.WAITING_HOUSE_NUMBER;
  }

  /**
   * Verifica si el usuario está esperando datos faltantes
   */
  isWaitingMissingData(phoneNumber: string): boolean {
    const context = this.getContext(phoneNumber);
    return context?.state === ConversationState.WAITING_MISSING_DATA;
  }

  /**
   * Guarda los datos del voucher en el contexto para confirmación posterior
   */
  saveVoucherForConfirmation(
    phoneNumber: string,
    voucherData: StructuredDataWithCasa,
    gcsFilename?: string,
    originalFilename?: string,
    confirmationCode?: string,
  ): void {
    this.setContext(phoneNumber, ConversationState.WAITING_CONFIRMATION, {
      voucherData,
      gcsFilename,
      originalFilename,
      confirmationCode,
    });
  }

  /**
   * Obtiene los datos del voucher guardados para confirmación
   */
  getVoucherDataForConfirmation(phoneNumber: string): {
    voucherData: StructuredDataWithCasa;
    gcsFilename?: string;
    originalFilename?: string;
    confirmationCode?: string;
  } | null {
    const context = this.getContext(phoneNumber);

    if (!context || context.state !== ConversationState.WAITING_CONFIRMATION) {
      return null;
    }

    return {
      voucherData: context.data?.voucherData!,
      gcsFilename: context.data?.gcsFilename,
      originalFilename: context.data?.originalFilename,
    };
  }

  /**
   * Verifica si un mensaje es una confirmación (SI, si, Si, sí, SÍ, etc.)
   */
  isConfirmationMessage(message: string): boolean {
    const normalizedMessage = message.trim().toLowerCase();
    const confirmations = ['si', 'sí', 'yes', 'ok', 'confirmar', 'confirmo', 'correcto'];
    return confirmations.includes(normalizedMessage);
  }

  /**
   * Verifica si un mensaje es una negación (NO, no, etc.)
   */
  isNegationMessage(message: string): boolean {
    const normalizedMessage = message.trim().toLowerCase();
    const negations = ['no', 'cancelar', 'incorrecto', 'error'];
    return negations.includes(normalizedMessage);
  }

  /**
   * Extrae número de casa de un mensaje
   * Usa los valores de negocio configurados (min-max casas)
   */
  extractHouseNumber(message: string): number | null {
    const { min, max } = BusinessValues.houses;
    const match = message.match(/\b([1-9]|[1-5][0-9]|6[0-6])\b/);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num >= min && num <= max) {
        return num;
      }
    }
    return null;
  }

  /**
   * Limpia sesiones expiradas automáticamente
   */
  private cleanExpiredSessions(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [phoneNumber, context] of this.conversations.entries()) {
      const isExpired = now - context.lastMessageAt.getTime() > this.SESSION_TIMEOUT_MS;

      if (isExpired) {
        this.conversations.delete(phoneNumber);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.log(`Limpiadas ${cleanedCount} sesiones expiradas`);
    }
  }

  /**
   * Obtiene estadísticas de sesiones activas
   */
  getStats(): {
    totalSessions: number;
    byState: Record<ConversationState, number>;
  } {
    const stats = {
      totalSessions: this.conversations.size,
      byState: {
        [ConversationState.IDLE]: 0,
        [ConversationState.WAITING_CONFIRMATION]: 0,
        [ConversationState.WAITING_HOUSE_NUMBER]: 0,
        [ConversationState.WAITING_MISSING_DATA]: 0,
        [ConversationState.WAITING_CORRECTION_TYPE]: 0,
        [ConversationState.WAITING_CORRECTION_VALUE]: 0,
      },
    };

    for (const context of this.conversations.values()) {
      stats.byState[context.state]++;
    }

    return stats;
  }

  /**
   * Actualiza un campo específico del voucher en el contexto
   */
  updateVoucherField(
    phoneNumber: string,
    fieldName: string,
    newValue: string,
  ): void {
    const context = this.getContext(phoneNumber);
    if (context?.data?.voucherData) {
      context.data.voucherData[fieldName] = newValue;
      context.lastMessageAt = new Date();
      this.logger.log(
        `Campo ${fieldName} actualizado para ${phoneNumber}: ${newValue}`,
      );
    }
  }

  /**
   * Obtiene el label en español del campo a corregir
   */
  getFieldLabel(field: string): string {
    const labels: Record<string, string> = {
      casa: 'Número de casa',
      referencia: 'Referencia bancaria',
      fecha_pago: 'Fecha de pago',
      hora_transaccion: 'Hora de transacción',
      monto: 'Monto',
    };
    return labels[field] || field;
  }

  /**
   * Identifica qué campos están faltantes en los datos del voucher
   * @returns Array de campos faltantes
   */
  identifyMissingFields(voucherData: StructuredDataWithCasa): string[] {
    const missingFields: string[] = [];

    if (!voucherData.monto || voucherData.monto.trim() === '') {
      missingFields.push('monto');
    }
    if (!voucherData.fecha_pago || voucherData.fecha_pago.trim() === '') {
      missingFields.push('fecha_pago');
    }
    if (!voucherData.referencia || voucherData.referencia.trim() === '') {
      missingFields.push('referencia');
    }
    if (!voucherData.hora_transaccion || voucherData.hora_transaccion.trim() === '') {
      missingFields.push('hora_transaccion');
    }
    if (!voucherData.casa) {
      missingFields.push('casa');
    }

    return missingFields;
  }

  /**
   * Obtiene el siguiente campo faltante a solicitar
   */
  getNextMissingField(phoneNumber: string): string | null {
    const context = this.getContext(phoneNumber);
    if (!context?.data?.missingFields || context.data.missingFields.length === 0) {
      return null;
    }
    return context.data.missingFields[0];
  }

  /**
   * Remueve un campo de la lista de campos faltantes
   */
  removeFromMissingFields(phoneNumber: string, field: string): void {
    const context = this.getContext(phoneNumber);
    if (context?.data?.missingFields) {
      context.data.missingFields = context.data.missingFields.filter(f => f !== field);
      this.logger.log(
        `Campo ${field} removido de campos faltantes para ${phoneNumber}. Quedan: ${context.data.missingFields.length}`,
      );
    }
  }

  /**
   * Verifica si todos los campos requeridos están completos
   */
  areAllFieldsComplete(phoneNumber: string): boolean {
    const context = this.getContext(phoneNumber);
    if (!context?.data?.missingFields) {
      return true;
    }
    return context.data.missingFields.length === 0;
  }
}
