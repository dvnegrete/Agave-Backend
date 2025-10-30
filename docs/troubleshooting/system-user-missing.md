# Troubleshooting: Usuario del Sistema Faltante

## Error

```
Error durante persistencia automática: insert or update on table "houses"
violates foreign key constraint "FK_..." DETAIL: Key (user_id)=(00000000-0000-0000-0000-000000000000)
is not present in table "users".
```

## Causa

El error ocurre cuando la **conciliación bancaria automática** intenta crear una casa automáticamente (identificada por centavos) pero el **usuario del sistema no existe** en la base de datos.

### ¿Qué es el Usuario del Sistema?

- **UUID**: `00000000-0000-0000-0000-000000000000`
- **Email**: `sistema@conciliacion.local`
- **Propósito**: Propietario temporal de casas creadas automáticamente

Cuando la conciliación bancaria identifica una casa por centavos pero la casa no existe en la base de datos, el sistema la crea automáticamente y la asigna a este usuario especial hasta que se identifique al propietario real.

## Solución Rápida

### Opción 1: Comando npm (Recomendado)

```bash
npm run db:ensure-system-user
```

Este comando:
- ✅ Verifica si el usuario existe
- ✅ Lo crea si no existe
- ✅ Muestra confirmación

### Opción 2: SQL Directo

```bash
# Con variables de entorno
bash -c 'set -a && source .env && psql "$DATABASE_URL" -f src/shared/database/scripts/ensure-system-user.sql'

# O si ya tienes DATABASE_URL cargado
psql $DATABASE_URL -f src/shared/database/scripts/ensure-system-user.sql
```

### Opción 3: Migración de TypeORM

```bash
# Ejecutar todas las migraciones pendientes (incluye EnsureSystemUser)
npm run db:deploy
```

### Opción 4: SQL Manual

```sql
-- Conectarse a la base de datos y ejecutar:
INSERT INTO users (id, mail, role, status, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'sistema@conciliacion.local',
  'tenant',
  'active',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
```

## Verificación

Después de aplicar la solución, verifica que el usuario existe:

```bash
# Opción 1: Con npm
npm run db:check-schema
psql $DATABASE_URL -c "SELECT id, mail, role FROM users WHERE id = '00000000-0000-0000-0000-000000000000';"

# Opción 2: SQL directo
psql $DATABASE_URL -c "SELECT * FROM users WHERE id = '00000000-0000-0000-0000-000000000000';"
```

**Resultado esperado**:
```
                  id                  |            mail             | role
--------------------------------------+-----------------------------+--------
 00000000-0000-0000-0000-000000000000 | sistema@conciliacion.local  | tenant
```

## ¿Por qué ocurre este error?

### Escenario 1: Base de Datos Antigua

Si tu base de datos se creó ANTES de que se agregara el usuario del sistema al script `bd_initial.sql`, no tendrás este usuario.

**Solución**: Ejecutar el script de creación del usuario.

### Escenario 2: Migración Incompleta

Si ejecutaste migraciones pero faltó la migración `EnsureSystemUser`.

**Solución**: Ejecutar `npm run db:deploy`.

### Escenario 3: Base de Datos Limpia/Reset

Si hiciste un DROP de la tabla `users` o reset completo.

**Solución**: Ejecutar `npm run db:push` (crea todo desde cero) o `npm run db:ensure-system-user` (solo el usuario).

## Prevención

Para evitar este error en el futuro:

### 1. En Nuevas Instalaciones

Siempre ejecuta el script completo:
```bash
npm run db:push
```

Esto incluye automáticamente el usuario del sistema.

### 2. En Actualizaciones

Ejecuta las migraciones:
```bash
npm run db:deploy
```

### 3. En CI/CD

Agrega este paso a tu pipeline:
```yaml
- name: Ensure system user
  run: npm run db:ensure-system-user
```

### 4. En Documentación de Setup

Incluye verificación en tu checklist de instalación:
- [ ] Base de datos creada
- [ ] Migraciones ejecutadas
- [ ] Usuario del sistema verificado ✅

## Casas Asignadas al Usuario del Sistema

Para ver cuántas casas están asignadas al usuario del sistema:

```sql
SELECT COUNT(*) as casas_sistema
FROM houses
WHERE user_id = '00000000-0000-0000-0000-000000000000';
```

Para ver las casas específicas:

```sql
SELECT
  h.id,
  h.number_house,
  h.created_at,
  COUNT(hr.id) as registros_pago
FROM houses h
LEFT JOIN house_records hr ON h.id = hr.house_id
WHERE h.user_id = '00000000-0000-0000-0000-000000000000'
GROUP BY h.id, h.number_house, h.created_at
ORDER BY h.number_house;
```

## Reasignar Casas a Propietarios Reales

Una vez identificado el propietario real de una casa:

```sql
-- Actualizar propietario de una casa específica
UPDATE houses
SET user_id = '[UUID-del-propietario-real]'
WHERE number_house = [numero-de-casa]
  AND user_id = '00000000-0000-0000-0000-000000000000';
```

## Flujo de Conciliación con Casas Nuevas

### ¿Cómo funciona la creación automática?

1. **Transacción bancaria llega** con centavos identificadores (ej: $800.15)
2. **Sistema identifica casa** por centavos (casa #15)
3. **Verifica si la casa existe** en la tabla `houses`
4. **Si NO existe**:
   - Crea la casa automáticamente
   - La asigna al usuario del sistema
   - Procede con la conciliación
5. **Si existe**:
   - Usa la casa existente
   - Procede con la conciliación

### Código Relevante

```typescript
// src/features/bank-reconciliation/infrastructure/persistence/reconciliation-persistence.service.ts

const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000';

private async createHouseRecordAssociation(
  houseNumber: number,
  recordId: number,
  queryRunner: QueryRunner,
): Promise<void> {
  let house = await this.houseRepository.findByNumberHouse(houseNumber);

  if (!house) {
    // Casa no existe, crear nueva asignada al usuario "Sistema"
    house = await this.houseRepository.create(
      {
        number_house: houseNumber,
        user_id: SYSTEM_USER_ID, // ⬅️ Aquí ocurre el error si no existe el usuario
      },
      queryRunner,
    );
  }

  // Crear asociación en house_records
  await this.houseRecordRepository.create(
    {
      house_id: house.id,
      record_id: recordId,
    },
    queryRunner,
  );
}
```

## Archivos Relacionados

- **Script SQL**: `src/shared/database/scripts/ensure-system-user.sql`
- **Migración**: `src/shared/database/migrations/1761860000000-EnsureSystemUser.ts`
- **Schema inicial**: `bd_initial.sql` (líneas 480-490)
- **Código de conciliación**: `src/features/bank-reconciliation/infrastructure/persistence/reconciliation-persistence.service.ts`

## Referencias

- [Database Setup Guide](../database/setup.md)
- [Bank Reconciliation Feature](../features/bank-reconciliation/README.md)
- [Migration Guide](../features/payment-management/MIGRATIONS.md)

---

**Última actualización**: Octubre 30, 2025
**Relacionado con**: Conciliación Bancaria Automática
