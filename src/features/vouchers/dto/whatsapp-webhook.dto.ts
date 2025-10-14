import {
  IsString,
  IsOptional,
  IsObject,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

// DTOs para mensajes de imagen
export class WhatsAppImageDto {
  @IsString()
  id: string;

  @IsString()
  mime_type: string;

  @IsOptional()
  @IsString()
  caption?: string;
}

// DTOs para mensajes de documento
export class WhatsAppDocumentDto {
  @IsString()
  id: string;

  @IsString()
  mime_type: string;

  @IsOptional()
  @IsString()
  filename?: string;
}

// DTOs para respuestas interactivas (botones)
export class WhatsAppButtonReplyDto {
  @IsString()
  id: string;

  @IsString()
  title: string;
}

// DTOs para respuestas interactivas (listas)
export class WhatsAppListReplyDto {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsOptional()
  @IsString()
  description?: string;
}

// DTO para mensajes interactivos
export class WhatsAppInteractiveDto {
  @IsString()
  type: 'button_reply' | 'list_reply';

  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppButtonReplyDto)
  button_reply?: WhatsAppButtonReplyDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppListReplyDto)
  list_reply?: WhatsAppListReplyDto;
}

// DTO para mensajes de texto
export class WhatsAppTextDto {
  @IsString()
  body: string;
}

// DTO para el mensaje principal
export class WhatsAppMessageDto {
  @IsString()
  from: string;

  @IsString()
  id: string;

  @IsString()
  timestamp: string;

  @IsString()
  type:
    | 'text'
    | 'image'
    | 'document'
    | 'interactive'
    | 'audio'
    | 'video'
    | 'sticker'
    | 'location'
    | 'contacts';

  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppTextDto)
  text?: WhatsAppTextDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppImageDto)
  image?: WhatsAppImageDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppDocumentDto)
  document?: WhatsAppDocumentDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => WhatsAppInteractiveDto)
  interactive?: WhatsAppInteractiveDto;
}

// DTO para metadata del contacto
class WhatsAppContactDto {
  @IsString()
  profile: {
    name: string;
  };

  @IsString()
  wa_id: string;
}

// DTO para el value que contiene mensajes y metadata
class WhatsAppValueDto {
  @IsString()
  messaging_product: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppMessageDto)
  messages?: WhatsAppMessageDto[];

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => WhatsAppContactDto)
  contacts?: WhatsAppContactDto[];

  @IsObject()
  metadata: {
    display_phone_number: string;
    phone_number_id: string;
  };
}

// DTO para los changes
class WhatsAppChangeDto {
  @ValidateNested()
  @Type(() => WhatsAppValueDto)
  value: WhatsAppValueDto;

  @IsString()
  field: string;
}

// DTO para el entry
class WhatsAppEntryDto {
  @IsString()
  id: string;

  @ValidateNested({ each: true })
  @Type(() => WhatsAppChangeDto)
  changes: WhatsAppChangeDto[];
}

// DTO principal del webhook
export class WhatsAppWebhookDto {
  @IsString()
  object: string;

  @ValidateNested({ each: true })
  @Type(() => WhatsAppEntryDto)
  entry: WhatsAppEntryDto[];
}
