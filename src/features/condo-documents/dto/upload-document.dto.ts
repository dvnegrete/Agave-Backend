import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';
import { CondoDocumentTypeDto } from './list-documents-query.dto';

export class UploadDocumentDto {
  @ApiProperty({
    enum: CondoDocumentTypeDto,
    description: 'Tipo del documento a subir',
  })
  @IsEnum(CondoDocumentTypeDto, {
    message: 'type debe ser "document" o "minute"',
  })
  type: CondoDocumentTypeDto;

  @ApiPropertyOptional({
    description:
      'Fecha de la minuta en formato ddmmaaaa (8 dígitos). Requerido si type=minute',
    example: '15032026',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{8}$/, { message: 'date debe tener formato ddmmaaaa (8 dígitos)' })
  date?: string;
}

export class UploadDocumentResponseDto {
  @ApiProperty()
  name: string;

  @ApiProperty()
  displayName: string;

  @ApiProperty()
  type: CondoDocumentTypeDto;

  @ApiProperty()
  date: string;
}
