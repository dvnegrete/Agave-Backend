import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OpenAIConfigService } from './openai.config';
import { OpenAIClient } from './openai.client';
import { OpenAIService } from './openai.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [OpenAIConfigService, OpenAIClient, OpenAIService],
  exports: [OpenAIService],
})
export class OpenAIModule {}
