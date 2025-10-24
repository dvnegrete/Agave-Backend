# 🐛 Bugfix: Hora Automática NO debe marcarse como campo faltante

**Fecha:** Octubre 23, 2025
**Tipo:** Bugfix
**Prioridad:** Alta
**Estado:** ✅ Fixed

---

## 📋 Problema Reportado

**Síntomas:**
1. Usuario envía comprobante con centavos válidos pero sin hora visible
2. Sistema asigna hora `12:00:00` automáticamente
3. **BUG:** Sistema muestra mensaje "No pude extraer los datos, proporciona: undefined"
4. Usuario responde "12:00"
5. **BUG:** Sistema responde "Ya tengo todos los datos. Procesando..."
6. Flujo se rompe, voucher no se guarda correctamente

**Causa Raíz:**

El flujo tenía un problema de timing:

```
1. OCR extrae datos → hora_transaccion vacía
2. OCR marca faltan_datos = true
3. extractCentavos() asigna hora 12:00:00 + flag hora_asignada_automaticamente
4. BUT: faltan_datos sigue siendo true (marcado antes)
5. Flujo entra en handleMissingData()
6. identifyMissingFields() vuelve a ejecutarse
7. AHORA hora_transaccion = "12:00:00" (ya existe)
8. missingFields está vacío o tiene campos incorrectos
9. Sistema confundido: muestra "undefined" o se sale con handleNoMoreMissingFields()
```

---

## 🔧 Solución Implementada

### **1. Ajustar `VoucherValidator.identifyMissingFields()`**

**Archivo:** `src/features/vouchers/domain/voucher-validator.ts`

**Líneas:** 36-40

**Cambio:**

```typescript
// NO marcar hora como faltante si fue asignada automáticamente
const horaAsignadaAutomaticamente = (voucherData as any).hora_asignada_automaticamente;
if (!this.toSafeString(voucherData.hora_transaccion) && !horaAsignadaAutomaticamente) {
  missingFields.push('hora_transaccion');
}
```

**Lógica:**
- Si `hora_transaccion` está vacía/null → Marcar como faltante
- **PERO** si `hora_asignada_automaticamente = true` → NO marcar como faltante
- Esto evita que el sistema pida hora cuando ya fue asignada automáticamente

---

## ✅ Flujo Correcto Ahora

```
1. OCR extrae datos → hora_transaccion vacía
2. OCR marca faltan_datos = true (por otros campos o por hora)
3. extractCentavos() asigna hora 12:00:00 + flag = true
4. identifyMissingFields() ejecuta:
   - Detecta flag hora_asignada_automaticamente = true
   - NO marca hora_transaccion como faltante
   - Retorna solo campos realmente faltantes (ej: solo referencia si falta)
5. Si no hay más campos faltantes → Muestra confirmación ✅
6. Si hay otros campos → Pide solo esos campos ✅
```

---

## 🧪 Test Agregado

**Archivo:** `src/features/vouchers/infrastructure/ocr/voucher-processor.service.spec.ts`

**Líneas:** 656-689

**Test:** "NO debe pedir hora manualmente cuando se asigna automáticamente"

**Validaciones:**
- ✅ `hora_transaccion` = "12:00:00"
- ✅ `hora_asignada_automaticamente` = true
- ✅ `faltan_datos` = false o undefined
- ✅ Mensaje contiene "¿Los datos son correctos?"
- ✅ Mensaje NO contiene "No pude extraer" o "Por favor proporciona"

---

## 📊 Casos Cubiertos

| Escenario | Hora OCR | Centavos | Flag Automática | Missing Fields | Resultado |
|-----------|----------|----------|-----------------|----------------|-----------|
| **Caso 1** | Vacía | 25 | ✅ true | [] (vacío) | ✅ Confirmación directa |
| **Caso 2** | Vacía | 0 | ❌ false | ['hora_transaccion'] | ⚠️ Pide hora al usuario |
| **Caso 3** | "14:30" | 25 | ❌ undefined | [] (vacío) | ✅ Confirmación directa |
| **Caso 4 (FIX)** | Vacía | 25 | ✅ true | ['referencia'] | ✅ Pide solo referencia |

