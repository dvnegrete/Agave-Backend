# Análisis del Problema: Campo `amount` con valor NaN en BD

## 📋 Problema Identificado

Se encontró un registro en la tabla `vouchers` donde el campo `amount` tiene el valor `NaN` (Not a Number), lo cual es inválido y rompe la integridad de los datos.

**Fecha de Análisis:** Octubre 22, 2025

---

## 🔍 Análisis del Flujo Actual

### Flujo de Procesamiento de Vouchers

```
┌──────────────────────────────────────────────────────────┐
│  1. POST webhook/whatsapp                                │
│     ├─ VouchersController.receiveWhatsAppMessage()      │
│     └─ HandleWhatsAppWebhookUseCase.execute()           │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  2. ProcessVoucherUseCase.execute()                      │
│     ├─ Descarga media desde WhatsApp                    │
│     └─ VoucherProcessorService.processVoucher()         │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  3. VoucherProcessorService                              │
│     ├─ OCR: extrae texto → structuredData                │
│     │   └─ monto: string (ej: "1000.15")                │
│     ├─ extractCentavos(): determina casa                 │
│     └─ Guarda en ConversationState (en memoria)          │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  4. Usuario confirma voucher                             │
│     └─ ConfirmVoucherUseCase.execute()                  │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  5. ConfirmVoucherUseCase (línea 96) ⚠️ PROBLEMA        │
│     const amount = parseFloat(savedData.voucherData.monto);│
│     ❌ NO HAY VALIDACIÓN si amount es NaN               │
└──────────────────────────────────────────────────────────┘
                          ↓
┌──────────────────────────────────────────────────────────┐
│  6. generateUniqueConfirmationCode()                     │
│     ├─ voucherData = { amount: NaN, ... }               │
│     └─ voucherRepository.create(voucherData)             │
│         ❌ Se inserta NaN en la BD                      │
└──────────────────────────────────────────────────────────┘
```

---

## 🐛 Causas Raíz del Problema

### 1. **Falta de Validación en `parseFloat()`**

**Archivo:** `confirm-voucher.use-case.ts:96`

```typescript
// ❌ PROBLEMA: No valida si parseFloat retorna NaN
const amount = parseFloat(savedData.voucherData.monto);
```

**Escenarios que generan NaN:**
- `monto = ""` (string vacío) → `parseFloat("")` = `NaN`
- `monto = null` → `parseFloat(null)` = `NaN`
- `monto = undefined` → `parseFloat(undefined)` = `NaN`
- `monto = "abc"` (texto inválido) → `parseFloat("abc")` = `NaN`
- `monto = "1,000.50"` (con comas) → `parseFloat("1,000.50")` = `1` (parseo parcial)

---

### 2. **OCR puede fallar en extracción**

**Archivo:** `ocr.service.ts`

El OCR puede retornar `null`, `undefined`, o string vacío si:
- La imagen está borrosa
- El comprobante tiene formato no estándar
- Falla la extracción de IA

**Ejemplo de structuredData problemático:**
```json
{
  "monto": "",           // ❌ String vacío
  "fecha_pago": "2025-10-22",
  "referencia": "123456",
  "hora_transaccion": "10:00:00"
}
```

---

### 3. **No hay validación en el tipo de BD**

**Schema actual:**
```sql
CREATE TABLE "vouchers" (
  "amount" float NOT NULL,
  -- ...
);
```

**PostgreSQL acepta NaN como valor válido de tipo float:**
```sql
-- ✅ PostgreSQL permite esto:
INSERT INTO vouchers (amount, ...) VALUES ('NaN', ...);

-- Para prevenir:
ALTER TABLE vouchers ADD CONSTRAINT check_amount_valid CHECK (amount > 0);
```

---

### 4. **Falta de Rollback en caso de error**

**Archivo:** `confirmation-code.helper.ts:31-34`

```typescript
const voucher = await voucherRepository.create({
  ...voucherData,
  confirmation_code: confirmationCode,
});
```

Si `voucherData.amount` es `NaN`, se inserta en BD sin rollback porque:
- ✅ PostgreSQL acepta `NaN` como float válido
- ❌ No hay validación de constraint en BD
- ❌ No hay validación en código TypeScript

---

## 📊 Ubicaciones del Problema

### Archivos Afectados

| Archivo | Línea | Problema |
|---------|-------|----------|
| `confirm-voucher.use-case.ts` | 96 | `parseFloat()` sin validación |
| `confirm-voucher.use-case.ts` | 132 | `amount` usado sin validar |
| `confirmation-code.helper.ts` | 31-34 | Inserta en BD sin validar |
| `voucher-processor.service.ts` | Línea 7 | Interface `monto: string` (no validado) |

---

## 🎯 Solución Propuesta

### FASE 1: Validaciones Obligatorias ✅

#### 1.1 Validar `amount` antes de usar

