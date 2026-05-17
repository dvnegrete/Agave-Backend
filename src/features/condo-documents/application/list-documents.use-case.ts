import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import {
  CloudStorageService,
  CloudStorageFile,
} from '@/shared/libs/google-cloud/storage/cloud-storage.service';
import { GoogleCloudConfigService } from '@/shared/libs/google-cloud/google-cloud.config';
import {
  CondoDocumentType,
  DocumentItem,
} from '../interfaces/document-item.interface';

const MINUTE_DATE_REGEX = /^\d{8}$/;

@Injectable()
export class ListDocumentsUseCase {
  private readonly logger = new Logger(ListDocumentsUseCase.name);

  constructor(
    private readonly cloudStorageService: CloudStorageService,
    private readonly googleCloudConfig: GoogleCloudConfigService,
  ) {}

  async execute(type: CondoDocumentType): Promise<DocumentItem[]> {
    const bucketName = this.googleCloudConfig.documentsBucketName;
    if (!bucketName) {
      throw new BadRequestException(
        'BUCKET_NAME_DOCUMENTS no está configurado en el servidor',
      );
    }

    const files = await this.cloudStorageService.getAllFiles({ bucketName });

    const items = files
      .filter((file) => this.matchesType(file, type))
      .map((file) => this.toDocumentItem(file, type));

    if (type === 'minute') {
      items.sort(
        (a, b) =>
          this.parseMinuteDate(b.date).getTime() -
          this.parseMinuteDate(a.date).getTime(),
      );
    } else {
      items.sort(
        (a, b) => new Date(b.updated).getTime() - new Date(a.updated).getTime(),
      );
    }

    return items;
  }

  private matchesType(file: CloudStorageFile, type: CondoDocumentType): boolean {
    const date = file.customMetadata?.date;
    if (!date) return false;
    return type === 'minute' ? MINUTE_DATE_REGEX.test(date) : date === 'document';
  }

  private toDocumentItem(
    file: CloudStorageFile,
    type: CondoDocumentType,
  ): DocumentItem {
    const dateMetadata = file.customMetadata?.date ?? '';
    return {
      name: file.name,
      displayName: this.buildDisplayName(file.name),
      date: type === 'minute' ? dateMetadata : 'document',
      size: file.size,
      updated: file.updated.toISOString(),
    };
  }

  private buildDisplayName(fullName: string): string {
    return fullName.replace(/\.[^.]+$/, '');
  }

  private parseMinuteDate(date: string): Date {
    if (!MINUTE_DATE_REGEX.test(date)) {
      return new Date(0);
    }
    const day = Number(date.slice(0, 2));
    const month = Number(date.slice(2, 4)) - 1;
    const year = Number(date.slice(4, 8));
    return new Date(year, month, day);
  }
}
