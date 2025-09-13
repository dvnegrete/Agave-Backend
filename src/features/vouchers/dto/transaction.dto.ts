import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsDateString,
  IsIn,
  IsOptional,
} from 'class-validator';

export class CreateTransactionDto {
  @IsNotEmpty()
  @IsDateString()
  date: string;

  @IsNotEmpty()
  @IsString()
  description: string;

  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @IsNotEmpty()
  @IsIn(['credit', 'debit'])
  type: 'credit' | 'debit';

  @IsNotEmpty()
  @IsString()
  accountNumber: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  category?: string;
}

export class UpdateTransactionDto {
  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsNumber()
  amount?: number;

  @IsOptional()
  @IsIn(['credit', 'debit'])
  type?: 'credit' | 'debit';

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsIn(['pending', 'processed', 'failed'])
  status?: 'pending' | 'processed' | 'failed';
}
