import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsBoolean,
  IsIn,
  IsOptional,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CreateTransactionBankDto {
  @ApiProperty({
    description: 'Fecha de la transacción',
    example: '2025-01-15',
  })
  @IsNotEmpty()
  @IsString()
  date: string;

  @ApiProperty({
    description: 'Hora de la transacción',
    example: '10:30:00',
  })
  @IsNotEmpty()
  @IsString()
  time: string;

  @ApiProperty({
    description: 'Concepto o descripción de la transacción',
    example: 'PAGO TRANSFERENCIA SPEI',
  })
  @IsNotEmpty()
  @IsString()
  concept: string;

  @ApiProperty({
    description: 'Monto de la transacción',
    example: 1500.0,
  })
  @IsNotEmpty()
  @IsNumber()
  amount: number;

  @ApiProperty({
    description: 'Moneda de la transacción',
    example: 'MXN',
  })
  @IsNotEmpty()
  @IsString()
  currency: string;

  @ApiProperty({
    description: 'Indica si es un depósito (true) o retiro (false)',
    example: true,
  })
  @IsNotEmpty()
  @IsBoolean()
  is_deposit: boolean;

  @ApiPropertyOptional({
    description: 'Nombre del banco',
    example: 'Santander',
  })
  @IsOptional()
  @IsString()
  bank_name?: string;

  @ApiPropertyOptional({
    description: 'Bandera de validación',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  validation_flag?: boolean;
}

export class UpdateTransactionBankDto {
  @ApiPropertyOptional({
    description: 'Fecha de la transacción',
    example: '2025-01-15',
  })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({
    description: 'Hora de la transacción',
    example: '10:30:00',
  })
  @IsOptional()
  @IsString()
  time?: string;

  @ApiPropertyOptional({
    description: 'Concepto o descripción',
    example: 'PAGO TRANSFERENCIA SPEI',
  })
  @IsOptional()
  @IsString()
  concept?: string;

  @ApiPropertyOptional({
    description: 'Monto de la transacción',
    example: 1500.0,
  })
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional({
    description: 'Moneda',
    example: 'MXN',
  })
  @IsOptional()
  @IsString()
  currency?: string;

  @ApiPropertyOptional({
    description: 'Es depósito (true) o retiro (false)',
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  is_deposit?: boolean;

  @ApiPropertyOptional({
    description: 'Nombre del banco',
    example: 'Santander',
  })
  @IsOptional()
  @IsString()
  bank_name?: string;

  @ApiPropertyOptional({
    description: 'Bandera de validación',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  validation_flag?: boolean;

  @ApiPropertyOptional({
    description: 'Estado de la transacción',
    enum: ['pending', 'processed', 'failed', 'reconciled'],
    example: 'processed',
  })
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
