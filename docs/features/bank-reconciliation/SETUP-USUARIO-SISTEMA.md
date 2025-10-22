# Setup: Usuario Sistema para Conciliación Automática

## 🎯 Propósito

El feature de **conciliación bancaria automática** puede crear casas automáticamente cuando identifica un número de casa por centavos (ej: $500.01 → Casa 1) pero esa casa aún no existe en la base de datos.

Como la tabla `houses` requiere un `user_id` (NOT NULL), estas casas se asignan a un **usuario "Sistema"** especial.

---

## ⚠️ Requisito Obligatorio

Antes de usar la conciliación automática, **DEBES crear el usuario Sistema en tu base de datos**.

---

## 📋 Script SQL para Crear Usuario Sistema

### Opción 1: PostgreSQL (Producción/Desarrollo)

```sql
-- Crear usuario Sistema para conciliación bancaria automática
INSERT INTO users (id, email, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'sistema@conciliacion.local',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
```

### Opción 2: Verificar si ya existe

```sql
-- Verificar si el usuario Sistema ya existe
SELECT id, email, created_at
FROM users
WHERE id = '00000000-0000-0000-0000-000000000000';
```

**Resultado esperado**:
```
id                                   | email                        | created_at
-------------------------------------|------------------------------|-------------------
00000000-0000-0000-0000-000000000000 | sistema@conciliacion.local   | 2025-10-21 ...
```

---

## 🔧 Instrucciones de Setup

### 1. Conectarse a la Base de Datos

```bash
# Usando psql
psql -h localhost -U postgres -d agave_db

# O usando Docker si la BD está en contenedor
docker exec -it postgres-container psql -U postgres -d agave_db
```

### 2. Ejecutar el Script SQL

Copia y pega el script de "Opción 1" en tu terminal psql:

```sql
INSERT INTO users (id, email, created_at, updated_at)
VALUES (
  '00000000-0000-0000-0000-000000000000',
  'sistema@conciliacion.local',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;
```

### 3. Verificar Creación Exitosa

```sql
SELECT * FROM users WHERE email = 'sistema@conciliacion.local';
```

---

## 🏠 ¿Qué Pasa Cuando se Crea una Casa Automáticamente?

### Flujo de Creación Automática

```
1. Llega transacción: $500.01
   ├─ Centavos: 01 → Casa 1
   └─ Casa 1 no existe en BD

2. Sistema ejecuta:
   INSERT INTO houses (number_house, user_id)
   VALUES (1, '00000000-0000-0000-0000-000000000000');

3. Casa 1 creada ✅
   ├─ number_house: 1
   ├─ user_id: 00000000-0000-0000-0000-000000000000 (Sistema)
   └─ Propietario: sistema@conciliacion.local

4. Transacción conciliada automáticamente ✅
```

### Log en Aplicación

```
[ReconciliationPersistenceService] Casa 1 no existe, creando automáticamente (asignada a usuario Sistema)
[ReconciliationPersistenceService] Casa 1 creada exitosamente con ID: 123 (propietario: Sistema)
[ReconciliationPersistenceService] Conciliación exitosa: TransactionBank tx-123 <-> Sin voucher (conciliación automática) -> Casa 1
```

---

## 🔄 Reasignar Propietario Real

Las casas creadas automáticamente pueden reasignarse a su propietario real después:

```sql
-- Actualizar propietario de Casa 1
UPDATE houses
SET user_id = 'uuid-del-propietario-real'
WHERE number_house = 1
  AND user_id = '00000000-0000-0000-0000-000000000000';
```

### Ejemplo con Voucher

Cuando un usuario envía su comprobante por WhatsApp:
1. El sistema identifica su `user_id` del mensaje
2. Si la casa ya existe pero está asignada a "Sistema"
3. **Automáticamente actualiza** el propietario (ver `confirm-voucher.use-case.ts:310`)

```typescript
// Actualización automática de propietario
if (house.user_id !== userId) {
  await queryRunner.manager.update(
    'houses',
    { id: house.id },
    { user_id: userId },
  );
}
```

---

## ❌ ¿Qué Pasa si NO Creo el Usuario Sistema?

Si intentas conciliar sin crear el usuario Sistema, obtendrás este error:

```
Error durante persistencia automática:
insert or update on table "houses" violates foreign key constraint "houses_user_id_fkey"
```

**Solución**: Ejecuta el script SQL de este documento.

---

## 📊 Consultas Útiles

### Ver todas las casas del usuario Sistema

```sql
SELECT
  h.id,
  h.number_house,
  h.created_at,
  COUNT(hr.id) as total_records
FROM houses h
LEFT JOIN house_records hr ON hr.house_id = h.id
WHERE h.user_id = '00000000-0000-0000-0000-000000000000'
GROUP BY h.id, h.number_house, h.created_at
ORDER BY h.number_house;
```

### Casas pendientes de asignar propietario real

```sql
SELECT
  h.number_house,
  h.created_at,
  h.updated_at,
  COUNT(hr.id) as conciliaciones
FROM houses h
LEFT JOIN house_records hr ON hr.house_id = h.id
WHERE h.user_id = '00000000-0000-0000-0000-000000000000'
GROUP BY h.id
HAVING COUNT(hr.id) > 0  -- Solo casas con al menos 1 conciliación
ORDER BY h.created_at DESC;
```

---

## 🔒 Restricciones del Usuario Sistema

- **Email**: `sistema@conciliacion.local` (no real, solo identificador)
- **No puede iniciar sesión**: Este usuario es solo para uso interno
- **UUID fijo**: `00000000-0000-0000-0000-000000000000` (constante en código)
- **Propósito**: Placeholder temporal hasta asignar propietario real

---

## ✅ Checklist de Verificación

Antes de ejecutar conciliación automática por primera vez:

- [ ] Usuario Sistema creado en tabla `users`
- [ ] UUID correcto: `00000000-0000-0000-0000-000000000000`
- [ ] Email: `sistema@conciliacion.local`
- [ ] Verificado con: `SELECT * FROM users WHERE id = '00000000-0000-0000-0000-000000000000'`

---

## 📚 Referencias

- **Código**: `src/features/bank-reconciliation/infrastructure/persistence/reconciliation-persistence.service.ts:20`
- **Constante**: `SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000000'`
- **Patrón similar**: `src/features/vouchers/application/confirm-voucher.use-case.ts:295`

---

**Última actualización**: Octubre 2025
**Versión**: 2.0.0