**Ubicación:** `confirm-voucher.use-case.ts:96-132`

```typescript
// ✅ SOLUCIÓN: Validar después de parseFloat
const amount = parseFloat(savedData.voucherData.monto);

// Validar que amount sea un número válido
if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
  this.logger.error(
    `❌ Monto inválido detectado: "${savedData.voucherData.monto}" → ${amount}`
  );

  // Eliminar archivo GCS
  if (savedData.gcsFilename) {
    await this.cleanupGcsFile(savedData.gcsFilename);
  }

  await this.sendWhatsAppMessage(
    phoneNumber,
    `❌ Error: El monto extraído del comprobante es inválido.\n\n` +
    `Por favor envía un comprobante con el monto claramente visible.`
  );

  this.conversationState.clearContext(phoneNumber);

  return {
    success: false,
    error: `Monto inválido: ${savedData.voucherData.monto}`
  };
}
```

**Validaciones aplicadas:**
- ✅ `isNaN(amount)`: Rechaza NaN
- ✅ `!isFinite(amount)`: Rechaza Infinity, -Infinity
- ✅ `amount <= 0`: Rechaza montos negativos y cero

---

#### 1.2 Validar en helper antes de insertar

**Ubicación:** `confirmation-code.helper.ts:18-34`

```typescript
export async function generateUniqueConfirmationCode(
  voucherRepository: VoucherRepository,
  voucherData: any,
  maxRetries: number = 5,
): Promise<ConfirmationCodeGenerationResult> {

  // ✅ NUEVO: Validar amount antes de intentar insertar
  if (
    voucherData.amount === undefined ||
    voucherData.amount === null ||
    isNaN(voucherData.amount) ||
    !isFinite(voucherData.amount) ||
    voucherData.amount <= 0
  ) {
    console.error(
      `❌ Intento de crear voucher con amount inválido: ${voucherData.amount}`
    );
    return {
      success: false,
      error: `Amount inválido: ${voucherData.amount}. Debe ser un número positivo.`,
    };
  }

  let attempt = 0;

  while (attempt < maxRetries) {
    // ... resto del código
  }
}
```

---

### FASE 2: Constraint en Base de Datos (Opcional pero recomendado)

#### 2.1 Migración para agregar constraint

**Archivo nuevo:** `src/shared/database/migrations/add-voucher-amount-constraint.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddVoucherAmountConstraint1729621234567
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Agregar constraint para validar que amount sea positivo y finito
    await queryRunner.query(`
      ALTER TABLE vouchers
      ADD CONSTRAINT check_amount_positive_finite
      CHECK (amount > 0 AND amount < 'Infinity'::float);
    `);

    console.log('✅ Constraint check_amount_positive_finite agregado a vouchers.amount');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE vouchers
      DROP CONSTRAINT IF EXISTS check_amount_positive_finite;
    `);

    console.log('✅ Constraint check_amount_positive_finite eliminado');
  }
}
```

#### 2.2 Limpiar datos existentes

**Script SQL para identificar registros con NaN:**

```sql
-- Ver vouchers con amount = NaN
SELECT
  id,
  amount,
  date,
  authorization_number,
  confirmation_code,
  created_at
FROM vouchers
WHERE amount = 'NaN'::float
ORDER BY created_at DESC;
```

**Opciones de limpieza:**

```sql
-- OPCIÓN 1: Eliminar registros con NaN (si son pocos y no críticos)
DELETE FROM vouchers WHERE amount = 'NaN'::float;

-- OPCIÓN 2: Actualizar con valor placeholder (si necesitas mantener el registro)
UPDATE vouchers
SET amount = 0,
    confirmation_status = false -- Marcar como no confirmado
WHERE amount = 'NaN'::float;

-- OPCIÓN 3: Crear tabla de backup antes de eliminar
CREATE TABLE vouchers_nan_backup AS
SELECT * FROM vouchers WHERE amount = 'NaN'::float;

DELETE FROM vouchers WHERE amount = 'NaN'::float;
```

---

### FASE 3: Validaciones Preventivas en OCR (Futuro)

#### 3.1 Validar en `StructuredData`

**Archivo:** `voucher-processor.service.ts:6-11`

```typescript
export interface StructuredData {
  monto: string;  // ← Mantener como string (viene del OCR)
  fecha_pago: string;
  referencia: string;
  hora_transaccion: string;
}

// ✅ NUEVO: Función de validación
export function validateStructuredData(data: StructuredData): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Validar monto
  if (!data.monto || data.monto.trim() === '') {
    errors.push('Monto vacío o faltante');
  } else {
    const parsedAmount = parseFloat(data.monto);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      errors.push(`Monto inválido: "${data.monto}"`);
    }
  }

  // Validar fecha
  if (!data.fecha_pago || data.fecha_pago.trim() === '') {
    errors.push('Fecha vacía o faltante');
  }

  // Validar hora
  if (!data.hora_transaccion || data.hora_transaccion.trim() === '') {
    errors.push('Hora vacía o faltante');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}
