# Funcionalidades Pendientes

Este archivo registra features y funcionalidades planificadas pero no implementadas aún.

## Houses Management Feature

**Prioridad**: Media
**Fecha registro**: 2025-10-30
**Contexto**: Actualmente el sistema de conciliación bancaria crea casas automáticamente asignadas al usuario sistema (`00000000-0000-0000-0000-000000000000`). Se necesita funcionalidad para reasignar estas casas a sus propietarios reales.

### Estado Actual
- ✅ `HouseRepository` ya tiene métodos `updateOwner()` y `update()` implementados
- ❌ No existe módulo de gestión de casas
- ❌ No hay endpoints API para operaciones de casas
- ❌ No hay casos de uso en capa de aplicación

### Tareas Pendientes

#### 1. Crear módulo Houses Management
- [ ] `src/features/houses/houses.module.ts`
- [ ] Seguir arquitectura clean (domain, application, infrastructure, interfaces)
- [ ] Registrar en `app.module.ts`

#### 2. Casos de Uso (Application Layer)
- [ ] `UpdateHouseOwnerUseCase` - Reasignar casa a propietario real
  - Validar que la casa existe
  - Validar que el nuevo propietario existe y tiene role 'tenant'
  - Actualizar owner usando `HouseRepository.updateOwner()`
  - Retornar casa actualizada
- [ ] `GetHousesBySystemUserUseCase` - Listar casas pendientes de asignación
  - Filtrar casas donde `user_id = '00000000-0000-0000-0000-000000000000'`
  - Retornar lista con información de número de casa y fechas
- [ ] `GetHousesUseCase` - Obtener casas con filtros
- [ ] `GetHouseDetailsUseCase` - Obtener detalles de una casa específica

#### 3. DTOs (Interfaces Layer)
- [ ] `UpdateHouseOwnerDto`
  ```typescript
  {
    newOwnerId: string;  // UUID del nuevo propietario
  }
  ```
- [ ] `GetHousesFiltersDto`
  ```typescript
  {
    userId?: string;     // Filtrar por propietario
    status?: string;     // Filtrar por estatus
    page?: number;
    limit?: number;
  }
  ```
- [ ] `HouseResponseDto` - Response estandarizado

#### 4. Controller (Interfaces Layer)
- [ ] `HousesController`
- [ ] Endpoints:
  - `GET /houses` - Listar casas con filtros
  - `GET /houses/pending-assignment` - Casas del usuario sistema
  - `GET /houses/:numberHouse` - Detalles de una casa
  - `PATCH /houses/:numberHouse/owner` - Reasignar propietario
- [ ] Guards de autenticación y autorización
- [ ] Documentación Swagger

#### 5. Testing
- [ ] Unit tests para casos de uso
- [ ] Unit tests para controller
- [ ] E2E tests para flujo completo de reasignación

#### 6. Documentación
- [ ] `docs/features/houses/README.md`
- [ ] Actualizar `docs/README.md`
- [ ] Casos de uso y ejemplos de API

### Referencias
- Repositorio: `src/shared/database/repositories/house.repository.ts:142`
- Entidad: `src/shared/database/entities/house.entity.ts`
- Contexto: `docs/troubleshooting/system-user-missing.md:169-179`

### Notas Técnicas
- El usuario sistema es usado temporalmente durante conciliación bancaria
- Las casas deben poder reasignarse una vez identificado el propietario real
- Considerar agregar log/auditoría de cambios de propietario
- Validar que el nuevo propietario tenga role 'tenant'
