import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { CloudStorageService } from '@/shared/libs/google-cloud/storage/cloud-storage.service';
import { GoogleCloudConfigService } from '@/shared/libs/google-cloud/google-cloud.config';
import { CondoDocumentType } from '../interfaces/document-item.interface';

const PREFIX_BY_TYPE: Record<CondoDocumentType, string> = {
  document: 'documents/',
  minute: 'minutes/',
};

const SIGNED_URL_EXPIRATION_MINUTES = 15;

@Injectable()
export class GetSignedUrlUseCase {
  private readonly logger = new Logger(GetSignedUrlUseCase.name);

  constructor(
    private readonly cloudStorageService: CloudStorageService,
    private readonly googleCloudConfig: GoogleCloudConfigService,
  ) {}

  async execute(
    name: string,
    type: CondoDocumentType,
  ): Promise<{ url: string; expiresInMinutes: number }> {
    const bucketName = this.googleCloudConfig.documentsBucketName;
    if (!bucketName) {
      throw new BadRequestException(
        'BUCKET_NAME_DOCUMENTS no está configurado en el servidor',
      );
    }

    const expectedPrefix = PREFIX_BY_TYPE[type];
    if (!name.startsWith(expectedPrefix)) {
      throw new BadRequestException(
        `El archivo no pertenece al tipo "${type}"`,
      );
    }

    const url = await this.cloudStorageService.getSignedUrl(name, {
      bucketName,
      expiresInMinutes: SIGNED_URL_EXPIRATION_MINUTES,
      action: 'read',
    });

    return { url, expiresInMinutes: SIGNED_URL_EXPIRATION_MINUTES };
  }
}
