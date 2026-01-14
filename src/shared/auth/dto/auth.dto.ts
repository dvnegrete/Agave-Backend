import { IsEmail, IsString, IsOptional } from 'class-validator';

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
