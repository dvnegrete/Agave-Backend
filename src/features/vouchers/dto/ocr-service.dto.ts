import { IsOptional, IsString, IsEnum } from 'class-validator';

export enum ImageFormat {
  JPEG = 'jpeg',
  PNG = 'png',
  GIF = 'gif',
  BMP = 'bmp',
  WEBP = 'webp',
  TIFF = 'tiff',
}

export class OcrServiceDto {
  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsEnum(ImageFormat)
  format?: ImageFormat;

  @IsOptional()
  @IsString()
  description?: string;
}

export class OcrResponseDto {
  structuredData: any;
  originalFilename: string;
  gcsFilename: string;
}
