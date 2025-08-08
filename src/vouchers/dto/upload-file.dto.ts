import { IsNotEmpty, IsString, IsOptional } from 'class-validator';

export class UploadFileDto {
  @IsNotEmpty()
  @IsString()
  filename: string;

  @IsNotEmpty()
  @IsString()
  originalName: string;

  @IsNotEmpty()
  @IsString()
  mimetype: string;

  @IsOptional()
  @IsString()
  encoding?: string;

  @IsOptional()
  @IsString()
  description?: string;
}
