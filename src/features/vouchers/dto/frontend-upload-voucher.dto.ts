import { IsOptional, IsString } from 'class-validator';

export class UploadVoucherFrontendDto {
  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  userId?: string | null;
}
