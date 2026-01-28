# Frontend Voucher Processing API

## Overview

API HTTP stateless para procesamiento de comprobantes (vouchers) desde el frontend. El usuario sube un comprobante, obtiene datos extraídos por OCR, puede editarlos, y luego confirma el registro en la base de datos.

**Flujo:** Upload comprobante → Obtener datos → Editar (opcional) → Confirmar

---

## Endpoints

### 1. Upload Comprobante

Sube una imagen o PDF del comprobante y extrae datos con OCR.

```
POST /vouchers/frontend/upload
Content-Type: multipart/form-data
Authorization: Bearer <token> (opcional)
```

**Request (Form Data):**
- `file` (required): Imagen o PDF del comprobante (max 10MB)
- `language` (optional): Código de idioma - `es` (default), `en`, etc.
- `userId` (optional): ID del usuario (alternativa a header Authorization)

**Response (200 OK):**
```json
{
  "success": true,
  "structuredData": {
    "monto": "150.50",
    "fecha_pago": "2024-12-01",
    "hora_transaccion": "14:30:00",
    "casa": 15,
    "referencia": "AUTH123456",
    "hora_asignada_automaticamente": false
  },
  "validation": {
    "isValid": true,
    "missingFields": [],
    "errors": {},
    "warnings": []
  },
  "gcsFilename": "gs://bucket/vouchers/file-123.png",
  "originalFilename": "receipt.png",
  "suggestions": {
    "casaDetectedFromCentavos": true,
    "autoAssignedTime": false
  }
}
```

**Error Responses:**
- `400 Bad Request` - Archivo inválido o vacío
- `500 Internal Server Error` - Error en OCR o Google Cloud

---

### 2. Confirmar Comprobante

Confirma y registra el comprobante en la base de datos.

```
POST /vouchers/frontend/confirm
Content-Type: application/json
Authorization: Bearer <token> (opcional)
```

**Request Body:**
```json
{
  "gcsFilename": "gs://bucket/vouchers/file-123.png",
  "monto": "150.50",
  "fecha_pago": "2024-12-01",
  "hora_transaccion": "14:30:00",
  "casa": 15,
  "referencia": "AUTH123456",
  "userId": "user123" (opcional)
}
```

**Request Validations:**
- `gcsFilename`: String no vacío ✓
- `monto`: Número positivo ✓
- `fecha_pago`: Formato YYYY-MM-DD ✓
- `hora_transaccion`: Formato HH:MM:SS (default: 12:00:00)
- `casa`: Entero entre 1 y 66 ✓
- `referencia`: String opcional
- `userId`: String opcional

**Response (200 OK):**
```json
{
  "success": true,
  "confirmationCode": "202412-ABC123XYZ",
  "voucher": {
    "id": 1,
    "amount": 150.50,
    "date": "2024-12-01T14:30:00.000Z",
    "casa": 15,
    "referencia": "AUTH123456",
    "confirmation_status": false
  }
}
```

**Error Responses:**
- `400 Bad Request` - Datos inválidos o incompletos
- `409 Conflict` - Voucher duplicado (mismo monto, fecha, casa)
- `500 Internal Server Error` - Error en transacción

---

## Authentication

La autenticación es **opcional**. Prioridad de extracción de userId:

1. JWT Token en header `Authorization: Bearer <token>`
2. Query parameter: `?userId=user123`
3. Campo en request body: `{ userId: "user123" }`
4. Anónimo (sin userId)

```typescript
// Ejemplos:
// Con token JWT
Authorization: Bearer eyJhbGc...

// Con query param
POST /vouchers/frontend/upload?userId=user123

// Con body
POST /vouchers/frontend/confirm
{ "gcsFilename": "...", "userId": "user123", ... }

// Anónimo (sin userId)
POST /vouchers/frontend/upload
{ "language": "es" }
```

---

## React Implementation

### Setup

