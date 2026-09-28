import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsString } from 'class-validator';
import { CondoDocumentTypeDto } from './list-documents-query.dto';

export class SignedUrlQueryDto {
  @ApiProperty({
    description: 'Path completo del archivo en el bucket (ej. minutes/p-...pdf)',
  })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({
    enum: CondoDocumentTypeDto,
    description: 'Tipo del documento al que pertenece el archivo',
  })
  @IsEnum(CondoDocumentTypeDto, {
    message: 'type debe ser "document" o "minute"',
  })
  type: CondoDocumentTypeDto;
}

export class SignedUrlResponseDto {
  @ApiProperty()
  url: string;

  @ApiProperty({ description: 'Duración de validez en minutos' })
  expiresInMinutes: number;
}
