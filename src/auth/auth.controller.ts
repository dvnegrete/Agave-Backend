import { 
  Controller, 
  Post, 
  Body, 
  Get, 
  UseGuards, 
  Query, 
  HttpCode, 
  HttpStatus 
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { 
  SignUpDto, 
  SignInDto, 
  OAuthSignInDto, 
  RefreshTokenDto, 
  AuthResponseDto 
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
  async signIn(@Body() signInDto: SignInDto): Promise<AuthResponseDto> {
    return this.authService.signIn(signInDto);
  }

  @Post('oauth/signin')
  @HttpCode(HttpStatus.OK)
  async signInWithOAuth(@Body() oAuthDto: OAuthSignInDto): Promise<{ url: string }> {
    return this.authService.signInWithOAuth(oAuthDto);
  }

  @Get('oauth/callback')
  async handleOAuthCallback(@Query('code') code: string): Promise<AuthResponseDto> {
    return this.authService.handleOAuthCallback(code);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refreshToken(@Body() refreshTokenDto: RefreshTokenDto): Promise<AuthResponseDto> {
    return this.authService.refreshToken(refreshTokenDto);
  }

  @Post('signout')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async signOut(@CurrentUser() user: User): Promise<void> {
    // En una implementación real, podrías invalidar el token aquí
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
      providers: ['google', 'facebook', 'github', 'twitter', 'discord']
    };
  }
} 