import { IsNotEmpty, IsString, IsNumber, IsBoolean, IsIn, IsOptional, IsDateString } from 'class-validator';

export class CreateBankTransactionDto {
  @IsNotEmpty()
  @IsString()
  date: string;

  @IsNotEmpty()
  @IsString()
  time: string;

  @IsNotEmpty()
  @IsString()
  concept: string;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsNotEmpty()
  @IsString()
  currency: string;

  @IsNotEmpty()
  @IsBoolean()
  is_deposit: boolean;

  @IsOptional()
  @IsBoolean()
  validation_flag?: boolean;
}

export class UpdateBankTransactionDto {
  @IsOptional()
  @IsString()
  date?: string;

  @IsOptional()
  @IsString()
  time?: string;

  @IsOptional()
  @IsString()
  concept?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsBoolean()
  is_deposit?: boolean;

  @IsOptional()
  @IsBoolean()
  validation_flag?: boolean;

  @IsOptional()
  @IsIn(['pending', 'processed', 'failed', 'reconciled'])
  status?: 'pending' | 'processed' | 'failed' | 'reconciled';
}

export class ReconciliationDto {
  @IsNotEmpty()
  @IsString()
  accountNumber: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @IsBoolean()
  autoReconcile?: boolean;
}
