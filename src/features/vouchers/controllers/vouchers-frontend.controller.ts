import {
  Controller,
  Post,
  Body,
  UploadedFile,
  UseInterceptors,
  Headers,
  Query,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiConsumes,
  ApiResponse,
  ApiBody,
} from '@nestjs/swagger';
import { Express } from 'express';
import { UploadVoucherFrontendUseCase } from '../application/upload-voucher-frontend.use-case';
import { ConfirmVoucherFrontendUseCase } from '../application/confirm-voucher-frontend.use-case';
import { UploadVoucherFrontendDto } from '../dto/frontend-upload-voucher.dto';
import { ConfirmVoucherFromFrontendDto } from '../dto/frontend-save-draft.dto';
import {
  FrontendVoucherResponseDto,
  ConfirmVoucherResponseDto,
} from '../dto/frontend-voucher-response.dto';

/**
 * Controller: Frontend Voucher Processing (Stateless HTTP API)
 *
 * Flujo simplificado de 2 pasos:
 * 1. POST /vouchers/frontend/upload - User sube comprobante, obtiene datos extraídos
 * 2. POST /vouchers/frontend/confirm - User confirma datos (Frontend retiene estado)
 *
 * Arquitectura STATELESS: El Frontend retiene toda la información entre pasos.
 * No se requiere almacenamiento temporal en el Backend.
 */
@ApiTags('Vouchers Frontend')
@Controller('vouchers/frontend')
export class VouchersFrontendController {
  private readonly logger = new Logger(VouchersFrontendController.name);

  constructor(
    private readonly uploadUseCase: UploadVoucherFrontendUseCase,
    private readonly confirmUseCase: ConfirmVoucherFrontendUseCase,
  ) {}

  /**
   * Endpoint 1: Upload y procesar voucher (OCR)
   *
   * Frontend envía:
   * - file: Imagen o PDF del comprobante
   * - language (opcional): Código de idioma ('es', 'en', etc.)
   *
   * Backend retorna:
   * - Datos extraídos estructurados (monto, fecha, casa, etc.)
   * - Validación con campos faltantes si aplica
   * - URL del archivo en GCS (gcsFilename)
   * - Sugerencias (casa detectada, hora asignada, etc.)
   *
   * Frontend retiene esta información y la reenviará en el paso 2 (confirm)
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: 'Upload comprobante y extraer datos con OCR',
    description:
      'Sube una imagen o PDF del comprobante de pago. El servidor procesa con OCR y retorna los datos estructurados.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Imagen o PDF del comprobante (max 10MB)',
        },
        language: {
          type: 'string',
          example: 'es',
          description: 'Código de idioma (es, en, etc.). Default: es',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Datos extraídos exitosamente',
    type: FrontendVoucherResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Archivo inválido o no soportado',
  })
  @ApiResponse({
    status: 500,
    description: 'Error en OCR o Google Cloud',
  })
  async uploadVoucher(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: UploadVoucherFrontendDto,
    @Headers('authorization') authHeader?: string,
    @Query('userId') queryUserId?: string,
  ): Promise<FrontendVoucherResponseDto> {
    // Validar que el archivo exista
    if (!file) {
      throw new BadRequestException('El archivo es requerido');
    }

    // Validar que no esté vacío
    if (file.size === 0) {
      throw new BadRequestException('El archivo no puede estar vacío');
    }

    this.logger.debug(
      `Upload recibido: ${file.originalname} (${file.size} bytes)`,
    );

    // Extraer userId de múltiples fuentes (prioridad: token > query > body > null)
    const userId = this.extractUserId(authHeader, queryUserId, dto.userId);

    try {
      return await this.uploadUseCase.execute({
        fileBuffer: file.buffer,
        filename: file.originalname,
        language: dto.language,
        userId,
      });
    } catch (error) {
      this.logger.error(`Error en upload: ${error.message}`);
      throw new BadRequestException(
        error.message || 'Error procesando el comprobante',
      );
    }
  }

  /**
   * Endpoint 2: Confirmar y registrar voucher (Stateless)
   *
   * Frontend envía:
   * - Todos los datos (monto, fecha, casa, referencia, gcsFilename, etc.)
   * - Opcionalmente: userId (si autenticado)
   *
   * Backend:
   * - Valida todos los datos
   * - Detecta duplicados
   * - Genera código de confirmación único
   * - Crea relaciones multi-tabla (User, Record, House, HouseRecord) en transacción ACID
   * - Retorna código de confirmación
   *
   * El usuario recibe el código de confirmación para futuras consultas
   *
   * NOTA: Arquitectura STATELESS - No se requiere almacenamiento temporal.
   * El Frontend retiene toda la información entre pasos.
   */
  @Post('confirm')
  @ApiOperation({
    summary: 'Confirmar y registrar voucher en BD',
    description:
      'Confirma el draft y lo registra en la base de datos. Genera un código de confirmación único para futuras consultas.',
  })
  @ApiResponse({
    status: 200,
    description: 'Voucher confirmado exitosamente',
    type: ConfirmVoucherResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Draft inválido o datos incompletos',
  })
  @ApiResponse({
    status: 404,
    description: 'Draft no encontrado',
  })
  @ApiResponse({
    status: 409,
    description: 'Voucher duplicado o ya confirmado',
  })
  async confirmVoucher(
    @Body() dto: ConfirmVoucherFromFrontendDto,
    @Headers('authorization') authHeader?: string,
    @Query('userId') queryUserId?: string,
  ): Promise<ConfirmVoucherResponseDto> {
    this.logger.debug(
      `Confirm recibido para casa=${dto.casa}, monto=${dto.monto}`
    );

    // Extraer userId
    const userId = this.extractUserId(authHeader, queryUserId, dto.userId);

    try {
      return await this.confirmUseCase.execute({
        ...dto,
        userId,
      });
    } catch (error) {
      this.logger.error(`Error confirmando voucher: ${error.message}`);

      // Re-lanzar errores específicos para que NestJS maneje los status codes correctamente
      throw error;
    }
  }

  /**
   * Extrae el userId de múltiples fuentes con prioridad
   *
   * Orden de búsqueda:
   * 1. JWT token en header Authorization (Bearer <token>)
   * 2. Query parameter userId
   * 3. Campo userId en body
   * 4. null (anónimo)
   */
  private extractUserId(
    authHeader?: string,
    queryUserId?: string,
    bodyUserId?: string | null,
  ): string | null {
    // 1. Intentar extraer del JWT token
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const token = authHeader.substring(7);
        // TODO: Implementar decodificación del JWT
        // const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // return decoded.sub || decoded.userId;
        // Por ahora, solo retornar null para evitar errores
      } catch (error) {
        this.logger.warn(`Token JWT inválido: ${error.message}`);
        // Continuar con siguiente opción
      }
    }

    // 2. Usar query parameter
    if (queryUserId) {
      return queryUserId;
    }

    // 3. Usar campo en body
    if (bodyUserId) {
      return bodyUserId;
    }

    // 4. Anónimo
    return null;
  }
}
