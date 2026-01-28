# Historical Records - Frontend Integration Guide

## Overview

El módulo **Historical Records** permite cargar archivos Excel con registros históricos contables pre-procesados. Cada fila del Excel contiene una distribución ya calculada de pagos entre múltiples conceptos contables (mantenimiento, agua, penalizaciones, cuota extraordinaria).

## Endpoint

```
POST /historical-records/upload
Content-Type: multipart/form-data
Authorization: Bearer <JWT_TOKEN>
```

**Requerimientos:**
- ✅ Autenticado (JWT token requerido)
- ✅ Usuario con permisos (TODO: AdminGuard cuando esté disponible)

---

## Request Format

### Multipart Form Data

```javascript
{
  file: File,              // Archivo Excel .xlsx (requerido)
  description?: string,    // Descripción opcional del archivo
  validateOnly?: boolean   // Default: false. Si true, solo valida sin insertar en BD
}
```

### Ejemplo con JavaScript/React

```typescript
const uploadHistoricalRecords = async (
  excelFile: File,
  options?: { description?: string; validateOnly?: boolean }
) => {
  const formData = new FormData();
  formData.append('file', excelFile);

  if (options?.description) {
    formData.append('description', options.description);
  }

  if (options?.validateOnly) {
    formData.append('validateOnly', 'true');
  }

  const response = await fetch('/historical-records/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${jwtToken}`,
      // NO incluir Content-Type: multipart/form-data
      // El navegador lo agrega automáticamente
    },
    body: formData,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }

  return await response.json();
};
```

### Ejemplo con Axios

```typescript
import axios from 'axios';

const uploadHistoricalRecords = async (
  excelFile: File,
  jwtToken: string,
  options?: { description?: string; validateOnly?: boolean }
) => {
  const formData = new FormData();
  formData.append('file', excelFile);

  if (options?.description) {
    formData.append('description', options.description);
  }

  if (options?.validateOnly) {
    formData.append('validateOnly', String(options.validateOnly));
  }

  try {
    const response = await axios.post(
      '/historical-records/upload',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
          'Content-Type': 'multipart/form-data',
        },
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error('Upload failed:', error.response?.data?.message);
      throw error;
    }
    throw error;
  }
};
```

### Ejemplo con React Hook

```typescript
import { useState } from 'react';

export const useHistoricalRecordsUpload = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (
    file: File,
    jwtToken: string,
    validateOnly = false
  ) => {
    setLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('validateOnly', String(validateOnly));

      const response = await fetch('/historical-records/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${jwtToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Upload failed');
      }

      return await response.json();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { upload, loading, error };
};
```

---

## Response Format

### Success (HTTP 200)

```json
{
  "total_rows": 100,
  "successful": 95,
  "failed": 5,
  "success_rate": 95.0,
  "errors": [
    {
      "row_number": 15,
      "error_type": "validation",
      "message": "Amount mismatch - floor(1542.42) != 1500"
    },
    {
      "row_number": 23,
      "error_type": "database",
      "message": "Casa 99 no existe en el sistema",
      "details": {
        "concepto": "Pago mensual",
        "deposito": 1500.99,
        "casa": 0
      }
    }
  ],
  "created_record_ids": [1, 2, 3, 4, 5, ...]
}
```

### Error (HTTP 400)

```json
{
  "statusCode": 400,
  "message": "Error al procesar el archivo de registros históricos",
  "error": "Bad Request"
}
```

### Response Interface (TypeScript)

```typescript
interface HistoricalRecordResponseDto {
  total_rows: number;           // Total de filas procesadas
  successful: number;           // Filas exitosas
  failed: number;               // Filas fallidas
  success_rate: number;         // Porcentaje de éxito (0-100)
  errors: RowErrorDto[];        // Detalles de errores
  created_record_ids: number[]; // IDs de Records creados
}

