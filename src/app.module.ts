import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { VouchersModule } from './vouchers/vouchers.module';
import { TransactionsBankModule } from './transactions-bank/transactions-bank.module';
import { AppConfigService } from './config/config.service';
import { DatabaseModule } from './database/database.module';
import { GoogleCloudModule } from './libs/google-cloud';
import { OpenAIModule } from './libs/openai/openai.module';

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
  ],
  controllers: [AppController],
  providers: [AppService, AppConfigService],
})
export class AppModule {}
