import { Module, Global } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GoogleCloudConfigService } from './google-cloud.config';
import { GoogleCloudClient } from './google-cloud.client';
import { CloudStorageService } from './storage/cloud-storage.service';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    GoogleCloudConfigService,
    {
      provide: GoogleCloudClient,
      useFactory: (configService: GoogleCloudConfigService) => {
        const { createGoogleCloudClient } = require('./google-cloud.factory');
        return createGoogleCloudClient(configService);
      },
      inject: [GoogleCloudConfigService],
    },
    CloudStorageService,
  ],
  exports: [GoogleCloudConfigService, GoogleCloudClient, CloudStorageService],
})
export class GoogleCloudModule {}
