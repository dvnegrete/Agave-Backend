# Componentes Técnicos de Autenticación y Control de Acceso

## 🏗️ Arquitectura General de Componentes

```
┌─────────────────────────────────────────────────────────────────┐
│ HTTP Controllers (auth, user, contractor, etc.)                  │
└──────────────────────┬──────────────────────────────────────────┘
                       │
            ┌──────────┴────────────┐
            ↓                       ↓
┌──────────────────────┐  ┌──────────────────────┐
│ AuthService          │  │ Guard Middleware     │
│ - signUp()           │  │ - AuthGuard          │
│ - signIn()           │  │ - RoleGuard          │
│ - signInWithOAuth()  │  │ - PermissionGuard    │
│ - refreshToken()     │  │ - ContextGuard       │
└──────────┬───────────┘  └──────────┬───────────┘
           │                         │
           ├─────────────┬───────────┤
           ↓             ↓           ↓
     Supabase Auth   PostgreSQL   Services
     (External)      (Local)
```

---

## 🔐 Guards (Protección de Rutas)

### 1. AuthGuard (Validación de Token)

**Responsabilidad**: Verificar que el usuario está autenticado (token válido)

```typescript
// auth/guards/auth.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const token = this.extractTokenFromHeader(request);

    if (!token) {
      throw new UnauthorizedException('Token requerido');
    }

    try {
      const user = await this.authService.getCurrentUser(token);
      if (!user) {
        throw new UnauthorizedException('Usuario no encontrado');
      }

      // Enriquecer request con usuario
      request.user = user;
      return true;
    } catch (error) {
      throw new UnauthorizedException('Token inválido');
    }
  }

  private extractTokenFromHeader(request: any): string | undefined {
    const [type, token] = request.headers.authorization?.split(' ') ?? [];
    return type === 'Bearer' ? token : undefined;
  }
}
```

**Uso**:
```typescript
@Get('me')
@UseGuards(AuthGuard)
getCurrentUser(@CurrentUser() user: User) {
  return user;
}
```

---

### 2. RoleGuard (Validación de Rol)

**Responsabilidad**: Verificar que el usuario tiene el rol requerido

```typescript
// auth/guards/role.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@/shared/database/entities/enums';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.get<Role[]>(
      'roles',
      context.getHandler(),
    );

    if (!requiredRoles || requiredRoles.length === 0) {
      return true; // Sin restricción de rol
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    return requiredRoles.includes(user.role);
  }
}
```

**Uso con Decorador**:
```typescript
@Get('admin-panel')
@UseGuards(AuthGuard, RoleGuard)
@Roles(Role.ADMIN)
getAdminPanel() {
  return { message: 'Admin only' };
}
```

---

### 3. PermissionGuard (Validación de Permisos)

**Responsabilidad**: Verificar que el usuario tiene los permisos específicos

```typescript
// auth/guards/permission.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionService } from '../services/permission.service';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private permissionService: PermissionService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.get<string[]>(
      'permissions',
      context.getHandler(),
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true; // Sin restricción de permiso
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return false;
    }

    // Verificar si el usuario tiene todos los permisos requeridos
    const hasAllPermissions =
      await this.permissionService.hasAllPermissions(
        user.id,
        requiredPermissions,
      );

    if (!hasAllPermissions) {
      throw new ForbiddenException('No tienes los permisos necesarios');
    }

    return true;
  }
}
```

**Uso**:
```typescript
@Get('reports')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions('reports:view_house', 'reports:generate_payment')
getReports() {
  return { /* reportes */ };
}
```

---

### 4. ContextGuard (Validación de Contexto)

**Responsabilidad**: Verificar que el usuario tiene acceso a un recurso específico (ej: su casa)

