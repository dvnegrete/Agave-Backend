import { ApiProperty } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';

export enum CondoDocumentTypeDto {
  DOCUMENT = 'document',
  MINUTE = 'minute',
}

export class ListDocumentsQueryDto {
  @ApiProperty({
    enum: CondoDocumentTypeDto,
    description:
      'Tipo de documento a listar: "document" (generales) o "minute" (actas)',
  })
  @IsEnum(CondoDocumentTypeDto, {
    message: 'type debe ser "document" o "minute"',
  })
  type: CondoDocumentTypeDto;
}
