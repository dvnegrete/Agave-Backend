import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { CloudStorageService } from '@/shared/libs/google-cloud/storage/cloud-storage.service';
import { GoogleCloudConfigService } from '@/shared/libs/google-cloud/google-cloud.config';
import { CondoDocumentType } from '../interfaces/document-item.interface';

const SIGNED_URL_EXPIRATION_MINUTES = 15;
const MINUTE_DATE_REGEX = /^\d{8}$/;

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

    const fileInfo = await this.cloudStorageService.getFileMetadata(
      name,
      bucketName,
    );

    if (!fileInfo) {
      throw new NotFoundException(`Archivo "${name}" no encontrado`);
    }

    const date = fileInfo.customMetadata?.date;
    const actualType: CondoDocumentType | null =
      date === 'document'
        ? 'document'
        : date && MINUTE_DATE_REGEX.test(date)
          ? 'minute'
          : null;

    if (!actualType) {
      throw new BadRequestException(
        `El archivo "${name}" no tiene un metadato "date" válido`,
      );
    }

    if (actualType !== type) {
      throw new ForbiddenException(
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
