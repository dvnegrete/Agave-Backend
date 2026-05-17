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

const PREFIX_BY_TYPE: Record<CondoDocumentType, string> = {
  document: 'documents/',
  minute: 'minutes/',
};

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

    const prefix = PREFIX_BY_TYPE[type];
    const files = await this.cloudStorageService.getAllFiles({
      bucketName,
      prefix,
    });

    const items = files
      .filter((file) => file.name !== prefix)
      .map((file) => this.toDocumentItem(file, type, prefix));

    if (type === 'minute') {
      items.sort((a, b) =>
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

  private toDocumentItem(
    file: CloudStorageFile,
    type: CondoDocumentType,
    prefix: string,
  ): DocumentItem {
    const dateMetadata = file.customMetadata?.date ?? '';
    const date = type === 'minute' ? dateMetadata : 'document';

    return {
      name: file.name,
      displayName: this.buildDisplayName(file.name, prefix),
      date,
      size: file.size,
      updated: file.updated.toISOString(),
    };
  }

  private buildDisplayName(fullName: string, prefix: string): string {
    const fileName = fullName.startsWith(prefix)
      ? fullName.slice(prefix.length)
      : fullName;
    return fileName.replace(/\.[^.]+$/, '');
  }

  private parseMinuteDate(date: string): Date {
    if (!/^\d{8}$/.test(date)) {
      return new Date(0);
    }
    const day = Number(date.slice(0, 2));
    const month = Number(date.slice(2, 4)) - 1;
    const year = Number(date.slice(4, 8));
    return new Date(year, month, day);
  }
}