interface RowErrorDto {
  row_number: number;           // Número de fila (1-indexed)
  error_type: 'validation' | 'database' | 'business_rule';
  message: string;              // Descripción del error
  details?: Record<string, any>; // Datos adicionales (opcional)
}
```

---

## Excel File Format

### Estructura Requerida

El archivo Excel debe tener las siguientes columnas en CUALQUIER orden:

| Columna | Tipo | Requerido | Descripción |
|---------|------|-----------|-------------|
| FECHA | Date | ✅ | Fecha del registro (ISO, DD/MM/YYYY o Excel serial) |
| HORA | Time | ✅ | Hora del registro (HH:MM:SS o HH:MM) |
| CONCEPTO | String | ✅ | Descripción/concepto del registro |
| DEPOSITO | Number | ✅ | Monto total del depósito |
| Casa | Number | ⚠️ | Número de casa (0 = no identificada) |
| Cuota Extra | Number | ⚠️ | Monto para cta_extraordinary_fee |
| Mantto | Number | ⚠️ | Monto para cta_maintenance |
| Penalizacion | Number | ⚠️ | Monto para cta_penalties |
| Agua | Number | ⚠️ | Monto para cta_water |

**Notas:**
- Al menos una columna cta_* (Cuota Extra, Mantto, Penalizacion, Agua) debe tener monto > 0
- `floor(DEPOSITO)` debe coincidir con la suma de montos cta_*
- Los centavos de DEPOSITO se usan para identificar casa si Casa = 0

### Ejemplo de Archivo Excel

```
FECHA      | HORA     | CONCEPTO           | DEPOSITO | Casa | Cuota Extra | Mantto | Penalizacion | Agua
-----------|----------|-------------------|----------|------|-------------|--------|--------------|-----
2023-01-15 | 10:30:00 | Pago mensual      | 1542.42  | 0    | 500         | 800    | 0            | 242
2023-01-16 | 14:20:00 | Pago casa 5       | 1500.00  | 5    | 500         | 800    | 0            | 200
2023-01-20 | 09:15:00 | Pago con multa    | 1700.00  | 12   | 500         | 800    | 200          | 200
2023-02-01 | 11:00:00 | No identificado   | 1000.15  | 0    | 0           | 800    | 0            | 200
```

**Interpretación:**
- Fila 1: Casa identificada por centavos (0.42 → Casa 42)
- Fila 2: Casa explícitamente especificada (Casa 5)
- Fila 3: Tiene penalizaciones/multas
- Fila 4: Casa no identificada (0), centavos = 0.15 → Casa 15

---

## Modo Dry-Run (Validación sin Inserción)

Para validar un archivo sin insertar datos en la base de datos, usa `validateOnly: true`:

```typescript
const result = await uploadHistoricalRecords(excelFile, {
  description: 'Testing file format',
  validateOnly: true
});