```typescript
// auth/guards/context.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { UserService } from '../services/user.service';

@Injectable()
export class ContextGuard implements CanActivate {
  constructor(private userService: UserService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const houseId = request.params.houseId;

    if (!user || !houseId) {
      return false;
    }

    // Admin puede acceder a cualquier casa
    if (user.role === 'admin') {
      return true;
    }

    // Verificar que el usuario tiene acceso a esta casa
    const hasAccess = await this.userService.hasAccessToHouse(
      user.id,
      houseId,
    );

    if (!hasAccess) {
      throw new ForbiddenException(
        'No tienes acceso a esta casa',
      );
    }

    return true;
  }
}
```

**Uso**:
```typescript
@Get('houses/:houseId/payments')
@UseGuards(AuthGuard, ContextGuard)
getHousePayments(@Param('houseId') houseId: string) {
  return { /* payments */ };
}
```

---

## 🎨 Decoradores Personalizados

### 1. @Roles Decorator

```typescript
// auth/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Role } from '@/shared/database/entities/enums';

export const Roles = (...roles: Role[]) => SetMetadata('roles', roles);
```

**Uso**:
```typescript
@Roles(Role.ADMIN, Role.PROPIETARIO)
```

---

### 2. @RequirePermissions Decorator

```typescript
// auth/decorators/require-permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';

export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);
```

**Uso**:
```typescript
@RequirePermissions('payments:view_own', 'payments:approve')
```

---

### 3. @CurrentUser Decorator (Existente)

Ya está implementado:
```typescript
// auth/decorators/current-user.decorator.ts
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext): User => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
```

---

## 🔧 Servicios

### 1. AuthService (Mejorado)

```typescript
// auth/auth.service.ts
@Injectable()
export class AuthService {
  constructor(
    private configService: ConfigService,
    private userRepository: Repository<User>,
    private auditLogService: AuditLogService,
  ) {}

  async signUp(signUpDto: SignUpDto): Promise<AuthResponseDto> {
    // ... código existente ...

    // Crear usuario en BD local
    const user = await this.userRepository.create({
      id: v4(),
      supabase_id: data.user.id,
      email: data.user.email!,
      name: `${signUpDto.firstName} ${signUpDto.lastName}`,
      role: Role.INQUILINO,
      status: Status.ACTIVE,
    });

    await this.userRepository.save(user);

    // Registrar en audit log
    await this.auditLogService.log({
      userId: user.id,
      action: 'user_created',
      resourceType: 'user',
      resourceId: user.id,
      status: 'success',
    });

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      user: {
        id: user.id,
        email: user.email,
      },
    };
  }

  async getCurrentUserWithPermissions(
    token: string,
  ): Promise<UserWithPermissions> {
    const user = await this.getCurrentUser(token);
    const permissions = await this.permissionService.getUserPermissions(
      user.id,
    );

    return {
      ...user,
      permissions,
    };
  }
}
```

---

### 2. PermissionService (Nuevo)

```typescript
// auth/services/permission.service.ts
@Injectable()
export class PermissionService {
  constructor(
    @InjectRepository(RolePermission)
    private rolePermissionRepository: Repository<RolePermission>,
    private userService: UserService,
  ) {}

  async getUserPermissions(userId: string): Promise<string[]> {
    const user = await this.userService.getUser(userId);

    // Obtener permisos por rol
    const rolePermissions = await this.rolePermissionRepository.find({
      where: { role: { id: user.role } },
      relations: ['permission'],
    });

    return rolePermissions.map((rp) => rp.permission.name);
  }

  async hasPermission(userId: string, permission: string): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId);
    return permissions.includes(permission);
  }

  async hasAllPermissions(
    userId: string,
    permissions: string[],
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return permissions.every((p) => userPermissions.includes(p));
  }

  async hasAnyPermission(
    userId: string,
    permissions: string[],
  ): Promise<boolean> {
    const userPermissions = await this.getUserPermissions(userId);
    return permissions.some((p) => userPermissions.includes(p));
  }
}
```

---

### 3. UserService (Mejorado)

