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
  UseGuards,
  BadRequestException,
  ParseFilePipe,
  MaxFileSizeValidator,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@/shared/auth/guards/auth.guard';
import { RoleGuard } from '@/shared/auth/guards/roles.guard';
import { Roles } from '@/shared/auth/decorators/roles.decorator';
import { Role } from '@/shared/database/entities/enums';
import { TransactionsBankService } from '../services/transactions-bank.service';
import {
  CreateTransactionBankDto,
  UpdateTransactionBankDto,
  ReconciliationDto,
} from '../dto/transaction-bank.dto';
import { UploadFileDto } from '../dto/upload-file.dto';
import { ProcessedBankTransaction } from '../interfaces/transaction-bank.interface';
import { BankFileValidator } from '../validators/bank-file.validator';
import {
  TransactionsBankSuccessMessages,
  TransactionsBankErrorMessages,
  BusinessValues,
} from '@/shared/content';
import {
  ApiUploadBankFile,
  ApiGetAllTransactions,
  ApiGetTransactionSummary,
  ApiGetTransactionById,
  ApiCreateTransaction,
  ApiUpdateTransaction,
  ApiDeleteTransaction,
  ApiReconcileTransactionsLegacy,
  ApiGetExpenses,
} from '../decorators/swagger.decorators';

@ApiTags('transactions-bank')
@Controller('transactions-bank')
export class TransactionsBankController {
  constructor(
    private readonly transactionsBankService: TransactionsBankService,
  ) {}

  @Post('upload')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  @ApiUploadBankFile()
  async uploadFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({
            maxSize: BusinessValues.files.maxSizeBytes,
            message: TransactionsBankErrorMessages.fileTooLarge,
          }),
          new BankFileValidator({
            allowedExtensions: [
              ...BusinessValues.files.allowedExtensions,
            ] as string[],
            allowedMimeTypes: [
              ...BusinessValues.files.allowedMimeTypes,
            ] as string[],
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
    @Query('bankName') bankName?: string,
  ) {
    try {
      // Combinar el parámetro bankName del query con las opciones del DTO
      const options: UploadFileDto = {
        ...uploadFileDto,
        bankName: bankName || uploadFileDto.bankName,
      };

      //TODO: Validar que el campo previouslyProcessedTransactions contenga información válida o eliminarlo si no es necesario
      const result = await this.transactionsBankService.processFile(
        file,
        options,
      );
      return {
        message: TransactionsBankSuccessMessages.fileProcessed,
        ...result,
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : TransactionsBankErrorMessages.fileProcessingError,
      );
    }
  }

  @Get()
  @UseGuards(AuthGuard)
  @ApiGetAllTransactions()
  async getAllTransactions(
    @Query('status') status?: 'pending' | 'processed' | 'failed' | 'reconciled',
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    let transactions: ProcessedBankTransaction[];

    if (status) {
      transactions =
        await this.transactionsBankService.getTransactionsByStatus(status);
    } else if (startDate && endDate) {
      transactions =
        await this.transactionsBankService.getTransactionsByDateRange(
          startDate,
          endDate,
        );
    } else {
      transactions = await this.transactionsBankService.getAllTransactions();
    }
    return {
      transactions,
      total: transactions.length,
    };
  }

  @Get('summary')
  @UseGuards(AuthGuard)
  @ApiGetTransactionSummary()
  async getTransactionSummary() {
    return await this.transactionsBankService.getTransactionSummary();
  }

  @Get('expenses')
  @UseGuards(AuthGuard)
  @ApiGetExpenses()
  async getExpenses(@Query('date') date?: string) {
    if (!date) {
      throw new BadRequestException('La fecha es requerida (formato: YYYY-MM-DD)');
    }
    return await this.transactionsBankService.getExpensesByMonth(date);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiGetTransactionById()
  async getTransactionById(
    @Param('id') id: string,
  ): Promise<ProcessedBankTransaction> {
    return await this.transactionsBankService.getTransactionById(id);
  }

  @Post()
  @UseGuards(AuthGuard)
  @ApiCreateTransaction()
  async createTransaction(
    @Body() createTransactionDto: CreateTransactionBankDto,
  ): Promise<ProcessedBankTransaction> {
    return await this.transactionsBankService.createTransaction(
      createTransactionDto,
    );
  }

  @Put(':id')
  @UseGuards(AuthGuard)
  @ApiUpdateTransaction()
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
  @UseGuards(AuthGuard)
  @ApiDeleteTransaction()
  async deleteTransaction(
    @Param('id') id: string,
  ): Promise<{ message: string }> {
    await this.transactionsBankService.deleteTransaction(id);
    return { message: TransactionsBankSuccessMessages.transactionDeleted };
  }

  @Post('batch')
  @UseGuards(AuthGuard)
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
        message: TransactionsBankErrorMessages.batchProcessingError,
        successful: results.length,
        failed: errors.length,
        errors,
      });
    }

    return results;
  }

  @Post('reconcile')
  @UseGuards(AuthGuard)
  @ApiReconcileTransactionsLegacy()
  async reconcileTransactions(@Body() reconciliationDto: ReconciliationDto) {
    try {
      const result =
        await this.transactionsBankService.reconcileTransactions(
          reconciliationDto,
        );
      return {
        message: TransactionsBankSuccessMessages.reconciliationCompleted,
        ...result,
      };
    } catch (error) {
      throw new BadRequestException(
        error instanceof Error
          ? error.message
          : TransactionsBankErrorMessages.reconciliationError,
      );
    }
  }

  @Get('export/csv')
  @UseGuards(AuthGuard)
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
  @UseGuards(AuthGuard)
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
