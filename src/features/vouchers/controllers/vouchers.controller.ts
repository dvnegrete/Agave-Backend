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
import { CreateTransactionDto, UpdateTransactionDto } from '../dto/transaction.dto';
import { ProcessFileDto } from '../dto/process-file.dto';
import { ProcessedTransaction } from '../interfaces/transaction.interface';
import { OcrService } from '../services/ocr.service';
import { OcrServiceDto, OcrResponseDto } from '../dto/ocr-service.dto';

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
      const result = await this.vouchersService.processFile(file, processFileDto);
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
          new FileTypeValidator({ fileType: '.(jpg|jpeg|png|gif|bmp|webp|tiff|pdf)' }),
        ],
      }),
    )
    file: Express.Multer.File,
    @Body() ocrServiceDto: OcrServiceDto,
  ): Promise<OcrResponseDto> {
    try {
      // Validar formato de imagen
      await this.ocrService.validateImageFormat(file.buffer, file.originalname);

      // Procesar OCR
      const result = await this.ocrService.extractTextFromImage(
        file.buffer,
        file.originalname,
        ocrServiceDto.language,
      );
      return result;
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
      const visionClient = this.ocrService['googleCloudClient'].getVisionClient();
      const storageClient = this.ocrService['googleCloudClient'].getStorageClient();
      const translateClient = this.ocrService['googleCloudClient'].getTranslateClient();
      const textToSpeechClient = this.ocrService['googleCloudClient'].getTextToSpeechClient();
      const speechClient = this.ocrService['googleCloudClient'].getSpeechClient();

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
  async getTransactionById(@Param('id') id: string): Promise<ProcessedTransaction> {
    return await this.vouchersService.getTransactionById(id);
  }

  @Post()
  async createTransaction(@Body() createTransactionDto: CreateTransactionDto): Promise<ProcessedTransaction> {
    return await this.vouchersService.createTransaction(createTransactionDto);
  }

  @Put(':id')
  async updateTransaction(
    @Param('id') id: string,
    @Body() updateTransactionDto: UpdateTransactionDto,
  ): Promise<ProcessedTransaction> {
    return await this.vouchersService.updateTransaction(id, updateTransactionDto);
  }

  @Delete(':id')
  async deleteTransaction(@Param('id') id: string): Promise<{ message: string }> {
    await this.vouchersService.deleteTransaction(id);
    return { message: 'Transacción eliminada exitosamente' };
  }

  @Post('batch')
  async createBatchTransactions(@Body() transactions: CreateTransactionDto[]): Promise<ProcessedTransaction[]> {
    const results: ProcessedTransaction[] = [];
    const errors: string[] = [];

    for (let i = 0; i < transactions.length; i++) {
      try {
        const result = await this.vouchersService.createTransaction(transactions[i]);
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
      transactions = await this.vouchersService.getTransactionsByDateRange(start, end);
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
      transactions = await this.vouchersService.getTransactionsByDateRange(start, end);
    } else {
      transactions = await this.vouchersService.getAllTransactions();
    }

    return {
      transactions,
      exportDate: new Date().toISOString(),
      count: transactions.length,
    };
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

    const rows = transactions.map(transaction => [
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

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    return csvContent;
  }
}
