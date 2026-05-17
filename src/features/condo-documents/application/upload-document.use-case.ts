import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { Express } from 'express';
import { CloudStorageService } from '@/shared/libs/google-cloud/storage/cloud-storage.service';
import { GoogleCloudConfigService } from '@/shared/libs/google-cloud/google-cloud.config';
import { CondoDocumentType } from '../interfaces/document-item.interface';
import { UploadDocumentResponseDto } from '../dto/upload-document.dto';
import { CondoDocumentTypeDto } from '../dto/list-documents-query.dto';

const PREFIX_BY_TYPE: Record<CondoDocumentType, string> = {
  document: 'documents/',
  minute: 'minutes/',
};

@Injectable()
export class UploadDocumentUseCase {
  private readonly logger = new Logger(UploadDocumentUseCase.name);

  constructor(
    private readonly cloudStorageService: CloudStorageService,
    private readonly googleCloudConfig: GoogleCloudConfigService,
  ) {}

  async execute(
    file: Express.Multer.File,
    type: CondoDocumentType,
    date?: string,
  ): Promise<UploadDocumentResponseDto> {
    if (!file) {
      throw new BadRequestException('El archivo es requerido');
    }

    if (file.mimetype !== 'application/pdf') {
      throw new BadRequestException('Solo se permiten archivos PDF');
    }

    if (type === 'minute' && !date) {
      throw new BadRequestException(
        'Las minutas requieren una fecha en formato ddmmaaaa',
      );
    }

    const bucketName = this.googleCloudConfig.documentsBucketName;
    if (!bucketName) {
      throw new BadRequestException(
        'BUCKET_NAME_DOCUMENTS no está configurado en el servidor',
      );
    }

    const prefix = PREFIX_BY_TYPE[type];
    const metadataDateValue = type === 'document' ? 'document' : (date as string);

    const result = await this.cloudStorageService.upload(
      file.buffer,
      file.originalname,
      {
        bucketName,
        prefix,
        contentType: 'application/pdf',
        generateUniqueName: true,
        metadata: { date: metadataDateValue },
      },
    );

    this.logger.log(
      `Documento subido: ${result.gcsUri} (type=${type}, date=${metadataDateValue})`,
    );

    return {
      name: result.fileName,
      displayName: this.buildDisplayName(result.fileName, prefix),
      type: type as CondoDocumentTypeDto,
      date: metadataDateValue,
    };
  }

  private buildDisplayName(fullName: string, prefix: string): string {
    const fileName = fullName.startsWith(prefix)
      ? fullName.slice(prefix.length)
      : fullName;
    return fileName.replace(/\.[^.]+$/, '');
  }
}
