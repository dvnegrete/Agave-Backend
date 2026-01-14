import {
  Controller,
  Post,
  Body,
  Get,
  UseGuards,
  Query,
  HttpCode,
  HttpStatus,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import {
  SignUpDto,
  SignInDto,
  OAuthSignInDto,
  RefreshTokenDto,
  OAuthCallbackDto,
  AuthResponseDto,
} from './dto/auth.dto';
import { AuthGuard } from './guards/auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { User } from '@supabase/supabase-js';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signUp(@Body() signUpDto: SignUpDto): Promise<AuthResponseDto> {
    return this.authService.signUp(signUpDto);
  }

  @Post('signin')
  @HttpCode(HttpStatus.OK)
  async signIn(
    @Body() signInDto: SignInDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<AuthResponseDto> {
    return this.authService.signIn(signInDto, res);
  }

  @Post('oauth/signin')
  @HttpCode(HttpStatus.OK)
  async signInWithOAuth(
    @Body() oAuthDto: OAuthSignInDto,
  ): Promise<{ url: string }> {
    return this.authService.signInWithOAuth(oAuthDto);
  }

  @Post('oauth/callback')
  async handleOAuthCallback(
    @Body() dto: OAuthCallbackDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ refreshToken: string }> {
    return this.authService.handleOAuthCallback(dto.accessToken, res);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @Body() refreshTokenDto: RefreshTokenDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ success: boolean }> {
    return this.authService.refreshTokens(refreshTokenDto.refreshToken, res);
  }

  @Post('signout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async signOut(
    @Res({ passthrough: true }) res: Response,
  ): Promise<void> {
    res.clearCookie('access_token');
    return Promise.resolve();
  }

  @Get('me')
  @UseGuards(AuthGuard)
  async getCurrentUser(@CurrentUser() user: User): Promise<User> {
    return user;
  }

  @Get('providers')
  getAvailableProviders(): { providers: string[] } {
    return {
      providers: ['google', 'facebook', 'github', 'twitter', 'discord'],
    };
  }
}