```

---

## 🧪 Tests Necesarios

### Test 1: Validar rechazo de NaN

```typescript
describe('ConfirmVoucherUseCase', () => {
  it('should reject voucher with NaN amount', async () => {
    // Arrange
    const phoneNumber = '5512345678';
    mockConversationState.getVoucherDataForConfirmation.mockReturnValue({
      voucherData: {
        monto: 'abc',  // Causará NaN al parsear
        fecha_pago: '2025-10-22',
        referencia: '123',
        hora_transaccion: '10:00:00',
        casa: 15,
      },
      gcsFilename: 'test-file.jpg',
    });

    // Act
    const result = await useCase.execute({ phoneNumber });

    // Assert
    expect(result.success).toBe(false);
    expect(result.error).toContain('Monto inválido');
    expect(mockVoucherRepository.create).not.toHaveBeenCalled();
    expect(mockGcsCleanupService.deleteTemporaryProcessingFile).toHaveBeenCalledWith(
      'test-file.jpg',
      expect.any(String)
    );
  });
});
```

### Test 2: Validar rechazo de monto vacío

```typescript
it('should reject voucher with empty amount', async () => {
  mockConversationState.getVoucherDataForConfirmation.mockReturnValue({
    voucherData: {
      monto: '',  // String vacío
      fecha_pago: '2025-10-22',
      referencia: '123',
      hora_transaccion: '10:00:00',
      casa: 15,
    },
    gcsFilename: 'test-file.jpg',
  });

  const result = await useCase.execute({ phoneNumber: '5512345678' });

  expect(result.success).toBe(false);
  expect(result.error).toContain('Monto inválido');
});
```

### Test 3: Validar rechazo de monto negativo

```typescript
it('should reject voucher with negative amount', async () => {
  mockConversationState.getVoucherDataForConfirmation.mockReturnValue({
    voucherData: {
      monto: '-100.50',  // Monto negativo
      fecha_pago: '2025-10-22',
      referencia: '123',
      hora_transaccion: '10:00:00',
      casa: 15,
    },
    gcsFilename: 'test-file.jpg',
  });

  const result = await useCase.execute({ phoneNumber: '5512345678' });

  expect(result.success).toBe(false);
  expect(result.error).toContain('Monto inválido');
});
```

---

## 📈 Beneficios de la Solución

### Antes ❌
```
Usuario envía comprobante borroso
    ↓
OCR extrae monto = ""
    ↓
parseFloat("") = NaN
    ↓
Se inserta NaN en BD ❌
    ↓
Registro corrupto
    ↓
Errores en conciliación bancaria
```

### Después ✅
```
Usuario envía comprobante borroso
    ↓
OCR extrae monto = ""
    ↓
parseFloat("") = NaN
    ↓
Validación detecta NaN ✅
    ↓
Rollback automático
    ↓
Mensaje al usuario: "Por favor envía comprobante más claro"
    ↓
Usuario reenvía comprobante
    ↓
Proceso exitoso
```

---

## ✅ Checklist de Implementación

### FASE 1: Validaciones Obligatorias
- [ ] Agregar validación en `confirm-voucher.use-case.ts` línea 96
- [ ] Agregar cleanup de GCS en caso de error
- [ ] Agregar validación en `confirmation-code.helper.ts`
- [ ] Actualizar mensaje de error al usuario
- [ ] Agregar logging detallado

### FASE 2: Tests
- [ ] Test para NaN
- [ ] Test para string vacío
- [ ] Test para monto negativo
- [ ] Test para Infinity
- [ ] Test para null/undefined

### FASE 3: Base de Datos (Opcional)
- [ ] Crear migración con constraint
- [ ] Identificar registros existentes con NaN
- [ ] Limpiar datos corruptos
- [ ] Ejecutar migración

### FASE 4: Validaciones Preventivas (Futuro)
- [ ] Validar en `StructuredData`
- [ ] Mejorar prompts de IA para extracción
- [ ] Agregar validación de formato en OCR

---

## 🚨 Prioridad de Implementación

**CRÍTICO (FASE 1):**
- ✅ Validaciones en `confirm-voucher.use-case.ts`
- ✅ Validaciones en `confirmation-code.helper.ts`
- ✅ Cleanup de GCS en error
- ✅ Tests básicos

**IMPORTANTE (FASE 2):**
- ⚠️ Constraint en BD
- ⚠️ Limpieza de datos existentes

**MEJORA (FASE 3):**
- 💡 Validaciones preventivas en OCR
- 💡 Mejora de prompts de IA

---

**Creado por:** Claude Code
**Fecha:** Octubre 22, 2025
**Estado:** 📋 Análisis completo
**Siguiente paso:** Implementar FASE 1
