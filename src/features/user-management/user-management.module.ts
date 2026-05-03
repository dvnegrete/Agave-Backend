import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '@/shared/auth/auth.module';

// Entities
import { User, House, HouseUser } from '@/shared/database/entities';

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
  DeleteUserUseCase,
} from './application';

// Repositories
import {
  UserRepository,
  HouseRepository,
  HouseUserRepository,
} from '@/shared/database/repositories';

@Module({
  imports: [AuthModule, TypeOrmModule.forFeature([User, House, HouseUser])],
  controllers: [UserManagementController],
  providers: [
    // Use Cases
    GetUsersUseCase,
    UpdateUserRoleUseCase,
    UpdateUserStatusUseCase,
    UpdateUserObservationsUseCase,
    AssignHouseUseCase,
    RemoveHouseUseCase,
    DeleteUserUseCase,
    // Repositories
    UserRepository,
    HouseRepository,
    HouseUserRepository,
  ],
})
export class UserManagementModule {}
