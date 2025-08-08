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

@Controller('vouchers')
export class VouchersController {
  constructor(private readonly vouchersService: VouchersService) {}

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