**Caso 4 explicado:**
- Antes del fix: missingFields = undefined o ['hora_transaccion'] → BUG
- Después del fix: missingFields = ['referencia'] → Correcto ✅

---

## 🔍 Debugging

Si el problema reaparece, revisar:

### **1. Logs del Sistema**

```bash
# Verificar si hora se asigna automáticamente
grep "Hora asignada automáticamente" logs/app.log

# Verificar campos faltantes identificados
grep "missingFields" logs/app.log
```

### **2. Estado del Voucher**

```typescript
console.log('VoucherData:', {
  hora_transaccion: voucherData.hora_transaccion,
  hora_asignada_automaticamente: voucherData.hora_asignada_automaticamente,
  casa: voucherData.casa,
  missingFields: VoucherValidator.identifyMissingFields(voucherData)
});
```

**Output esperado:**
```javascript
{
  hora_transaccion: "12:00:00",
  hora_asignada_automaticamente: true,
  casa: 25,
  missingFields: [] // Sin campos faltantes
}
```

### **3. Verificar Flujo en BD**

```sql
-- Ver vouchers con hora 12:00:00
SELECT
  id,
  amount,
  date,
  EXTRACT(HOUR FROM date) as hour,
  EXTRACT(MINUTE FROM date) as minute,
  created_at
FROM vouchers
WHERE date::time = '12:00:00'
ORDER BY created_at DESC
LIMIT 10;
```

---

## 📝 Mensaje de Usuario Antes del Fix

**Incorrecto:**
```
No pude extraer los siguientes datos del comprobante que enviaste.
Por favor indícame los valores correctos para los siguientes conceptos:

undefined
```

**O:**
```
Ya tengo todos los datos. Procesando...
[Pero no procesa nada y se queda trabado]
```

---

## ✅ Mensaje de Usuario Después del Fix

**Correcto:**
```
Voy a registrar tu pago con el estatus "pendiente verificación en banco" con los siguientes datos que he encontrado en el comprobante:
💰 Monto: *$1500.25*
📅 Fecha: *15/01/2025*
🏠 Casa: *25*
🔢 Referencia: *ABC123*
⏰ Hora: *12:00:00* ⚠️

⚠️ *Nota:* No se pudo extraer la hora de la transacción del comprobante.
Se asignó 12:00 hrs por defecto. Tu pago se conciliará usando los centavos (casa 25).

Si deseas especificar la hora exacta, selecciona "❌ No. Editar datos ✏️".

¿Los datos son correctos?
```

---

## 🚀 Verificación del Fix

### **Test Manual:**

1. Enviar comprobante con:
   - Monto visible: $1500.25
   - Hora NO visible
   - Fecha visible: 15/01/2025

2. **Resultado esperado:**
   - Sistema asigna hora 12:00:00
   - Muestra mensaje de confirmación con nota
   - NO pide hora manualmente
   - Permite confirmar o editar

### **Test Automatizado:**

```bash
npm test voucher-processor.service.spec.ts -- -t "NO debe pedir hora manualmente"
```

**Output esperado:**
```
✓ NO debe pedir hora manualmente cuando se asigna automáticamente (XXms)
```

---

## 📚 Archivos Modificados

1. **`src/features/vouchers/domain/voucher-validator.ts`** (Líneas 36-40)
   - Ajuste en `identifyMissingFields()` para ignorar hora automática

2. **`src/features/vouchers/infrastructure/ocr/voucher-processor.service.spec.ts`** (Líneas 656-689)
   - Nuevo test para validar fix

---

## 🔗 Referencias

- **Feature Original:** `docs/features/vouchers/HORA-AUTOMATICA-IMPLEMENTACION.md`
- **Resumen:** `docs/features/vouchers/HORA-AUTOMATICA-RESUMEN.md`
- **Issue Reportado:** Usuario en pruebas (Octubre 23, 2025)

---

**✅ Bug Fixed and Tested**
**Fecha de Fix:** Octubre 23, 2025
**Probado en:** Build exitoso + Test unitario
