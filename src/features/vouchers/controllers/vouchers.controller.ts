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
import { WhatsAppWebhookDto } from '../dto/whatsapp-webhook.dto';
import { VoucherProcessorService } from '../infrastructure/ocr/voucher-processor.service';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { CloudStorageService } from '@/shared/libs/google-cloud';
// Use Cases
import { HandleWhatsAppWebhookUseCase } from '../application/handle-whatsapp-webhook.use-case';

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
   */
  @Post('webhook/whatsapp')
  receiveWhatsAppMessage(@Body() body: any) {
    // Procesar el mensaje de forma asíncrona (fire-and-forget)
    // No esperamos a que termine para responder a WhatsApp
    this.handleWhatsAppWebhookUseCase.execute(body).catch((error) => {
      console.error('Error procesando mensaje de WhatsApp:', error);
    });

    // Responder inmediatamente a WhatsApp para evitar timeout
    return { success: true };
  }
}
