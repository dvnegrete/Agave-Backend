# Implementación de Registro de Comprobantes con Relaciones Múltiples

**Fecha:** 2024-10-13
**Autor:** Claude Code
**Feature:** Registro completo de vouchers con relaciones en múltiples tablas

---

## 📋 Resumen

Se implementó un sistema de registro transaccional completo para comprobantes (vouchers) recibidos vía WhatsApp, que guarda información relacionada en 4 tablas: `vouchers`, `records`, `houses`, `users` y la tabla intermedia `house_records`.

---

## 🎯 Objetivos Cumplidos

✅ Una casa puede tener múltiples records (pagos)
✅ Un usuario puede tener múltiples casas
✅ Una casa puede cambiar de propietario
✅ Número de teléfono internacional con código de país (E.164)
✅ Transacciones ACID para garantizar integridad de datos
✅ Validación obligatoria de número de casa

---

## 🏗️ Arquitectura de la Solución

### 1. Nueva Estructura de Base de Datos

#### Tabla Intermedia: `house_records`
```sql
CREATE TABLE house_records (
  id SERIAL PRIMARY KEY,
  house_id INT REFERENCES houses(id) ON DELETE CASCADE,
  record_id INT REFERENCES records(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);
```

#### Modificación: `houses`
```sql
-- ANTES:
houses (
  number_house INT PRIMARY KEY,  -- ❌ No permitía múltiples records
  user_id UUID,
  record_id INT REFERENCES records(id)  -- ❌ Solo un record por casa
)

-- DESPUÉS:
houses (
  id SERIAL PRIMARY KEY,         -- ✅ Nueva PK autogenerada
  number_house INT UNIQUE,       -- ✅ Ahora es unique, no PK
  user_id UUID REFERENCES users(id)
  -- record_id REMOVIDO          -- ✅ Ahora usa house_records
)
```

#### Modificación: `records`
```sql
-- Relación actualizada
records.houseRecords: HouseRecord[]  -- ✅ One-to-Many con house_records
```

#### Modificación: `users`
```sql
-- Campo cel_phone ahora almacena números internacionales
users (
  id UUID PRIMARY KEY,           -- UUID generado manualmente
  cel_phone NUMERIC,             -- ✅ Formato E.164 (ej: 525512345678)
  ...
)
```

---

## 📁 Archivos Creados/Modificados

### ✨ Nuevos Archivos

#### Entidades
- `src/shared/database/entities/house-record.entity.ts`

#### Repositorios
- `src/shared/database/repositories/record.repository.ts`
- `src/shared/database/repositories/house.repository.ts`
- `src/shared/database/repositories/user.repository.ts`
- `src/shared/database/repositories/house-record.repository.ts`

#### Utilidades
- `src/shared/common/utils/phone-number.util.ts`

#### Migración
- `src/shared/database/migrations/1729113600000-add-house-record-table-and-update-relations.ts`

### 🔄 Archivos Modificados

- `src/shared/database/entities/house.entity.ts` - Nueva estructura con id autogenerado
- `src/shared/database/entities/record.entity.ts` - Relación con HouseRecord
- `src/shared/database/entities/index.ts` - Export de HouseRecord
- `src/shared/database/database.module.ts` - Registro de entidades y repositorios
- `src/features/vouchers/application/confirm-voucher.use-case.ts` - Flujo transaccional completo
- `src/shared/common/utils/index.ts` - Export de phone-number utils
- `package.json` - Dependencias uuid y @types/uuid

---

## 🔄 Flujo de Registro Completo

```typescript
// Endpoint: POST /vouchers/webhook/whatsapp
// Use Case: confirm-voucher.use-case.ts:50

1. ✅ Validar datos del voucher
   - Verificar que 'casa' esté presente (obligatorio)
   - Si no está: rechazar con error

2. ✅ Crear Voucher
   - Generar código de confirmación único
   - Guardar en tabla vouchers
   - Estado inicial: confirmation_status = false

3. ✅ INICIO DE TRANSACCIÓN (TypeORM QueryRunner)

4. ✅ Buscar o Crear Usuario
   - Parsear phoneNumber con código de país (E.164)
   - Buscar en users por cel_phone
   - Si NO existe:
     * Generar UUID manual (uuid v4)
     * Crear usuario con role=TENANT, status=ACTIVE

5. ✅ Crear Record
   - vouchers_id = voucher.id (del paso 2)
   - transaction_status_id = null
   - Todos los campos cta_* = null

6. ✅ Buscar o Crear Casa
   - Buscar en houses por number_house
   - Si NO existe:
     * Crear con number_house y user_id
   - Si EXISTE y cambió propietario:
     * Actualizar user_id

7. ✅ Crear Asociación house_records
   - house_id = house.id
   - record_id = record.id

8. ✅ COMMIT TRANSACCIÓN
   - Si todo OK: Commit
   - Si hay error: Rollback automático

9. ✅ Enviar mensaje de éxito por WhatsApp

10. ✅ Limpiar contexto de conversación
```

