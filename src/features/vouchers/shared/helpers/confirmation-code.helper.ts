import { generateConfirmationCode } from '@/shared/common/utils';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';

export interface ConfirmationCodeGenerationResult {
  success: boolean;
  code?: string;
  voucher?: any;
  error?: string;
}

/**
 * Genera un código de confirmación único con reintentos en caso de colisión
 * @param voucherRepository - Repositorio de vouchers
 * @param voucherData - Datos del voucher a crear
 * @param maxRetries - Número máximo de reintentos (default: 5)
 * @returns Resultado con el código generado y el voucher creado
 */
export async function generateUniqueConfirmationCode(
  voucherRepository: VoucherRepository,
  voucherData: any,
  maxRetries: number = 5,
): Promise<ConfirmationCodeGenerationResult> {
  // Validar amount antes de intentar insertar
  if (
    voucherData.amount === undefined ||
    voucherData.amount === null ||
    isNaN(voucherData.amount) ||
    !isFinite(voucherData.amount) ||
    voucherData.amount <= 0
  ) {
    return {
      success: false,
      error: `Amount inválido: ${voucherData.amount}. Debe ser un número positivo.`,
    };
  }

  let attempt = 0;

  while (attempt < maxRetries) {
    attempt++;
    const confirmationCode = generateConfirmationCode();

    try {
      // Intentar insertar voucher en la base de datos
      const voucher = await voucherRepository.create({
        ...voucherData,
        confirmation_code: confirmationCode,
      });

      return {
        success: true,
        code: confirmationCode,
        voucher,
      };
    } catch (error) {
      // Verificar si es un error de clave duplicada (código de confirmación)
      const isDuplicateError =
        error.code === '23505' ||
        error.message?.includes('duplicate key') ||
        error.message?.includes('unique constraint');

      if (isDuplicateError) {
        if (attempt >= maxRetries) {
          return {
            success: false,
            error: 'No se pudo generar un código único',
          };
        }
        // Continuar al siguiente intento
      } else {
        // Error diferente, no reintentar
        return {
          success: false,
          error: error.message || 'Error al registrar voucher',
        };
      }
    }
  }

  return {
    success: false,
    error: 'No se pudo generar un código único después de varios intentos',
  };
}
