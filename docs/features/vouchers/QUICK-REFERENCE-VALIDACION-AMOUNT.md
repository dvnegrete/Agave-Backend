# 🚀 Quick Reference: Validación de Amount en Vouchers

**TL;DR:** Se implementó triple validación para prevenir `amount = NaN` en vouchers.

---

## ✅ Qué se implementó

### **1. Validación en ConfirmVoucherUseCase** (Capa 1)
**Archivo:** `src/features/vouchers/application/confirm-voucher.use-case.ts:95-121`

```typescript
const amount = parseFloat(savedData.voucherData.monto);

if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
  // Cleanup GCS + notificar WhatsApp + retornar error
}
```

### **2. Validación en Helper** (Capa 2 - Fail-safe)
**Archivo:** `src/features/vouchers/shared/helpers/confirmation-code.helper.ts:23-38`

```typescript
if (isNaN(voucherData.amount) || !isFinite(voucherData.amount) || voucherData.amount <= 0) {
  return { success: false, error: 'Amount inválido' };
}
```

### **3. Constraint CHECK en Database** (Capa 3)
**Migración:** `1729622400000-add-voucher-amount-constraint.ts`

```sql
ALTER TABLE vouchers
ADD CONSTRAINT check_amount_valid
CHECK (
  amount > 0 AND
  amount < 'Infinity'::float AND
  amount = amount  -- Rechaza NaN
);
```

---

## 🧪 Cómo probar

### **Verificar constraint existe:**
```sql
SELECT conname FROM pg_constraint WHERE conname = 'check_amount_valid';
```

### **Intentar insertar NaN (debe fallar):**
```sql
INSERT INTO vouchers (date, amount, confirmation_status)
VALUES (NOW(), 'NaN'::float, false);
-- ERROR: new row violates check constraint "check_amount_valid"
```

### **Verificar no hay registros inválidos:**
```sql
SELECT COUNT(*) FROM vouchers
WHERE amount = 'NaN'::float OR amount <= 0;
-- Debe retornar: 0
```

---

## 🔧 Comandos útiles

### **Correr migraciones:**
```bash
npm run build && npm run db:dev
```

### **Verificar vouchers inválidos:**
```bash
PGPASSWORD=xxx psql -h xxx -U xxx -d bd_agave -c \
  "SELECT id, amount, confirmation_code FROM vouchers WHERE amount = 'NaN'::float OR amount <= 0;"
```

### **Corregir voucher con NaN:**
```sql
-- Backup primero
CREATE TABLE vouchers_backup AS
SELECT * FROM vouchers WHERE id = [ID];

-- Setear a 0 y marcar como no confirmado
UPDATE vouchers
SET amount = 0, confirmation_status = false
WHERE id = [ID];
```

---

## ⚠️ Casos que se rechazan

| Caso | Ejemplo | ¿Se guarda? |
|------|---------|-------------|
| NaN | `parseFloat('abc')` | ❌ NO |
| Infinity | `1/0` | ❌ NO |
| -Infinity | `-1/0` | ❌ NO |
| Negativo | `-100` | ❌ NO |
| Cero | `0` | ❌ NO |
| Válido positivo | `1000.50` | ✅ SÍ |

---

## 📋 Checklist de troubleshooting

Si un usuario reporta error al enviar comprobante:

- [ ] Revisar logs: ¿Qué texto extrajo el OCR?
- [ ] Ver imagen en GCS: ¿Es legible el monto?
- [ ] Verificar base de datos: ¿Se guardó algo?
- [ ] Si se guardó con amount=0: Revisar tabla `vouchers_nan_backup`
- [ ] Si OCR falló: Pedir al usuario reenviar con mejor calidad

---

## 🔗 Documentación completa

- **Análisis del problema:** `docs/features/vouchers/ANALISIS-PROBLEMA-NAN-AMOUNT.md`
- **Implementación detallada:** `docs/features/vouchers/VALIDACION-AMOUNT-IMPLEMENTADA.md`
- **Guía de migración:** `docs/features/vouchers/INSTRUCCIONES-MIGRACION-CONSTRAINT.md`
- **Resumen ejecutivo:** `docs/features/vouchers/RESUMEN-IMPLEMENTACION-VALIDACION-NAN.md`

---

**Última actualización:** Octubre 23, 2025
**Estado:** ✅ Implementado y funcionando en producción
