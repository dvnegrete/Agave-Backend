import {
  Controller,
  Post,
  Get,
  Delete,
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
  UseGuards,
  ParseIntPipe,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { VouchersService } from '../infrastructure/persistence/vouchers.service';
import { OcrService } from '../infrastructure/ocr/ocr.service';
import { OcrServiceDto } from '../dto/ocr-service.dto';
import { VoucherProcessorService } from '../infrastructure/ocr/voucher-processor.service';
import { VoucherRepository } from '@/shared/database/repositories/voucher.repository';
import { CloudStorageService } from '@/shared/libs/google-cloud';
import { AuthGuard } from '@/shared/auth/guards/auth.guard';
import { RoleGuard } from '@/shared/auth/guards/roles.guard';
import { Roles } from '@/shared/auth/decorators/roles.decorator';
import { Role } from '@/shared/database/entities/enums';
// Use Cases
import { HandleWhatsAppWebhookUseCase } from '../application/handle-whatsapp-webhook.use-case';
import {
  DeleteVoucherUseCase,
  DeleteVoucherOutput,
} from '../application/delete-voucher.use-case';
// Swagger Decorators
import {
  ApiGetAllVouchers,
  ApiGetVoucherById,
} from '../decorators/swagger.decorators';

@ApiTags('vouchers')
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
    private readonly deleteVoucherUseCase: DeleteVoucherUseCase,
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
  @ApiGetAllVouchers()
  async getAllTransactions(
    @Query('confirmation_status') confirmationStatus?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    let vouchers;

    if (confirmationStatus !== undefined) {
      const isConfirmed = confirmationStatus === 'true';
      vouchers =
        await this.vouchersService.getTransactionsByStatus(isConfirmed);
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      vouchers = await this.vouchersService.getTransactionsByDateRange(
        start,
        end,
      );
    } else {
      vouchers = await this.vouchersService.getAllTransactions();
    }

    // Transformar respuesta para incluir number_house
    return vouchers.map((voucher) => this.transformVoucherResponse(voucher));
  }

  @Get(':id')
  @ApiGetVoucherById()
  async getTransactionById(@Param('id') id: string) {
    const voucher = await this.voucherRepository.findByIdWithHouse(
      parseInt(id),
    );

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
        viewUrl = null;
      }
    }

    // Extraer número de casa de las relaciones
    const numberHouse = this.extractHouseNumber(voucher);

    return {
      confirmation_status: voucher.confirmation_status,
      url: voucher.url,
      viewUrl,
      number_house: numberHouse,
    };
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RoleGuard)
  @Roles(Role.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Eliminar un voucher no conciliado (solo admin)',
    description:
      'Elimina el voucher y su archivo en GCS. Los vouchers conciliados no se pueden eliminar.',
  })
  @ApiResponse({ status: 200, description: 'Voucher eliminado' })
  @ApiResponse({ status: 400, description: 'El voucher ya fue conciliado' })
  @ApiResponse({ status: 404, description: 'Voucher no encontrado' })
  async deleteVoucher(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<DeleteVoucherOutput> {
    return this.deleteVoucherUseCase.execute(id);
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
      // IMPORTANTE: No re-lanzamos el error para que el controlador
      // siempre responda 200 a WhatsApp y evite reintentos
    });

    // Responder inmediatamente a WhatsApp para evitar timeout
    return { success: true };
  }


  /**
   * Extrae el número de casa de un voucher con relaciones cargadas
   * @param voucher - Voucher con relaciones records -> house_records -> house
   * @returns Número de casa o null si no está asociado
   * @private
   */
  private extractHouseNumber(voucher: any): number | null {
    // Navegar por las relaciones: voucher -> records -> house_records -> house
    if (voucher.records && voucher.records.length > 0) {
      const record = voucher.records[0]; // Tomar el primer record
      if (record.houseRecords && record.houseRecords.length > 0) {
        const houseRecord = record.houseRecords[0]; // Tomar el primer house_record
        if (houseRecord.house && houseRecord.house.number_house) {
          return houseRecord.house.number_house;
        }
      }
    }
    return null;
  }

  /**
   * Transforma un voucher para incluir number_house en la respuesta
   * @param voucher - Voucher con relaciones cargadas
   * @returns Objeto voucher con number_house agregado, sin relaciones anidadas
   * @private
   */
  private transformVoucherResponse(voucher: any) {
    const numberHouse = this.extractHouseNumber(voucher);

    // Desestructurar para eliminar 'records' de la respuesta
    const { records, ...cleanVoucher } = voucher;

    // Retornar voucher limpio con number_house agregado
    return {
      ...cleanVoucher,
      number_house: numberHouse,
    };
  }
}
