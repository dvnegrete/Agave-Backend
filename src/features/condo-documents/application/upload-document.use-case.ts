import {
  Injectable,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { Express } from 'express';
import { CloudStorageService } from '@/shared/libs/google-cloud/storage/cloud-storage.service';
import { GoogleCloudConfigService } from '@/shared/libs/google-cloud/google-cloud.config';
import { MONTH_NAMES } from '@/shared/common/constants/messages';
import { CondoDocumentType } from '../interfaces/document-item.interface';
import { UploadDocumentResponseDto } from '../dto/upload-document.dto';
import { CondoDocumentTypeDto } from '../dto/list-documents-query.dto';

const INVALID_FILENAME_CHARS = /[\\/:*?"<>|]/;

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
    name?: string,
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

    if (type === 'document' && !name?.trim()) {
      throw new BadRequestException(
        'Los documentos generales requieren un nombre',
      );
    }

    const bucketName = this.googleCloudConfig.documentsBucketName;
    if (!bucketName) {
      throw new BadRequestException(
        'BUCKET_NAME_DOCUMENTS no está configurado en el servidor',
      );
    }

    const metadataDateValue =
      type === 'document' ? 'document' : (date as string);

    const fileName =
      type === 'minute'
        ? this.buildMinuteFileName(date as string)
        : this.buildDocumentFileName(name as string);

    const alreadyExists = await this.cloudStorageService.fileExists(
      fileName,
      bucketName,
    );
    if (alreadyExists) {
      throw new ConflictException(
        `Ya existe un archivo con el nombre "${fileName}"`,
      );
    }

    const result = await this.cloudStorageService.upload(
      file.buffer,
      fileName,
      {
        bucketName,
        fileName,
        generateUniqueName: false,
        contentType: 'application/pdf',
        metadata: { date: metadataDateValue },
      },
    );

    this.logger.log(
      `Documento subido: ${result.gcsUri} (type=${type}, date=${metadataDateValue})`,
    );

    return {
      name: result.fileName,
      displayName: this.stripExtension(result.fileName),
      type: type as CondoDocumentTypeDto,
      date: metadataDateValue,
    };
  }

  private buildMinuteFileName(date: string): string {
    const day = date.slice(0, 2);
    const monthIndex = Number(date.slice(2, 4)) - 1;
    const year = date.slice(4, 8);
    const month = MONTH_NAMES[monthIndex]?.toLowerCase();
    if (!month) {
      throw new BadRequestException(`Fecha inválida: mes ${date.slice(2, 4)}`);
    }
    return `Minuta ${day} ${month} ${year}.pdf`;
  }

  private buildDocumentFileName(rawName: string): string {
    const trimmed = rawName.trim();
    if (INVALID_FILENAME_CHARS.test(trimmed)) {
      throw new BadRequestException(
        'El nombre no puede contener \\ / : * ? " < > |',
      );
    }
    const withoutExtension = trimmed.replace(/\.pdf$/i, '');
    return `${withoutExtension}.pdf`;
  }

  private stripExtension(fullName: string): string {
    return fullName.replace(/\.[^.]+$/, '');
  }
}
