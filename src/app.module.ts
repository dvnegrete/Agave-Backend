import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './shared/auth/auth.module';
import { VouchersModule } from './features/vouchers/vouchers.module';
import { TransactionsBankModule } from './features/transactions-bank/transactions-bank.module';
import { BankReconciliationModule } from './features/bank-reconciliation/bank-reconciliation.module';
import { PaymentManagementModule } from './features/payment-management/payment-management.module';
import { AppConfigService } from './shared/config/config.service';
import { DatabaseModule } from './shared/database/database.module';
import { GoogleCloudModule } from './shared/libs/google-cloud';
import { OpenAIModule } from './shared/libs/openai/openai.module';
import { VertexAIModule } from './shared/libs/vertex-ai/vertex-ai.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      cache: false,
    }),
    GoogleCloudModule,
    OpenAIModule,
    DatabaseModule,
    AuthModule,
    VouchersModule,
    TransactionsBankModule,
    BankReconciliationModule,
    PaymentManagementModule,
    VertexAIModule,
  ],
  controllers: [AppController],
  providers: [AppService, AppConfigService],
})
export class AppModule {}
