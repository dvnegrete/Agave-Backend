import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
  UnauthorizedException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VouchersService } from '../infrastructure/persistence/vouchers.service';
import { OcrService } from '../infrastructure/ocr/ocr.service';
import { OcrServiceDto } from '../dto/ocr-service.dto';
import { VoucherProcessorService } from '../infrastructure/ocr/voucher-processor.service';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { CloudStorageService } from '@/shared/libs/google-cloud';
// Use Cases
import { HandleWhatsAppWebhookUseCase } from '../application/handle-whatsapp-webhook.use-case';
import { HandleTelegramWebhookUseCase } from '../application/handle-telegram-webhook.use-case';
import { TelegramWebhookDto } from '../dto/telegram-webhook.dto';
// Infrastructure
import { TelegramMessagingService } from '../infrastructure/telegram/telegram-messaging.service';
import { TelegramApiService } from '../infrastructure/telegram/telegram-api.service';

@Controller('vouchers')
export class VouchersController {
  constructor(
    private readonly vouchersService: VouchersService,
    private readonly ocrService: OcrService,
    private readonly voucherProcessor: VoucherProcessorService,
    private readonly voucherRepository: VoucherRepository,
    private readonly cloudStorageService: CloudStorageService,
    // Use Cases
    private readonly handleWhatsAppWebhookUseCase: HandleWhatsAppWebhookUseCase,
    private readonly handleTelegramWebhookUseCase: HandleTelegramWebhookUseCase,
    // Telegram Services
    private readonly telegramMessaging: TelegramMessagingService,
    private readonly telegramApi: TelegramApiService,
  ) {}