---

## 🌍 Soporte Internacional de Teléfonos

### Función: `parsePhoneNumberWithCountryCode()`

```typescript
// Acepta cualquier formato E.164 internacional
parsePhoneNumberWithCountryCode("525512345678")  // México: 525512345678
parsePhoneNumberWithCountryCode("14155552671")   // USA: 14155552671
parsePhoneNumberWithCountryCode("4420123456")    // UK: 4420123456
parsePhoneNumberWithCountryCode("5491123456789") // Argentina: 5491123456789
parsePhoneNumberWithCountryCode("351912345678")  // Portugal: 351912345678
```

#### Códigos de País Soportados (ejemplos)
- **1** - USA, Canadá (11 dígitos)
- **52** - México (12 dígitos)
- **54** - Argentina (11-13 dígitos)
- **55** - Brasil (12-13 dígitos)
- **57** - Colombia (12 dígitos)
- **44** - Reino Unido (12-13 dígitos)
- **351** - Portugal (12 dígitos)
- **593** - Ecuador (12 dígitos)

**Validación:** 10-15 dígitos según estándar ITU-T E.164

---

## 📊 Relaciones de Datos

```
┌─────────┐      ┌─────────┐      ┌───────────────┐      ┌─────────┐      ┌──────────┐
│  users  │ 1──N │ houses  │ 1──N │ house_records │ N──1 │ records │ N──1 │ vouchers │
└─────────┘      └─────────┘      └───────────────┘      └─────────┘      └──────────┘
    ↑                                                           ↓
    │                                                           │
    └───────────── cel_phone (E.164) ─────────────┘            │
                                                                ↓
                                                    ┌────────────────────┐
                                                    │ transaction_status │
                                                    │ cta_* (null por    │
                                                    │ ahora, se llenará  │
                                                    │ con transactions-  │
                                                    │ bank)              │
                                                    └────────────────────┘
```

### Multiplicidad
- **1 usuario** → **N casas**
- **1 casa** → **N records** (a través de house_records)
- **1 record** → **1 voucher**
- **1 record** → **N house_records** (puede estar asociado a múltiples casas si es necesario)

---

## 🔒 Garantías de Integridad

### Transacciones ACID
```typescript
const queryRunner = this.dataSource.createQueryRunner();
await queryRunner.connect();
await queryRunner.startTransaction();

try {
  // Todas las operaciones de BD
  await queryRunner.commitTransaction(); // ✅ Todo exitoso
} catch (error) {
  await queryRunner.rollbackTransaction(); // ❌ Revertir todo
  throw error;
} finally {
  await queryRunner.release(); // Liberar conexión
}
```

### Validaciones
1. **Número de casa obligatorio:** Si `voucherData.casa` es `null` → Error y rechazo
2. **Teléfono válido:** Debe cumplir formato E.164 (10-15 dígitos)
3. **Código de confirmación único:** Retry logic si hay colisión
4. **Foreign Keys:** Cascade en eliminaciones para mantener consistencia

---

## 🚀 Cómo Ejecutar

### 1. Instalar Dependencias
```bash
npm install  # uuid ya está instalado
```

### 2. Ejecutar Migración
```bash
# Desarrollo
npm run db:dev

# Producción
npm run db:deploy
```

### 3. Compilar y Ejecutar
```bash
# Compilar
npm run build

# Ejecutar en desarrollo
npm run start:dev
```

### 4. Verificar
```bash
# Verificar estructura de tablas
npm run db:check-schema

# Verificar logs
tail -f logs/app.log
```

---

## 🧪 Ejemplos de Uso

### Caso 1: Usuario Nuevo + Casa Nueva

```
Input: WhatsApp de 525512345678 con comprobante de casa #42

Flujo:
1. ✅ Usuario NO existe → Crear (uuid-1234, cel_phone=525512345678)
2. ✅ Voucher creado (id=100)
3. ✅ Record creado (id=200, vouchers_id=100)
4. ✅ Casa #42 NO existe → Crear (id=1, number_house=42, user_id=uuid-1234)
5. ✅ house_record creado (house_id=1, record_id=200)

Resultado:
- users: 1 registro nuevo
- vouchers: 1 registro nuevo
- records: 1 registro nuevo
- houses: 1 registro nuevo
- house_records: 1 registro nuevo
```

### Caso 2: Usuario Existente + Segunda Casa

