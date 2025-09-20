import {
  Controller,
  Post,
  Get,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
  FileTypeValidator,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { VouchersService } from '../services/vouchers.service';
import {
  CreateTransactionDto,
  UpdateTransactionDto,
} from '../dto/transaction.dto';
import { ProcessFileDto } from '../dto/process-file.dto';
import { ProcessedTransaction } from '../interfaces/transaction.interface';
import { OcrService } from '../services/ocr.service';
import { OcrServiceDto, OcrResponseDto } from '../dto/ocr-service.dto';
import { getVouchersBusinessRules } from '@/shared/config/business-rules.config';

interface StructuredData {
  monto: string;
  fecha_pago: string;
  referencia: string;
  hora_transaccion: string;
}

interface StructuredDataWithCasa extends StructuredData {
  casa: number | null;
  faltan_datos?: boolean;
  pregunta?: string;
}

@Controller('vouchers')
export class VouchersController {
  constructor(
    private readonly vouchersService: VouchersService,
    private readonly ocrService: OcrService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }), // 10MB
          new FileTypeValidator({ fileType: '.(csv|txt|json|xml)' }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() processFileDto: ProcessFileDto,
  ) {
    try {
      const result = await this.vouchersService.processFile(
        file,
        processFileDto,
      );
      return {
        message: 'Archivo procesado exitosamente',
        ...result,
      };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

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
      // Validar formato de imagen
      await this.ocrService.validateImageFormat(file.buffer, file.originalname);

      // Procesar OCR
      const resultOCR = await this.ocrService.extractTextFromImage(
        file.buffer,
        file.originalname,
        ocrServiceDto.language,
      );
      const dataWithHouse = this.extractCentavos(resultOCR.structuredData);

      // Generar respuesta según los casos
      const whatsappMessage = this.generateWhatsAppMessage(dataWithHouse);

      return {
        ...resultOCR,
        structuredData: dataWithHouse,
        whatsappMessage,
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
      const storageClient =
        this.ocrService['googleCloudClient'].getStorageClient();
      const translateClient =
        this.ocrService['googleCloudClient'].getTranslateClient();
      const textToSpeechClient =
        this.ocrService['googleCloudClient'].getTextToSpeechClient();
      const speechClient =
        this.ocrService['googleCloudClient'].getSpeechClient();

      const config = this.ocrService['googleCloudClient'].getConfig();

      return {
        isConfigured: this.ocrService['googleCloudClient'].isReady(),
        services: {
          vision: !!visionClient,
          storage: !!storageClient,
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
    @Query('status') status?: 'pending' | 'processed' | 'failed',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (status) {
      return await this.vouchersService.getTransactionsByStatus(status);
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      return await this.vouchersService.getTransactionsByDateRange(start, end);
    }

    return await this.vouchersService.getAllTransactions();
  }

  @Get('summary')
  async getTransactionSummary() {
    return await this.vouchersService.getTransactionSummary();
  }

  @Get(':id')
  async getTransactionById(
    @Param('id') id: string,
  ): Promise<ProcessedTransaction> {
    return await this.vouchersService.getTransactionById(id);
  }

  @Post()
  async createTransaction(
    @Body() createTransactionDto: CreateTransactionDto,
  ): Promise<ProcessedTransaction> {
    return await this.vouchersService.createTransaction(createTransactionDto);
  }

  @Put(':id')
  async updateTransaction(
    @Param('id') id: string,
    @Body() updateTransactionDto: UpdateTransactionDto,
  ): Promise<ProcessedTransaction> {
    return await this.vouchersService.updateTransaction(
      id,
      updateTransactionDto,
    );
  }

  @Delete(':id')
  async deleteTransaction(
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    await this.vouchersService.deleteTransaction(id);
    return { message: 'Transacción eliminada exitosamente' };
  }

  @Post('batch')
  async createBatchTransactions(
    @Body() transactions: CreateTransactionDto[],
  ): Promise<ProcessedTransaction[]> {
    const results: ProcessedTransaction[] = [];
    const errors: string[] = [];

    for (let i = 0; i < transactions.length; i++) {
      try {
        const result = await this.vouchersService.createTransaction(
          transactions[i],
        );
        results.push(result);
      } catch (error) {
        errors.push(`Transacción ${i + 1}: ${error.message}`);
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Algunas transacciones no pudieron ser procesadas',
        successful: results.length,
        failed: errors.length,
        errors,
      });
    }

    return results;
  }

  @Get('export/csv')
  async exportToCSV(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: 'pending' | 'processed' | 'failed',
  ) {
    let transactions: ProcessedTransaction[];

    if (status) {
      transactions = await this.vouchersService.getTransactionsByStatus(status);
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      transactions = await this.vouchersService.getTransactionsByDateRange(
        start,
        end,
      );
    } else {
      transactions = await this.vouchersService.getAllTransactions();
    }

    const csvContent = this.generateCSV(transactions);

    return {
      content: csvContent,
      filename: `transactions_${new Date().toISOString().split('T')[0]}.csv`,
      count: transactions.length,
    };
  }

  @Get('export/json')
  async exportToJSON(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: 'pending' | 'processed' | 'failed',
  ) {
    let transactions: ProcessedTransaction[];

    if (status) {
      transactions = await this.vouchersService.getTransactionsByStatus(status);
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      transactions = await this.vouchersService.getTransactionsByDateRange(
        start,
        end,
      );
    } else {
      transactions = await this.vouchersService.getAllTransactions();
    }

    return {
      transactions,
      exportDate: new Date().toISOString(),
      count: transactions.length,
    };
  }

  private extractCentavos(
    structuredData: StructuredData,
  ): StructuredDataWithCasa {
    const modifiedData: StructuredDataWithCasa = {
      ...structuredData,
      casa: null,
    };
    const businessRules = getVouchersBusinessRules();

    if (modifiedData.monto) {
      const montoStr = String(modifiedData.monto);
      const parts = montoStr.split('.');

      if (parts.length === 2) {
        const centavos = parseInt(parts[1], 10);

        if (
          isNaN(centavos) ||
          centavos === 0 ||
          centavos > businessRules.maxCasas
        ) {
          modifiedData.casa = null;
        } else if (
          centavos >= businessRules.minCasas &&
          centavos <= businessRules.maxCasas
        ) {
          modifiedData.casa = centavos;
        } else {
          modifiedData.casa = null;
        }
      } else {
        modifiedData.casa = null;
      }
    } else {
      modifiedData.casa = null;
    }

    return modifiedData;
  }

  private generateWhatsAppMessage(data: StructuredDataWithCasa): string {
    // Caso 3: faltan_datos = true
    if (data.faltan_datos) {
      return `No pude extraer los siguientes datos del comprobante que enviaste. Por favor indícame los valores correctos para los siguientes conceptos:\n\n${data.pregunta || 'Datos faltantes no especificados'}`;
    }

    // Caso 2: faltan_datos = false y casa = null
    if (!data.faltan_datos && data.casa === null) {
      return `Para poder registrar tu pago por favor indica el número de casa a la que corresponde el pago: (El valor debe ser entre 1 y 66).`;
    }

    // Caso 1: faltan_datos = false y casa es un valor numérico
    if (!data.faltan_datos && typeof data.casa === 'number') {
      return `Voy a registrar tu pago con el estatus "pendiente verificación en banco" con los siguientes datos que he encontrado en el comprobante:
Monto de pago: ${data.monto}
Fecha de Pago: ${data.fecha_pago}
Numero de Casa: ${data.casa}
Referencia: ${data.referencia}
Hora de Transacción: ${data.hora_transaccion}

Si los datos son correctos, escribe SI`;
    }

    // Fallback
    return 'Error al procesar el comprobante. Por favor intenta nuevamente.';
  }

  private generateCSV(transactions: ProcessedTransaction[]): string {
    const headers = [
      'ID',
      'Fecha',
      'Descripción',
      'Monto',
      'Tipo',
      'Número de Cuenta',
      'Referencia',
      'Categoría',
      'Estado',
      'Fecha de Creación',
    ];

    const rows = transactions.map((transaction) => [
      transaction.id,
      transaction.date.toISOString().split('T')[0],
      `"${transaction.description.replace(/"/g, '""')}"`,
      transaction.amount,
      transaction.type,
      transaction.accountNumber,
      transaction.reference || '',
      transaction.category || '',
      transaction.status,
      transaction.createdAt.toISOString(),
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map((row) => row.join(',')),
    ].join('\n');
    return csvContent;
  }
}