```typescript
// api/vouchers.ts
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';

interface VoucherUploadResponse {
  success: boolean;
  structuredData: {
    monto: string;
    fecha_pago: string;
    hora_transaccion?: string;
    casa?: number;
    referencia?: string;
  };
  validation: {
    isValid: boolean;
    missingFields: string[];
    errors: Record<string, string>;
    warnings?: string[];
  };
  gcsFilename?: string;
  originalFilename: string;
}

interface VoucherConfirmRequest {
  gcsFilename: string;
  monto: string;
  fecha_pago: string;
  hora_transaccion?: string;
  casa: number;
  referencia?: string;
  userId?: string | null;
}

interface VoucherConfirmResponse {
  success: boolean;
  confirmationCode: string;
  voucher: {
    id: number;
    amount: number;
    date: string;
    casa: number;
    referencia: string;
    confirmation_status: boolean;
  };
}

// Upload comprobante
export async function uploadVoucher(
  file: File,
  language: string = 'es',
  userId?: string | null,
  token?: string,
): Promise<VoucherUploadResponse> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('language', language);
  if (userId) {
    formData.append('userId', userId);
  }

  const headers: Record<string, string> = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/vouchers/frontend/upload`, {
    method: 'POST',
    headers,
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al procesar comprobante');
  }

  return response.json();
}

// Confirmar comprobante
export async function confirmVoucher(
  data: VoucherConfirmRequest,
  token?: string,
): Promise<VoucherConfirmResponse> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/vouchers/frontend/confirm`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Error al confirmar comprobante');
  }

  return response.json();
}
```

### Component Example

```typescript
// components/VoucherUploadForm.tsx
import React, { useState } from 'react';
import { uploadVoucher, confirmVoucher } from '../api/vouchers';

interface ExtractedData {
  monto: string;
  fecha_pago: string;
  hora_transaccion?: string;
  casa?: number;
  referencia?: string;
}

export function VoucherUploadForm() {
  const [step, setStep] = useState<'upload' | 'review' | 'confirmed'>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [gcsFilename, setGcsFilename] = useState<string>('');
  const [validation, setValidation] = useState<any>(null);
  const [confirmationCode, setConfirmationCode] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setLoading(true);
    setError('');

    try {
      const result = await uploadVoucher(selectedFile, 'es');

      if (result.validation.isValid) {
        setExtractedData(result.structuredData);
        setGcsFilename(result.gcsFilename || '');
        setValidation(result.validation);
        setStep('review');
      } else {
        setError(`Campos faltantes: ${result.validation.missingFields.join(', ')}`);
        setValidation(result.validation);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar imagen');
    } finally {
      setLoading(false);
    }
  };

  const handleDataChange = (field: keyof ExtractedData, value: string | number) => {
    setExtractedData(prev => ({
      ...prev!,
      [field]: value,
    }));
  };

  const handleConfirm = async () => {
    if (!extractedData || !gcsFilename) return;

    setLoading(true);
    setError('');

    try {
      const confirmData = {
        gcsFilename,
        monto: extractedData.monto,
        fecha_pago: extractedData.fecha_pago,
        hora_transaccion: extractedData.hora_transaccion || '12:00:00',
        casa: extractedData.casa || 0,
        referencia: extractedData.referencia,
        userId: 'user123', // obtener del contexto de autenticación
      };

      const result = await confirmVoucher(confirmData);
      setConfirmationCode(result.confirmationCode);
      setStep('confirmed');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al confirmar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="voucher-form">
      {step === 'upload' && (
        <div>
          <h2>Subir Comprobante</h2>
          <input
            type="file"
            accept="image/*,.pdf"
            onChange={handleFileSelect}
            disabled={loading}
          />
          {loading && <p>Procesando imagen...</p>}
          {error && <p className="error">{error}</p>}
          {validation?.warnings && (
            <ul className="warnings">
              {validation.warnings.map((w: string) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {step === 'review' && extractedData && (
        <div>
          <h2>Revisar Datos Extraídos</h2>
          <form>
            <input
              label="Monto"
              value={extractedData.monto}
              onChange={e => handleDataChange('monto', e.target.value)}
            />
            <input
              label="Fecha"
              type="date"
              value={extractedData.fecha_pago}
              onChange={e => handleDataChange('fecha_pago', e.target.value)}
            />
            <input
              label="Hora"
              type="time"
              value={extractedData.hora_transaccion}
              onChange={e => handleDataChange('hora_transaccion', e.target.value)}
            />
            <input
              label="Casa"
              type="number"
              min="1"
              max="66"
              value={extractedData.casa}
              onChange={e => handleDataChange('casa', parseInt(e.target.value))}
            />
            <input
              label="Referencia"
              value={extractedData.referencia || ''}
              onChange={e => handleDataChange('referencia', e.target.value)}
            />
          </form>
          {validation?.errors && Object.keys(validation.errors).length > 0 && (
            <div className="errors">
              {Object.entries(validation.errors).map(([field, message]) => (
                <p key={field}>{field}: {message}</p>
              ))}
            </div>
          )}
          <button onClick={handleConfirm} disabled={loading}>
            {loading ? 'Confirmando...' : 'Confirmar'}
          </button>
          <button onClick={() => setStep('upload')}>Cancelar</button>
          {error && <p className="error">{error}</p>}
        </div>
      )}

      {step === 'confirmed' && (
        <div>
          <h2>✅ Comprobante Registrado</h2>
          <p>Código de confirmación: <strong>{confirmationCode}</strong></p>
          <p>Guarda este código para futuras referencias</p>
          <button onClick={() => setStep('upload')}>Subir Otro</button>
        </div>
      )}
    </div>
  );
}
```