```
Input: Mismo usuario 525512345678 con comprobante de casa #15

Flujo:
1. ✅ Usuario EXISTE (uuid-1234) → Reutilizar
2. ✅ Voucher creado (id=101)
3. ✅ Record creado (id=201, vouchers_id=101)
4. ✅ Casa #15 NO existe → Crear (id=2, number_house=15, user_id=uuid-1234)
5. ✅ house_record creado (house_id=2, record_id=201)

Resultado:
- El usuario uuid-1234 ahora tiene 2 casas (#42 y #15)
```

### Caso 3: Segundo Pago de la Misma Casa

```
Input: Usuario 525512345678 envía otro comprobante de casa #42

Flujo:
1. ✅ Usuario EXISTE (uuid-1234) → Reutilizar
2. ✅ Voucher creado (id=102)
3. ✅ Record creado (id=202, vouchers_id=102)
4. ✅ Casa #42 EXISTE (id=1) → Reutilizar
5. ✅ house_record creado (house_id=1, record_id=202) ← NUEVO REGISTRO

Resultado:
- Casa #42 ahora tiene 2 records (pagos): record_id=200 y record_id=202
```

### Caso 4: Casa Cambia de Propietario

```
Input: Nuevo usuario 525598765432 envía comprobante de casa #42

Flujo:
1. ✅ Usuario NO existe → Crear (uuid-5678, cel_phone=525598765432)
2. ✅ Voucher creado (id=103)
3. ✅ Record creado (id=203, vouchers_id=103)
4. ✅ Casa #42 EXISTE (id=1, user_id=uuid-1234)
   → Actualizar user_id=uuid-5678 (cambio de propietario)
5. ✅ house_record creado (house_id=1, record_id=203)

Resultado:
- Casa #42 ahora pertenece a uuid-5678
- Historial de pagos anteriores se mantiene intacto
```

---

## ⚠️ Notas Importantes

1. **UUID Manual:** Los UUIDs de usuarios se generan con `uuid v4` hasta implementar Supabase Auth
2. **Campos null:** Los campos `cta_*` y `transaction_status_id` en `records` se llenarán cuando se implemente el feature `transactions-bank`
3. **Código de País:** WhatsApp API siempre envía números en formato E.164 con código de país
4. **Rollback Automático:** Si cualquier operación falla, toda la transacción se revierte
5. **Logs Detallados:** Cada operación registra logs para debugging

---

## 🔍 Verificación Manual

### Consultar registros creados
```sql
-- Ver usuario por teléfono
SELECT * FROM users WHERE cel_phone = 525512345678;

-- Ver casas de un usuario
SELECT h.*, u.cel_phone
FROM houses h
JOIN users u ON h.user_id = u.id
WHERE u.cel_phone = 525512345678;

-- Ver todos los pagos de una casa
SELECT r.*, v.amount, v.date, v.confirmation_code
FROM house_records hr
JOIN records r ON hr.record_id = r.id
JOIN vouchers v ON r.vouchers_id = v.id
WHERE hr.house_id = 1
ORDER BY v.date DESC;

-- Ver historial completo de una casa
SELECT
  h.number_house,
  u.cel_phone AS propietario,
  v.amount,
  v.date,
  v.confirmation_code,
  r.created_at AS fecha_registro
FROM house_records hr
JOIN houses h ON hr.house_id = h.id
JOIN users u ON h.user_id = u.id
JOIN records r ON hr.record_id = r.id
JOIN vouchers v ON r.vouchers_id = v.id
WHERE h.number_house = 42
ORDER BY v.date DESC;
```

---

## 📚 Referencias

- **TypeORM Transactions:** https://typeorm.io/transactions
- **E.164 Format:** https://en.wikipedia.org/wiki/E.164
- **WhatsApp Business API:** https://developers.facebook.com/docs/whatsapp
- **UUID v4:** https://www.npmjs.com/package/uuid

---

## ✅ Checklist de Implementación

- [x] Crear entidad HouseRecord
- [x] Modificar entidad House (agregar id PK, remover record_id)
- [x] Actualizar entidad Record (relación con HouseRecord)
- [x] Crear RecordRepository
- [x] Crear HouseRepository
- [x] Crear UserRepository
- [x] Crear HouseRecordRepository
- [x] Actualizar DatabaseModule
- [x] Crear helper de parseo de teléfono (internacional)
- [x] Modificar confirm-voucher.use-case.ts (flujo transaccional)
- [x] Instalar dependencia uuid
- [x] Crear migración de base de datos
- [x] Verificar compilación
- [x] Actualizar soporte internacional de teléfonos
- [x] Crear documentación

---

**Estado:** ✅ Implementación Completa
**Próximos Pasos:** Ejecutar migración en ambiente de desarrollo y probar con datos reales