// result.successful contendrá 0 (no se inserta nada)
// result.errors contendrá todos los errores encontrados
```

**Use cases:**
- Verificar que el archivo Excel está bien formateado
- Pre-validar antes de hacer la carga real
- Testing y debugging

---

## Validaciones y Reglas de Negocio

### Validaciones a Nivel de Fila

Cada fila es validada contra estas reglas:

1. **FECHA válida** - Debe ser una fecha válida
2. **CONCEPTO no vacío** - Descripción requerida
3. **DEPOSITO > 0** - Monto debe ser positivo
4. **Casa >= 0** - Número de casa no puede ser negativo
5. **Sum(cta_*) == floor(DEPOSITO)** - Distribución debe cuadrar
6. **Al menos un cta_* > 0** - Debe haber al menos una asignación

### Identificación de Casa

- Si `Casa > 0`: usa ese número
- Si `Casa = 0`: extrae de centavos del DEPOSITO
  - `$1542.42` → Casa 42
  - `$1000.15` → Casa 15
  - `$500.00` → Casa 0 (sin identificar, no crea HouseRecord)

### Validaciones a Nivel de Base de Datos

- **Casa debe existir** - Si la casa se identifica, debe estar registrada en el sistema
- **Period se crea automáticamente** - Basado en fecha del registro
- **Transacción atómica por fila** - Si una fila falla, se revierte (sin afectar otras)

---

## Manejo de Errores

### Error Type: validation

Errores de formato o reglas de negocio:

```json
{
  "row_number": 15,
  "error_type": "validation",
  "message": "Amount mismatch - floor(1542.42) != 1500"
}
```

**Acciones recomendadas:**
- Mostrar número de fila exacto
- Editar el Excel y re-subir

### Error Type: database

Errores de base de datos (casa no existe, transacción fallida):

```json
{
  "row_number": 23,
  "error_type": "database",
  "message": "Casa 99 no existe en el sistema",
  "details": {
    "concepto": "Pago mensual",
    "deposito": 1500.99,
    "casa": 0
  }
}
```

**Acciones recomendadas:**
- Verificar que la casa está registrada en el sistema
- Contactar con admin si la casa debería existir

### Error Type: business_rule

Violación de reglas de negocio específicas:

```json
{
  "row_number": 10,
  "error_type": "business_rule",
  "message": "At least one cta_* amount must be > 0"
}
```

---

## Success Response Handling

### Ejemplo completo

```typescript
const handleUpload = async (file: File, jwtToken: string) => {
  try {
    const response = await uploadHistoricalRecords(file, {
      description: 'Monthly historical records',
      validateOnly: false
    });

    console.log(`✅ Carga completada:`);
    console.log(`   Total: ${response.total_rows} filas`);
    console.log(`   Exitosas: ${response.successful}`);
    console.log(`   Fallidas: ${response.failed}`);
    console.log(`   Tasa de éxito: ${response.success_rate}%`);

    if (response.errors.length > 0) {
      console.warn(`⚠️ Errores encontrados:`);
      response.errors.forEach(err => {
        console.warn(
          `   Fila ${err.row_number}: ${err.error_type} - ${err.message}`
        );
      });
    }

    // IDs de records creados
    console.log(`📊 Records creados:`, response.created_record_ids);

    // Actualizar UI
    setUploadStats({
      total: response.total_rows,
      successful: response.successful,
      failed: response.failed,
      successRate: response.success_rate
    });

    if (response.errors.length > 0) {
      showErrorSummary(response.errors);
    }

  } catch (error) {
    console.error('❌ Upload failed:', error);
    showErrorNotification(
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
};
```

---

## UI Components (Recommended)

### File Upload Component

```typescript
const HistoricalRecordsUpload = ({ onSuccess }: Props) => {
  const [file, setFile] = useState<File | null>(null);
  const [validateOnly, setValidateOnly] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HistoricalRecordResponseDto | null>(null);
  const { jwtToken } = useAuth();

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    try {
      const response = await uploadHistoricalRecords(file, {
        validateOnly,
      });

      setResult(response);
      onSuccess?.();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="historical-records-upload">
      <input
        type="file"
        accept=".xlsx"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        disabled={loading}
      />

      <label>
        <input
          type="checkbox"
          checked={validateOnly}
          onChange={(e) => setValidateOnly(e.target.checked)}
          disabled={loading}
        />
        Solo validar (sin insertar)
      </label>

      <button
        onClick={handleUpload}
        disabled={!file || loading}
      >
        {loading ? 'Cargando...' : 'Subir'}
      </button>

      {result && (
        <div className="upload-results">
          <h3>Resultados</h3>
          <p>Total: {result.total_rows}</p>
          <p>Exitosas: {result.successful}</p>
          <p>Fallidas: {result.failed}</p>
          <p>Tasa: {result.success_rate}%</p>

          {result.errors.length > 0 && (
            <div className="errors">
              <h4>Errores</h4>
              {result.errors.map((err, i) => (
                <div key={i} className={`error-${err.error_type}`}>
                  Fila {err.row_number}: {err.message}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
```

---

## Limits & Constraints

| Parámetro | Valor | Notas |
|-----------|-------|-------|
| Tamaño máximo de archivo | 10 MB | Validado por servidor |
| Tipo de archivo | .xlsx | Solo Excel 2007+ |
| Máximo de filas | Sin límite teórico | Performance: <1000 recomendado |
| Formato de fecha | Múltiples | ISO, DD/MM/YYYY, Excel serial |

---

## Testing

### Test Case: Successful Upload

```typescript
describe('HistoricalRecords Upload', () => {
  it('should upload valid Excel file', async () => {
    const file = new File(
      [/* valid Excel buffer */],
      'records.xlsx',
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    );

    const result = await uploadHistoricalRecords(file);

    expect(result.total_rows).toBeGreaterThan(0);
    expect(result.successful).toBeGreaterThan(0);
    expect(result.created_record_ids.length).toBe(result.successful);
  });
});
```

### Test Case: Validation Errors

```typescript
it('should return validation errors', async () => {
  const file = new File(
    [/* invalid Excel: missing CONCEPTO */],
    'invalid.xlsx'
  );

  const result = await uploadHistoricalRecords(file);

  expect(result.failed).toBeGreaterThan(0);
  expect(result.errors.some(e => e.error_type === 'validation')).toBe(true);
});
```

---

## Troubleshooting

### "El archivo no debe superar 10MB"

- Verificar tamaño del archivo
- Dividir en múltiples cargas si es necesario

### "Solo se permiten archivos Excel (.xlsx)"

- Asegurar que el archivo es .xlsx (no .xls, .csv, etc)
- Exportar desde Excel con formato correcto

### "FECHA inválida"

Soporta estos formatos:
- `2023-01-15` (ISO)
- `15/01/2023` (DD/MM/YYYY)
- `15/01` (DD/MM, año actual)
- Excel serial dates

### "Amount mismatch"

- `floor(DEPOSITO)` debe coincidir con suma de cta_*
- Revisar que los montos estén correctos
- Verificar decimales

### "Casa X no existe en el sistema"

- Crear la casa primero en Houses Management
- O usar Casa = 0 (identificación por centavos)

---

## Debugging

### Enable Logging (Frontend)

```typescript
const uploadWithDebug = async (file: File, jwtToken: string) => {
  console.log('📤 Uploading:', {
    fileName: file.name,
    fileSize: file.size,
    fileType: file.type,
  });

  const formData = new FormData();
  formData.append('file', file);
  formData.append('validateOnly', 'false');

  const response = await fetch('/historical-records/upload', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${jwtToken}` },
    body: formData,
  });

  console.log('📥 Response:', {
    status: response.status,
    statusText: response.statusText,
  });

  const data = await response.json();
  console.log('📊 Result:', data);

  return data;
};
```

---

## Related Features

- **Payment Management**: Períodos y configuración se crean automáticamente
- **Bank Reconciliation**: Registros creados pueden ser parte de reconciliación
- **Houses Management**: Las casas deben estar registradas en el sistema

---

## Support & Questions

Para preguntas sobre la integración:
1. Revisar esta documentación
2. Consultar logs del servidor
3. Verificar archivo Excel con ejemplo proporcionado
4. Contactar al equipo de backend
