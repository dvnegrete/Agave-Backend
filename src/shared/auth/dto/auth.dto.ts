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
  @IsString({ message: AuthValidationMessages.ACCESS_TOKEN_INVALID })
  idToken: string;

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
  @IsString({ message: AuthValidationMessages.ACCESS_TOKEN_INVALID })
  idToken: string;
}

export class RefreshTokenDto {
  @IsString({ message: AuthValidationMessages.REFRESH_TOKEN_INVALID })
  refreshToken: string;
}

export class OAuthCallbackDto {
  @IsString({ message: AuthValidationMessages.ACCESS_TOKEN_INVALID })
  idToken: string;
}

export class VerifyEmailDto {
  @IsString({ message: 'Email verification link is required' })
  verificationLink: string;
}

export class ResendVerificationEmailDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  email: string;
}

export class AuthResponseDto {
  /**
   * Access token para enviar en Authorization header
   * Usado cuando cookies no son disponibles (dominios diferentes)
   * Token válido por 15 minutos
   */
  accessToken?: string;

  /**
   * Refresh token para renovar el access token
   * Token válido por 7 días
   */
  refreshToken?: string;

  user: {
    id: string;
    email: string;
    firstName?: string;
    lastName?: string;
    role?: string;
    status?: string;
    houses?: number[];
    emailVerified?: boolean;
  };
  requiresEmailConfirmation?: boolean;
  verificationSent?: boolean;
  message?: string;
}
