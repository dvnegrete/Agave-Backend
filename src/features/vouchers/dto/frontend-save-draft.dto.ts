import {
  IsString,
  IsNotEmpty,
  IsInt,
  Min,
  Max,
  IsOptional,
} from 'class-validator';
import {
  MIN_HOUSE_NUMBER,
  MAX_HOUSE_NUMBER,
} from '@/shared/config/business-rules.config';

/**
 * DTO para confirmar un voucher desde el Frontend
 * El Frontend envía los datos editados junto con el gcsFilename del archivo ya subido
 *
 * Esta es una arquitectura stateless: el Frontend retiene toda la información
 * y la envía con la confirmación final
 */
export class ConfirmVoucherFromFrontendDto {
  @IsString()
  @IsNotEmpty()
  gcsFilename: string;

  @IsString()
  @IsNotEmpty()
  monto: string;

  @IsString()
  @IsNotEmpty()
  fecha_pago: string;

  @IsOptional()
  @IsString()
  hora_transaccion?: string;

  @IsInt()
  @Min(MIN_HOUSE_NUMBER)
  @Max(MAX_HOUSE_NUMBER)
  casa: number;

  @IsOptional()
  @IsString()
  referencia?: string;

  @IsOptional()
  @IsString()
  userId?: string | null;
}
