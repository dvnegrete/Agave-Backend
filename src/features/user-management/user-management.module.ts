import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@/shared/auth/auth.module';

// Entities
import { User, House } from '@/shared/database/entities';

// Controllers
import { UserManagementController } from './controllers/user-management.controller';

// Application Layer - Use Cases
import {
  GetUsersUseCase,
  UpdateUserRoleUseCase,
  UpdateUserStatusUseCase,
  UpdateUserObservationsUseCase,
  AssignHouseUseCase,
  RemoveHouseUseCase,
} from './application';

// Repositories
import {
  UserRepository,
  HouseRepository,
} from '@/shared/database/repositories';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([User, House])],
  controllers: [UserManagementController],
  providers: [
    // Use Cases
    GetUsersUseCase,
    UpdateUserRoleUseCase,
    UpdateUserStatusUseCase,
    UpdateUserObservationsUseCase,
    AssignHouseUseCase,
    RemoveHouseUseCase,
    // Repositories
    UserRepository,
    HouseRepository,
  ],
})
export class UserManagementModule {}