```typescript
// auth/services/user.service.ts
@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(UserHouseAssignment)
    private assignmentRepository: Repository<UserHouseAssignment>,
  ) {}

  async getUser(userId: string): Promise<User> {
    return this.userRepository.findOneBy({ id: userId });
  }

  async hasAccessToHouse(userId: string, houseId: string): Promise<boolean> {
    const user = await this.userRepository.findOneBy({ id: userId });

    // Admin tiene acceso a todo
    if (user.role === Role.ADMIN) {
      return true;
    }

    // Verificar asignación
    const assignment = await this.assignmentRepository.findOne({
      where: {
        user: { id: userId },
        house: { id: houseId },
        is_active: true,
      },
    });

    return !!assignment;
  }

  async getUserHouses(userId: string): Promise<House[]> {
    const assignments = await this.assignmentRepository.find({
      where: {
        user: { id: userId },
        is_active: true,
      },
      relations: ['house'],
    });

    return assignments.map((a) => a.house);
  }

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    // Crear en Supabase
    const { data } = await this.supabaseClient.auth.admin.createUser({
      email: createUserDto.email,
      password: createUserDto.password,
      email_confirm: true,
    });

    // Crear localmente
    const user = await this.userRepository.create({
      id: v4(),
      supabase_id: data.user.id,
      email: createUserDto.email,
      name: createUserDto.name,
      role: createUserDto.role,
      status: Status.ACTIVE,
    });

    return this.userRepository.save(user);
  }
}
```

---

### 4. ContractorService (Nuevo)

```typescript
// auth/services/contractor.service.ts
@Injectable()
export class ContractorService {
  constructor(
    @InjectRepository(ContractorAssignment)
    private assignmentRepository: Repository<ContractorAssignment>,
    @InjectRepository(UserInvitation)
    private invitationRepository: Repository<UserInvitation>,
    private mailService: MailService,
  ) {}

  async createInvitation(
    email: string,
    role: Role,
    ownerId: string,
  ): Promise<UserInvitation> {
    const code = this.generateInvitationCode();

    const invitation = await this.invitationRepository.create({
      email,
      role_id: role,
      invitation_code: code,
      invited_by_id: ownerId,
      status: 'pending',
    });

    await this.invitationRepository.save(invitation);

    // Enviar email
    await this.mailService.sendInvitationEmail(email, code);

    return invitation;
  }

  async acceptInvitation(
    invitationCode: string,
    userId: string,
  ): Promise<ContractorAssignment> {
    const invitation = await this.invitationRepository.findOne({
      where: {
        invitation_code: invitationCode,
        status: 'pending',
      },
    });

    if (!invitation) {
      throw new BadRequestException('Invitación inválida o expirada');
    }

    if (invitation.expires_at < new Date()) {
      throw new BadRequestException('Invitación expirada');
    }

    // Crear asignación
    const assignment = await this.assignmentRepository.create({
      contractor_id: userId,
      owner_id: invitation.invited_by_id,
      role_id: invitation.role_id,
    });

    await this.assignmentRepository.save(assignment);

    // Actualizar invitación
    invitation.status = 'accepted';
    invitation.accepted_at = new Date();
    invitation.accepted_by_user_id = userId;
    await this.invitationRepository.save(invitation);

    return assignment;
  }

  private generateInvitationCode(): string {
    return uuid().replace(/-/g, '').substring(0, 32);
  }
}
```

---

## 📊 Módulo Auth (Actualizado)

