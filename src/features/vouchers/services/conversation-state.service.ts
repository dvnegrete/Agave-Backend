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
    missingFields?: string[];
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
  ): void {
    this.setContext(phoneNumber, ConversationState.WAITING_CONFIRMATION, {
      voucherData,
      gcsFilename,
      originalFilename,
    });
  }

  /**
   * Obtiene los datos del voucher guardados para confirmación
   */
  getVoucherDataForConfirmation(phoneNumber: string): {
    voucherData: StructuredDataWithCasa;
    gcsFilename?: string;
    originalFilename?: string;
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
      },
    };

    for (const context of this.conversations.values()) {
      stats.byState[context.state]++;
    }

    return stats;
  }
}
