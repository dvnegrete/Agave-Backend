import { Module } from '@nestjs/common';
import { DatabaseHealthService } from './database-health.service';

@Module({
  providers: [DatabaseHealthService],
  exports: [DatabaseHealthService],
})
export class HealthModule {}