---

## Error Handling

### Validation Errors

```json
{
  "statusCode": 400,
  "message": "Validation failed",
  "validation": {
    "isValid": false,
    "missingFields": ["casa", "hora_transaccion"],
    "errors": {
      "monto": "Monto inválido",
      "casa": "Número de casa debe estar entre 1 y 66"
    }
  }
}
```

### Duplicate Voucher

```json
{
  "statusCode": 409,
  "message": "Ya existe un voucher registrado con estos datos. Detectado el 2024-12-01 14:30:00"
}
```

---

## Common Issues

### El OCR no extrae la casa correctamente
- Los últimos 2 dígitos del monto se usan como número de casa (centavos)
- Ejemplo: monto `150.15` → casa `15`
- El frontend puede verificar `suggestions.casaDetectedFromCentavos`

### La hora es opcional
- Si no se proporciona, se asigna automáticamente `12:00:00`
- La API retorna `suggestions.autoAssignedTime: true` si ocurrió esto

### Archivos muy grandes
- Máximo 10MB por archivo
- Soporta: JPG, PNG, PDF

### Errores de transacción
- Si hay error creando relaciones User/House, se hace rollback automático
- El voucher NO se crea si falla algún paso

---

## Integration Checklist

- [ ] Importar funciones de API en componente
- [ ] Crear formulario con input file
- [ ] Manejar respuesta de upload y mostrar datos extraídos
- [ ] Permitir edición de datos
- [ ] Validar antes de confirmar
- [ ] Mostrar código de confirmación
- [ ] Implementar manejo de errores
- [ ] Implementar loading states
- [ ] Pasar token JWT si está disponible
- [ ] Pasar userId si usuario está autenticado

---

## Testing

```bash
# Test upload con curl
curl -F "file=@receipt.png" \
     -H "Authorization: Bearer TOKEN" \
     http://localhost:3000/vouchers/frontend/upload

# Test confirm con curl
curl -X POST http://localhost:3000/vouchers/frontend/confirm \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer TOKEN" \
     -d '{
       "gcsFilename":"gs://...",
       "monto":"150.50",
       "fecha_pago":"2024-12-01",
       "hora_transaccion":"14:30:00",
       "casa":15,
       "referencia":"AUTH123",
       "userId":"user123"
     }'
```

---

## Support

Para reportar problemas o sugerencias sobre esta API, contactar al equipo de backend.
