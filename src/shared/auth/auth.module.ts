import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/roles.guard';
import { HouseOwnershipGuard } from './guards/house-ownership.guard';
import { User } from '../database/entities/user.entity';
import { House } from '../database/entities/house.entity';

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([User, House])],
  controllers: [AuthController],
  providers: [AuthService, AuthGuard, RoleGuard, HouseOwnershipGuard],
  exports: [AuthService, AuthGuard, RoleGuard, HouseOwnershipGuard],
})
export class AuthModule {}
