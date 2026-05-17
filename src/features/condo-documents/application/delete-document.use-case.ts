import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { CloudStorageService } from '@/shared/libs/google-cloud/storage/cloud-storage.service';
import { GoogleCloudConfigService } from '@/shared/libs/google-cloud/google-cloud.config';

@Injectable()
export class DeleteDocumentUseCase {
  private readonly logger = new Logger(DeleteDocumentUseCase.name);

  constructor(
    private readonly cloudStorageService: CloudStorageService,
    private readonly googleCloudConfig: GoogleCloudConfigService,
  ) {}

  async execute(name: string): Promise<{ deleted: true; name: string }> {
    const bucketName = this.googleCloudConfig.documentsBucketName;
    if (!bucketName) {
      throw new BadRequestException(
        'BUCKET_NAME_DOCUMENTS no está configurado en el servidor',
      );
    }

    const exists = await this.cloudStorageService.fileExists(name, bucketName);
    if (!exists) {
      throw new NotFoundException(`Archivo "${name}" no encontrado`);
    }

    await this.cloudStorageService.deleteFile(name, bucketName);
    this.logger.log(`Documento eliminado: gs://${bucketName}/${name}`);

    return { deleted: true, name };
  }
}
