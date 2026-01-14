import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/roles.guard';
import { HouseOwnershipGuard } from './guards/house-ownership.guard';
import { JwtAuthService } from './services/jwt-auth.service';
import { User } from '../database/entities/user.entity';
import { House } from '../database/entities/house.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([User, House]),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, RoleGuard, HouseOwnershipGuard, JwtAuthService],
  exports: [AuthService, AuthGuard, RoleGuard, HouseOwnershipGuard, JwtAuthService],
})
export class AuthModule {}