```typescript
// auth/auth.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { AuthGuard } from './guards/auth.guard';
import { RoleGuard } from './guards/role.guard';
import { PermissionGuard } from './guards/permission.guard';
import { ContextGuard } from './guards/context.guard';
import { PermissionService } from './services/permission.service';
import { UserService } from './services/user.service';
import { ContractorService } from './services/contractor.service';

import { User } from '@/shared/database/entities/user.entity';
import { Role as RoleEntity } from '@/shared/database/entities/role.entity';
import { Permission } from '@/shared/database/entities/permission.entity';
import { RolePermission } from '@/shared/database/entities/role-permission.entity';
import { UserHouseAssignment } from '@/shared/database/entities/user-house-assignment.entity';
import { ContractorAssignment } from '@/shared/database/entities/contractor-assignment.entity';
import { UserInvitation } from '@/shared/database/entities/user-invitation.entity';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      User,
      RoleEntity,
      Permission,
      RolePermission,
      UserHouseAssignment,
      ContractorAssignment,
      UserInvitation,
    ]),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthGuard,
    RoleGuard,
    PermissionGuard,
    ContextGuard,
    PermissionService,
    UserService,
    ContractorService,
  ],
  exports: [
    AuthService,
    AuthGuard,
    RoleGuard,
    PermissionGuard,
    ContextGuard,
    PermissionService,
    UserService,
  ],
})
export class AuthModule {}
```

---

## 🎯 Ejemplos de Uso Completo

### Ejemplo 1: Endpoint Protegido (Simple)

```typescript
@Get('me')
@UseGuards(AuthGuard)
async getCurrentUser(@CurrentUser() user: User): Promise<User> {
  return user;
}
```

### Ejemplo 2: Endpoint Solo Admin

```typescript
@Delete('users/:id')
@UseGuards(AuthGuard, RoleGuard)
@Roles(Role.ADMIN)
async deleteUser(@Param('id') userId: string): Promise<void> {
  return this.userService.deleteUser(userId);
}
```

### Ejemplo 3: Endpoint con Contexto

```typescript
@Get('houses/:houseId/payments')
@UseGuards(AuthGuard, ContextGuard)
async getHousePayments(
  @Param('houseId') houseId: string,
  @CurrentUser() user: User,
): Promise<Payment[]> {
  return this.paymentService.getPaymentsByHouse(houseId);
}
```

### Ejemplo 4: Endpoint con Permisos

```typescript
@Post('payments')
@UseGuards(AuthGuard, PermissionGuard)
@RequirePermissions('payments:create')
async createPayment(
  @Body() createPaymentDto: CreatePaymentDto,
  @CurrentUser() user: User,
): Promise<Payment> {
  return this.paymentService.create(user.id, createPaymentDto);
}
```

### Ejemplo 5: Endpoint Complejo

```typescript
@Put('houses/:houseId')
@UseGuards(AuthGuard, ContextGuard, PermissionGuard)
@RequirePermissions('houses:update')
async updateHouse(
  @Param('houseId') houseId: string,
  @Body() updateHouseDto: UpdateHouseDto,
  @CurrentUser() user: User,
): Promise<House> {
  // Guards verifican:
  // 1. Usuario autenticado
  // 2. Usuario tiene acceso a esta casa
  // 3. Usuario tiene permiso 'houses:update'

  return this.houseService.update(houseId, updateHouseDto);
}
```

---

## 🗓️ Plan de Implementación de Componentes

### Fase 1: Bases (Semana 1-2)
- [ ] Crear entidades de BD (roles, permissions, etc.)
- [ ] Extender User entity
- [ ] Migraciones TypeORM
- [ ] PermissionService básico

### Fase 2: Guards y Decoradores (Semana 2-3)
- [ ] AuthGuard mejorado
- [ ] RoleGuard
- [ ] PermissionGuard
- [ ] ContextGuard
- [ ] Decoradores (@Roles, @RequirePermissions)

### Fase 3: Servicios (Semana 3-4)
- [ ] UserService mejorado
- [ ] ContractorService
- [ ] AuthService mejorado

### Fase 4: Integración (Semana 4)
- [ ] Actualizar AuthModule
- [ ] Integración con controladores existentes
- [ ] Testing completo

---

## 📝 Próximos Pasos

1. Revisar [DECISION-POINTS.md](../DECISION-POINTS.md)
2. Comenzar implementación en fases
3. Crear tests unitarios para cada componente
4. Documentar API endpoints

---

**Archivo**: `docs/auth/architecture/05-COMPONENTS.md`
**Actualizado**: 2025-01-11
**Estado**: Propuesta - Listo para implementación
