import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OpenAIConfigService {
  private readonly logger = new Logger(OpenAIConfigService.name);

  constructor(private configService: ConfigService) {}

  get apiKey(): string {
    const apiKey = this.configService.get<string>('OPENAI_API_KEY');
    if (!apiKey) {
      this.logger.error('OPENAI_API_KEY no está configurada');
      throw new Error('OPENAI_API_KEY no está configurada');
    }
    return apiKey;
  }

  get isEnabled(): boolean {
    return !!this.configService.get<string>('OPENAI_API_KEY');
  }
}
