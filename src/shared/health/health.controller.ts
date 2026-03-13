import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseHealthService } from './database-health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly databaseHealthService: DatabaseHealthService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async check(): Promise<{ status: string; database: boolean }> {
    const dbHealthy = await this.databaseHealthService.isHealthy();

    if (!dbHealthy) {
      throw new ServiceUnavailableException({
        status: 'unavailable',
        database: false,
      });
    }

    return { status: 'ok', database: true };
  }
}
