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

export class SignUpDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;

  @IsString()
  @IsOptional()
  firstName?: string;

  @IsString()
  @IsOptional()
  lastName?: string;

  @IsInt()
  @Min(MAX_HOUSE_NUMBER)
  @Max(MIN_HOUSE_NUMBER)
  @IsOptional()
  houseNumber?: number;
}

export class SignInDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class OAuthSignInDto {
  @IsString()
  provider: 'google' | 'facebook' | 'github' | 'twitter' | 'discord';
}

export class RefreshTokenDto {
  @IsString()
  refreshToken: string;
}

export class OAuthCallbackDto {
  @IsString()
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
}
