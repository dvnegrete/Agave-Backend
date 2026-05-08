import { Module } from '@nestjs/common';
import { AuthModule } from '@/shared/auth/auth.module';
import { OpenAIModule } from '@/shared/libs/openai/openai.module';
import { VertexAIModule } from '@/shared/libs/vertex-ai/vertex-ai.module';
import { TransactionsBankController } from './controllers/transactions-bank.controller';
import { TransactionsBankService } from './services/transactions-bank.service';
import { FileProcessorService } from './services/file-processor.service';
import { TransactionValidatorService } from './services/transaction-validator.service';
import { ColumnAnalyzerService } from './services/column-analyzer.service';

@Module({
  imports: [AuthModule, OpenAIModule, VertexAIModule],
  controllers: [TransactionsBankController],
  providers: [
    TransactionsBankService,
    FileProcessorService,
    TransactionValidatorService,
    ColumnAnalyzerService,
  ],
  exports: [TransactionsBankService],
})
export class TransactionsBankModule {}