  @Post('ocr-service')
  @UseInterceptors(FileInterceptor('file'))
  async processOcr(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({
            fileType: '.(jpg|jpeg|png|gif|bmp|webp|tiff|pdf)',
          }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() ocrServiceDto: OcrServiceDto,
  ) {
    try {
      const result = await this.voucherProcessor.processVoucher(
        file.buffer,
        file.originalname,
        ocrServiceDto.language,
      );

      return {
        structuredData: result.structuredData,
        whatsappMessage: result.whatsappMessage,
        originalFilename: result.originalFilename,
        gcsFilename: result.gcsFilename,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  @Get()
  async getAllTransactions(
    @Query('confirmation_status') confirmationStatus?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (confirmationStatus !== undefined) {
      const isConfirmed = confirmationStatus === 'true';
      return await this.vouchersService.getTransactionsByStatus(isConfirmed);
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      return await this.vouchersService.getTransactionsByDateRange(start, end);
    }

    return await this.vouchersService.getAllTransactions();
  }

  @Get(':id')
  async getTransactionById(@Param('id') id: string) {
    const voucher = await this.voucherRepository.findById(parseInt(id));

    if (!voucher) {
      throw new NotFoundException(`Voucher con ID ${id} no encontrado`);
    }

    let viewUrl: string | null = null;
    if (voucher.url) {
      try {
        viewUrl = await this.cloudStorageService.getSignedUrl(voucher.url, {
          expiresInMinutes: 60,
          action: 'read',
        });
      } catch (error) {
        console.error(
          `⚠️  Error al generar URL de visualización para voucher ${id}: ${error.message}`,
        );
        viewUrl = null;
      }
    }

    return {
      confirmation_status: voucher.confirmation_status,
      url: voucher.url,
      viewUrl,
    };
  }

  @Get('webhook/whatsapp')
  verifyWebhook(
    @Query('hub.mode') mode?: string,
    @Query('hub.challenge') challenge?: string,
    @Query('hub.verify_token') verifyToken?: string,
  ) {
    const expectedToken = process.env.ACCESS_TOKEN_VERIFY_WA;

    if (!expectedToken) {
      throw new UnauthorizedException('Access token not configured');
    }

    if (mode === 'subscribe' && verifyToken === expectedToken) {
      return challenge;
    }

    throw new UnauthorizedException('Invalid verification token');
  }

  /**
   * Webhook de WhatsApp - Recibe y procesa mensajes entrantes
   *
   * IMPORTANTE: Este endpoint debe responder en menos de 20 segundos o WhatsApp
   * considerará que falló. Por eso procesamos el mensaje de forma asíncrona
   * y respondemos inmediatamente con success: true.
   *
   * DEDUPLICACIÓN: WhatsApp puede reintentar enviar el mismo mensaje si:
   * - No recibe respuesta en 20 segundos
   * - Recibe un error 5xx
   * - Hay problemas de red
   *
   * Para prevenir procesamiento duplicado, validamos la estructura básica
   * del webhook y usamos el message.id para detectar duplicados.
   */
  @Post('webhook/whatsapp')
  receiveWhatsAppMessage(@Body() body: unknown) {
    // Validación básica de la estructura del webhook
    // Esto ayuda a rechazar payloads malformados antes de procesarlos
    const isObject = body && typeof body === 'object';
    const hasEntry =
      isObject &&
      'entry' in body &&
      Array.isArray(body.entry) &&
      body.entry.length > 0;

    if (!hasEntry) {
      // Respondemos con éxito para que WhatsApp no reintente
      // (probablemente es spam o un webhook de status)
      return { success: true };
    }

    // Procesar el mensaje de forma asíncrona (fire-and-forget)
    // No esperamos a que termine para responder a WhatsApp

    this.handleWhatsAppWebhookUseCase.execute(body as any).catch((error) => {
      console.error('❌ Error procesando mensaje de WhatsApp:', error);
      // IMPORTANTE: No re-lanzamos el error para que el controlador
      // siempre responda 200 a WhatsApp y evite reintentos
    });

    // Responder inmediatamente a WhatsApp para evitar timeout
    return { success: true };
  }

  /**
   * Webhook de Telegram - Recibe y procesa updates del bot
   *
   * IMPORTANTE: Este endpoint debe responder rápidamente o Telegram
   * puede considerar que el webhook no está funcionando.
   * Procesamos el mensaje de forma asíncrona y respondemos inmediatamente.
   *
   * Los updates de Telegram incluyen:
   * - Mensajes de texto
   * - Fotos y documentos
   * - Callback queries (botones inline presionados)
   * - Comandos (/start, /ayuda, etc.)
   */
  @Post('webhook/telegram')
  receiveTelegramUpdate(@Body() body: TelegramWebhookDto) {
    // Validación básica de la estructura del webhook
    if (!body || !body.update_id) {
      return { success: true };
    }

    // Procesar el update de forma asíncrona (fire-and-forget)
    this.handleTelegramWebhookUseCase.execute(body).catch((error) => {
      console.error('❌ Error procesando update de Telegram:', error);
      // IMPORTANTE: No re-lanzamos el error para que el controlador
      // siempre responda 200 a Telegram
    });

    // Responder inmediatamente a Telegram
    return { ok: true };
  }

  /**
   * ENDPOINT TEMPORAL DE PRUEBA - Verificar configuración de Telegram
   * Eliminar después de verificar que funciona
   */
  @Get('telegram/test')
  async testTelegram(@Query('chat_id') chatId?: string) {
    try {
      // 1. Verificar que el servicio está configurado
      if (!this.telegramApi.isConfigured()) {
        return {
          error: 'TELEGRAM_BOT_TOKEN no está configurado en las variables de entorno',
          configured: false,
        };
      }

      // 2. Obtener información del bot
      const botInfo = await this.telegramApi.getMe();

      // 3. Obtener información del webhook
      const webhookInfo = await this.telegramApi.getWebhookInfo();

      // 4. Si se proporciona chat_id, enviar mensaje de prueba
      let testMessageSent = false;
      if (chatId) {
        await this.telegramMessaging.sendTextMessage(
          chatId,
          '✅ ¡Prueba exitosa! El bot de Telegram está funcionando correctamente.',
        );
        testMessageSent = true;
      }

      return {
        success: true,
        bot: {
          id: botInfo.id,
          username: botInfo.username,
          first_name: botInfo.first_name,
        },
        webhook: {
          url: webhookInfo.url,
          has_custom_certificate: webhookInfo.has_custom_certificate,
          pending_update_count: webhookInfo.pending_update_count,
          last_error_date: webhookInfo.last_error_date,
          last_error_message: webhookInfo.last_error_message,
        },
        testMessage: testMessageSent
          ? `Mensaje enviado al chat_id: ${chatId}`
          : 'No se envió mensaje de prueba (proporciona ?chat_id=TU_CHAT_ID para enviar)',
      };
    } catch (error) {
      return {
        error: error.message,
        stack: error.stack,
      };
    }
  }

  /**
   * ENDPOINT TEMPORAL - Obtener updates recientes (últimos mensajes)
   * Úsalo para obtener tu chat_id
   */
  @Get('telegram/get-updates')
  async getTelegramUpdates() {
    try {
      if (!this.telegramApi.isConfigured()) {
        return {
          error: 'TELEGRAM_BOT_TOKEN no está configurado',
        };
      }

      const botToken = process.env.TELEGRAM_BOT_TOKEN;

      // Llamar directamente a la API de Telegram para obtener updates
      const response = await fetch(
        `https://api.telegram.org/bot${botToken}/getUpdates`,
      );
      const data = await response.json();

      if (!data.ok) {
        return {
          error: 'Error al obtener updates',
          details: data,
        };
      }

      // Extraer chat_ids de los updates
      const chatIds = data.result
        .map((update: any) => ({
          chat_id: update.message?.chat?.id || update.callback_query?.message?.chat?.id,
          username: update.message?.from?.username || update.callback_query?.from?.username,
          first_name: update.message?.from?.first_name || update.callback_query?.from?.first_name,
          message_text: update.message?.text,
          date: update.message?.date,
        }))
        .filter((item: any) => item.chat_id);

      return {
        success: true,
        total_updates: data.result.length,
        chat_ids: chatIds,
        instruction: 'Si no ves tu chat_id, envía /start al bot y vuelve a consultar este endpoint',
        raw_updates: data.result,
      };
    } catch (error) {
      return {
        error: error.message,
        stack: error.stack,
      };
    }
  }

  /**
   * ENDPOINT TEMPORAL - Configurar webhook de Telegram
   * Eliminar después de configurar
   */
  @Post('telegram/setup-webhook')
  async setupTelegramWebhook(@Body('webhook_url') webhookUrl?: string) {
    try {
      if (!this.telegramApi.isConfigured()) {
        return {
          error: 'TELEGRAM_BOT_TOKEN no está configurado',
        };
      }

      // Usar TELEGRAM_WEBHOOK_URL del .env si no se proporciona
      const url =
        webhookUrl || process.env.TELEGRAM_WEBHOOK_URL || '';

      if (!url) {
        return {
          error: 'Proporciona webhook_url en el body o configura TELEGRAM_WEBHOOK_URL en .env',
          example: {
            webhook_url: 'https://tu-dominio.com/vouchers/webhook/telegram',
          },
        };
      }

      const result = await this.telegramApi.setWebhook(url);

      return {
        success: result,
        webhook_url: url,
        message: result
          ? 'Webhook configurado exitosamente'
          : 'Error al configurar webhook',
      };
    } catch (error) {
      return {
        error: error.message,
        stack: error.stack,
      };
    }
  }
}
