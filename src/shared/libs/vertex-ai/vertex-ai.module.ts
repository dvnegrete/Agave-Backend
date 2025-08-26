import { Module } from '@nestjs/common';
import { VertexAIService } from './vertex-ai.service';
import { VertexAIClient } from './vertex-ai.client';
import { GoogleCloudConfigService } from '../google-cloud/google-cloud.config';

@Module({
  providers: [VertexAIService, VertexAIClient, GoogleCloudConfigService],
  exports: [VertexAIService],
})
export class VertexAIModule {}
