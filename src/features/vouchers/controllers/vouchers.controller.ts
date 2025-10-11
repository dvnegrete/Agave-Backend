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
import { VouchersService } from '../services/vouchers.service';
import { OcrService } from '../services/ocr.service';
import { OcrServiceDto } from '../dto/ocr-service.dto';
import { WhatsAppMessageClassifierService } from '../services/whatsapp-message-classifier.service';
import { VoucherProcessorService } from '../services/voucher-processor.service';
import { WhatsAppMessagingService } from '../services/whatsapp-messaging.service';
import { ConversationStateService } from '../services/conversation-state.service';
import { ErrorMessages } from '@/shared/content';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { CloudStorageService } from '@/shared/libs/google-cloud';
// Use Cases
import { ProcessVoucherUseCase } from '../application/process-voucher.use-case';
import { HandleWhatsAppMessageUseCase } from '../application/handle-whatsapp-message.use-case';

@Controller('vouchers')
export class VouchersController {
  constructor(
    private readonly vouchersService: VouchersService,
    private readonly ocrService: OcrService,
    private readonly messageClassifier: WhatsAppMessageClassifierService,
    private readonly voucherProcessor: VoucherProcessorService,
    private readonly whatsappMessaging: WhatsAppMessagingService,
    private readonly conversationState: ConversationStateService,
    private readonly voucherRepository: VoucherRepository,
    private readonly cloudStorageService: CloudStorageService,
    // Use Cases
    private readonly processVoucherUseCase: ProcessVoucherUseCase,
    private readonly handleWhatsAppMessageUseCase: HandleWhatsAppMessageUseCase,
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

  @Get('ocr-service/status')
  async getOcrStatus(): Promise<{
    isConfigured: boolean;
    services: {
      vision: boolean;
      storage: boolean;
      translate: boolean;
      textToSpeech: boolean;
      speech: boolean;
    };
    projectId?: string;
    message: string;
  }> {
    try {
      const visionClient =
        this.ocrService['googleCloudClient'].getVisionClient();
      const translateClient =
        this.ocrService['googleCloudClient'].getTranslateClient();
      const textToSpeechClient =
        this.ocrService['googleCloudClient'].getTextToSpeechClient();
      const speechClient =
        this.ocrService['googleCloudClient'].getSpeechClient();

      const config = this.ocrService['googleCloudClient'].getConfig();

      let storageAvailable = false;
      try {
        const storageClient = this.ocrService['googleCloudClient'].getStorageClient();
        storageAvailable = !!storageClient;
      } catch {
        storageAvailable = false;
      }

      return {
        isConfigured: this.ocrService['googleCloudClient'].isReady(),
        services: {
          vision: !!visionClient,
          storage: storageAvailable,
          translate: !!translateClient,
          textToSpeech: !!textToSpeechClient,
          speech: !!speechClient,
        },
        projectId: config?.projectId,
        message: this.ocrService['googleCloudClient'].isReady()
          ? 'Google Cloud está configurado y funcionando correctamente'
          : 'Google Cloud no está configurado o hay errores en la configuración',
      };
    } catch (error) {
      return {
        isConfigured: false,
        services: {
          vision: false,
          storage: false,
          translate: false,
          textToSpeech: false,
          speech: false,
        },
        message: `Error al verificar configuración: ${error.message}`,
      };
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
   */
  @Post('webhook/whatsapp')
  async receiveWhatsAppMessage(@Body() body: any) {
    try {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages?.[0];

      if (!messages) {
        return { success: true };
      }

      const phoneNumber = messages.from;
      const messageType = messages.type;

      console.log('Número de WhatsApp:', phoneNumber);
      console.log('Tipo de mensaje:', messageType);

      // CASO 1: Mensaje con imagen
      if (messageType === 'image' && messages.image) {
        const mediaId = messages.image.id;
        const mimeType = messages.image.mime_type;
        const caption = messages.image.caption || '';

        console.log(`Imagen recibida: ${mediaId}, tipo: ${mimeType}`);
        if (caption) console.log(`Caption: ${caption}`);

        await this.processVoucherUseCase.execute({
          phoneNumber,
          mediaId,
          mediaType: 'image',
        });
        return { success: true };
      }

      // CASO 2: Mensaje con documento (PDF)
      if (messageType === 'document' && messages.document) {
        const mediaId = messages.document.id;
        const mimeType = messages.document.mime_type;
        const filename = messages.document.filename || 'documento.pdf';

        console.log(`Documento recibido: ${mediaId}, tipo: ${mimeType}, nombre: ${filename}`);

        if (mimeType === 'application/pdf') {
          await this.processVoucherUseCase.execute({
            phoneNumber,
            mediaId,
            mediaType: 'document',
          });
        } else {
          await this.whatsappMessaging.sendTextMessage(
            phoneNumber,
            ErrorMessages.onlyPdfSupported,
          );
        }
        return { success: true };
      }

      // CASO 3: Mensaje interactivo (botones o listas)
      if (messageType === 'interactive' && messages.interactive) {
        let userResponse: string | undefined;

        if (messages.interactive.type === 'button_reply') {
          userResponse = messages.interactive.button_reply.id;
          console.log(`Botón presionado: ${userResponse}`);
        } else if (messages.interactive.type === 'list_reply') {
          userResponse = messages.interactive.list_reply.id;
          console.log(`Opción de lista seleccionada: ${userResponse}`);
        }

        if (!userResponse) {
          console.log('Mensaje interactivo sin respuesta identificable');
          return { success: true };
        }

        const context = this.conversationState.getContext(phoneNumber);

        if (context) {
          console.log(`Contexto activo detectado: ${context.state}`);
          await this.handleWhatsAppMessageUseCase.execute({
            phoneNumber,
            messageText: userResponse,
          });
        }

        return { success: true };
      }

      // CASO 4: Mensaje de texto
      if (messageType === 'text' && messages.text) {
        const messageText = messages.text.body || '';
        console.log('Mensaje de texto recibido:', messageText);

        const context = this.conversationState.getContext(phoneNumber);

        if (context) {
          console.log(`Contexto activo detectado: ${context.state}`);
          await this.handleWhatsAppMessageUseCase.execute({
            phoneNumber,
            messageText,
          });
          return { success: true };
        }

        // Sin contexto, usar clasificador de IA
        console.log('No hay contexto activo, clasificando mensaje...');
        const classification = await this.messageClassifier.classifyMessage(messageText);

        console.log('Clasificación:', {
          intent: classification.intent,
          confidence: classification.confidence,
        });

        await this.whatsappMessaging.sendTextMessage(phoneNumber, classification.response);
        return { success: true };
      }

      // CASO 5: Otros tipos de mensaje no soportados
      console.log(`Tipo de mensaje no soportado: ${messageType}`);
      await this.whatsappMessaging.sendTextMessage(
        phoneNumber,
        ErrorMessages.unsupportedMessageType,
      );

      return { success: true };
    } catch (error) {
      console.error('Error procesando mensaje de WhatsApp:', error);
      throw new BadRequestException('Error processing WhatsApp message');
    }
  }
}
