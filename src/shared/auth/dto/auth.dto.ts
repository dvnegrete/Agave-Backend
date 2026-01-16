import {
  IsEmail,
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import {
  MAX_HOUSE_NUMBER,
  MIN_HOUSE_NUMBER,
} from '@/shared/config/business-rules.config';
import { AuthValidationMessages } from '@/shared/content/messages';

export class SignUpDto {
  @IsEmail({}, { message: AuthValidationMessages.EMAIL_INVALID })
  email: string;

  @IsString({ message: AuthValidationMessages.PASSWORD_REQUIRED })
  password: string;

  @IsString({ message: AuthValidationMessages.FIRST_NAME_INVALID })
  @IsOptional()
  firstName?: string;

  @IsString({ message: AuthValidationMessages.LAST_NAME_INVALID })
  @IsOptional()
  lastName?: string;

  @IsInt({ message: AuthValidationMessages.HOUSE_NUMBER_REQUIRED_FORMAT })
  @Min(MIN_HOUSE_NUMBER, {
    message: AuthValidationMessages.HOUSE_NUMBER_MIN(MIN_HOUSE_NUMBER),
  })
  @Max(MAX_HOUSE_NUMBER, {
    message: AuthValidationMessages.HOUSE_NUMBER_MAX(MAX_HOUSE_NUMBER),
  })
  @IsOptional()
  houseNumber?: number;
}

export class SignInDto {
  @IsEmail({}, { message: AuthValidationMessages.EMAIL_INVALID })
  email: string;

  @IsString({ message: AuthValidationMessages.PASSWORD_REQUIRED })
  password: string;
}

export class OAuthSignInDto {
  @IsString({ message: AuthValidationMessages.PROVIDER_INVALID })
  provider: 'google' | 'facebook' | 'github' | 'twitter' | 'discord';
}

export class RefreshTokenDto {
  @IsString({ message: AuthValidationMessages.REFRESH_TOKEN_INVALID })
  refreshToken: string;
}

export class OAuthCallbackDto {
  @IsString({ message: AuthValidationMessages.ACCESS_TOKEN_INVALID })
  accessToken: string;
}

export class AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
  };
  requiresEmailConfirmation?: boolean;
}
