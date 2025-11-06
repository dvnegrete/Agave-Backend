import { IsString, IsEmail, IsOptional, IsArray } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para adjuntos de email (SendGrid Inbound Parse)
 */
export class EmailAttachmentDto {
  @IsString()
  filename: string;

  @IsString()
  content: string; // Base64 encoded

  @IsString()
  contentType: string;

  @IsOptional()
  size?: number;
}

/**
 * DTO para webhook de SendGrid Inbound Parse
 *
 * SendGrid envía los emails como application/x-www-form-urlencoded o multipart/form-data
 * con los siguientes campos principales
 */
export class SendGridInboundWebhookDto {
  /**
   * Email del remitente
   * Ejemplo: "usuario@example.com" o "Usuario <usuario@example.com>"
   */
  @IsString()
  from: string;

  /**
   * Email del destinatario
   * Ejemplo: "vouchers@agave.com"
   */
  @IsString()
  to: string;

  /**
   * Asunto del correo
   */
  @IsString()
  @IsOptional()
  subject?: string;

  /**
   * Contenido del email en texto plano
   */
  @IsString()
  @IsOptional()
  text?: string;

  /**
   * Contenido del email en HTML
   */
  @IsString()
  @IsOptional()
  html?: string;

  /**
   * Número de adjuntos
   */
  @IsOptional()
  attachments?: string; // Viene como string "0", "1", "2", etc.

  /**
   * Información de adjuntos
   * SendGrid envía múltiples campos por adjunto:
   * - attachment1, attachment2, etc. (nombre del archivo)
   * - attachment-info (JSON con metadata)
   */
  @IsOptional()
  'attachment-info'?: string; // JSON string con info de todos los adjuntos

  /**
   * Headers del email (opcional)
   */
  @IsString()
  @IsOptional()
  headers?: string;

  /**
   * Envelope data (opcional)
   */
  @IsString()
  @IsOptional()
  envelope?: string;
}

/**
 * DTO procesado internamente después de parsear SendGrid webhook
 */
export class ProcessedEmailDto {
  @IsEmail()
  from: string; // Email limpio sin nombre

  @IsEmail()
  to: string;

  @IsString()
  @IsOptional()
  subject?: string;

  @IsString()
  @IsOptional()
  textBody?: string;

  @IsArray()
  @Type(() => EmailAttachmentDto)
  @IsOptional()
  attachments?: EmailAttachmentDto[];
}
