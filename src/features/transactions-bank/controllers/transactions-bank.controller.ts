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
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TransactionsBankService } from '../services/transactions-bank.service';
import {
  CreateTransactionBankDto,
  UpdateTransactionBankDto,
  ReconciliationDto,
} from '../dto/transaction-bank.dto';
import { UploadFileDto } from '../dto/upload-file.dto';
import { ProcessedBankTransaction } from '../interfaces/transaction-bank.interface';
import { BankFileValidator } from '../validators/bank-file.validator';

@Controller('transactions-bank')
export class TransactionsBankController {
  constructor(
    private readonly transactionsBankService: TransactionsBankService,
  ) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: 10 * 1024 * 1024, // 10MB
            message: 'El archivo es demasiado grande. Tamaño máximo: 10MB',
          }),
          new BankFileValidator({
            allowedExtensions: ['.csv', '.xlsx', '.txt', '.json'],
            allowedMimeTypes: [
              'text/csv',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
              'text/plain',
              'application/json',
            ],
          }),
        ],
        fileIsRequired: true,
        exceptionFactory: (error) => {
          return new BadRequestException(error);
        },
      }),
    )
    file: Express.Multer.File,
    @Body() uploadFileDto: UploadFileDto,
    @Query('bank') bank?: string,
  ) {
    try {
      // Combinar el parámetro bank del query con las opciones del DTO
      const options: UploadFileDto = {
        ...uploadFileDto,
        bank: bank || uploadFileDto.bank,
      };

      const result = await this.transactionsBankService.processFile(
        file,
        options,
      );
      return {
        message: 'Archivo de transacciones bancarias procesado exitosamente',
        ...result,
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error ? error.message : 'Error al procesar el archivo',
      );
    }
  }

  @Get()
  async getAllTransactions(
    @Query('status') status?: 'pending' | 'processed' | 'failed' | 'reconciled',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    if (status) {
      return await this.transactionsBankService.getTransactionsByStatus(status);
    }

    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      return await this.transactionsBankService.getTransactionsByDateRange(
        start,
        end,
      );
    }

    return await this.transactionsBankService.getAllTransactions();
  }

  @Get('summary')
  async getTransactionSummary() {
    return await this.transactionsBankService.getTransactionSummary();
  }

  @Get(':id')
  async getTransactionById(
    @Param('id') id: string,
  ): Promise<ProcessedBankTransaction> {
    return await this.transactionsBankService.getTransactionById(id);
  }

  @Post()
  async createTransaction(
    @Body() createTransactionDto: CreateTransactionBankDto,
  ): Promise<ProcessedBankTransaction> {
    return await this.transactionsBankService.createTransaction(
      createTransactionDto,
    );
  }

  @Put(':id')
  async updateTransaction(
    @Param('id') id: string,
    @Body() updateTransactionDto: UpdateTransactionBankDto,
  ): Promise<ProcessedBankTransaction> {
    return await this.transactionsBankService.updateTransaction(
      id,
      updateTransactionDto,
    );
  }

  @Delete(':id')
  async deleteTransaction(
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    await this.transactionsBankService.deleteTransaction(id);
    return { message: 'Transacción bancaria eliminada exitosamente' };
  }

  @Post('batch')
  async createBatchTransactions(
    @Body() transactions: CreateTransactionBankDto[],
  ): Promise<ProcessedBankTransaction[]> {
    const results: ProcessedBankTransaction[] = [];
    const errors: string[] = [];

    for (let i = 0; i < transactions.length; i++) {
      try {
        const result = await this.transactionsBankService.createTransaction(
          transactions[i],
        );
        results.push(result);
      } catch (error) {
        errors.push(
          `Transacción ${i + 1}: ${error instanceof Error ? error.message : 'Error desconocido'}`,
        );
      }
    }

    if (errors.length > 0) {
      throw new BadRequestException({
        message: 'Algunas transacciones bancarias no pudieron ser procesadas',
        successful: results.length,
        failed: errors.length,
        errors,
      });
    }

    return results;
  }

  @Post('reconcile')
  async reconcileTransactions(@Body() reconciliationDto: ReconciliationDto) {
    try {
      const result =
        await this.transactionsBankService.reconcileTransactions(
          reconciliationDto,
        );
      return {
        message: 'Reconciliación completada',
        ...result,
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : 'Error al realizar la reconciliación',
      );
    }
  }

  @Get('export/csv')
  async exportToCSV(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: 'pending' | 'processed' | 'failed' | 'reconciled',
  ) {
    let transactions: ProcessedBankTransaction[];

    if (status) {
      transactions =
        await this.transactionsBankService.getTransactionsByStatus(status);
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      transactions =
        await this.transactionsBankService.getTransactionsByDateRange(
          start,
          end,
        );
    } else {
      transactions = await this.transactionsBankService.getAllTransactions();
    }

    const csvContent = this.generateCSV(transactions);

    return {
      content: csvContent,
      filename: `bank_transactions_${new Date().toISOString().split('T')[0]}.csv`,
      count: transactions.length,
    };
  }

  @Get('export/json')
  async exportToJSON(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('status') status?: 'pending' | 'processed' | 'failed' | 'reconciled',
  ) {
    let transactions: ProcessedBankTransaction[];

    if (status) {
      transactions =
        await this.transactionsBankService.getTransactionsByStatus(status);
    } else if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      transactions =
        await this.transactionsBankService.getTransactionsByDateRange(
          start,
          end,
        );
    } else {
      transactions = await this.transactionsBankService.getAllTransactions();
    }

    return {
      transactions,
      exportDate: new Date().toISOString(),
      count: transactions.length,
    };
  }

  private generateCSV(transactions: ProcessedBankTransaction[]): string {
    const headers = [
      'ID',
      'Fecha',
      'Hora',
      'Concepto',
      'Monto',
      'Tipo',
      'Moneda',
      'Banco',
      'Estado',
      'Fecha de Creación',
    ];

    const rows = transactions.map((transaction) => [
      transaction.id,
      transaction.date,
      transaction.time,
      `"${transaction.concept.replace(/"/g, '""')}"`,
      transaction.amount,
      transaction.is_deposit ? 'DEPOSITO' : 'RETIRO',
      transaction.currency,
      transaction.bank_name || '',
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
