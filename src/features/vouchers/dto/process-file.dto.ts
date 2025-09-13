import {
  IsOptional,
  IsBoolean,
  IsString,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class ProcessFileDto {
  @IsOptional()
  @IsString()
  filePath?: string;

  @IsOptional()
  @IsBoolean()
  validateOnly?: boolean;

  @IsOptional()
  @IsBoolean()
  skipDuplicates?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(1000)
  batchSize?: number;

  @IsOptional()
  @IsString()
  dateFormat?: string;

  @IsOptional()
  @IsString()
  encoding?: string;
}
