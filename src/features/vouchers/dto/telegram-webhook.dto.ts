import {
  IsNumber,
  IsString,
  IsOptional,
  IsArray,
  ValidateNested,
  IsBoolean,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * DTO para usuario de Telegram
 */
export class TelegramUserDto {
  @IsNumber()
  id: number;

  @IsBoolean()
  is_bot: boolean;

  @IsString()
  first_name: string;

  @IsOptional()
  @IsString()
  last_name?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  language_code?: string;
}

/**
 * DTO para chat de Telegram
 */
export class TelegramChatDto {
  @IsNumber()
  id: number;

  @IsString()
  type: string; // 'private', 'group', 'supergroup', 'channel'

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  first_name?: string;

  @IsOptional()
  @IsString()
  last_name?: string;
}

/**
 * DTO para PhotoSize (foto en diferentes tamaños)
 */
export class TelegramPhotoSizeDto {
  @IsString()
  file_id: string;

  @IsString()
  file_unique_id: string;

  @IsNumber()
  width: number;

  @IsNumber()
  height: number;

  @IsOptional()
  @IsNumber()
  file_size?: number;
}

/**
 * DTO para documento de Telegram
 */
export class TelegramDocumentDto {
  @IsString()
  file_id: string;

  @IsString()
  file_unique_id: string;

  @IsOptional()
  @IsString()
  file_name?: string;

  @IsOptional()
  @IsString()
  mime_type?: string;

  @IsOptional()
  @IsNumber()
  file_size?: number;
}

/**
 * DTO para mensaje de Telegram
 */
export class TelegramMessageDto {
  @IsNumber()
  message_id: number;

  @ValidateNested()
  @Type(() => TelegramUserDto)
  from: TelegramUserDto;

  @ValidateNested()
  @Type(() => TelegramChatDto)
  chat: TelegramChatDto;

  @IsNumber()
  date: number; // Unix timestamp

  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TelegramPhotoSizeDto)
  photo?: TelegramPhotoSizeDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => TelegramDocumentDto)
  document?: TelegramDocumentDto;

  @IsOptional()
  @IsString()
  caption?: string;
}

/**
 * DTO para callback query (botón inline presionado)
 */
export class TelegramCallbackQueryDto {
  @IsString()
  id: string;

  @ValidateNested()
  @Type(() => TelegramUserDto)
  from: TelegramUserDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TelegramMessageDto)
  message?: TelegramMessageDto;

  @IsOptional()
  @IsString()
  data?: string; // callback_data del botón presionado
}

/**
 * DTO principal para webhook de Telegram
 * Representa un Update de la API de Telegram
 */
export class TelegramWebhookDto {
  @IsNumber()
  update_id: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => TelegramMessageDto)
  message?: TelegramMessageDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TelegramMessageDto)
  edited_message?: TelegramMessageDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => TelegramCallbackQueryDto)
  callback_query?: TelegramCallbackQueryDto;
}

/**
 * DTO procesado para uso interno después de parsear el webhook
 */
export class ProcessedTelegramMessageDto {
  chatId: number;
  userId: number;
  username?: string;
  messageId: number;
  messageType: 'text' | 'photo' | 'document' | 'callback_query' | 'unknown';
  text?: string;
  photos?: TelegramPhotoSizeDto[];
  document?: TelegramDocumentDto;
  callbackData?: string;
  timestamp: Date;
}
