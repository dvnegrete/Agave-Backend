# Transactions Bank Feature

## Overview

El módulo de transacciones bancarias permite procesar archivos de extractos bancarios de múltiples formatos y bancos, aplicando validaciones automáticas y detección de duplicados a nivel de base de datos.

## Architecture

### Clean Architecture Pattern

```
src/features/transactions-bank/
├── controllers/           # HTTP endpoints y validación de entrada
├── services/             # Lógica de negocio principal
├── dto/                  # Data Transfer Objects
├── interfaces/           # Contratos e interfaces TypeScript
├── models/               # Modelos específicos por banco (Strategy Pattern)
└── validators/           # Validaciones de transacciones
```

### Key Components

#### 1. Controllers
- `TransactionsBankController`: Endpoints REST para subir archivos y consultar transacciones

#### 2. Services
- `TransactionsBankService`: Orquesta el procesamiento completo
- `FileProcessorService`: Maneja múltiples formatos de archivo
- `TransactionValidatorService`: Aplica reglas de validación

#### 3. Models (Strategy Pattern)
- `SantanderXlsxModel`: Procesamiento específico para Santander Excel
- Extensible para otros bancos y formatos

## Supported Formats

### File Types
- **XLSX**: Excel files (Microsoft Excel)
- **CSV**: Comma-separated values
- **JSON**: JavaScript Object Notation
- **TXT**: Plain text files

### Supported Banks
- **Santander**: Formato XLSX específico
- **Extensible**: Patrón Strategy permite agregar nuevos bancos

## Core Features

### 1. File Processing
```typescript
POST /transactions-bank/upload
```

**Capabilities:**
- Multi-format file parsing
- Bank-specific data extraction
- Automatic data type conversion
- Error handling and validation

### 2. Duplicate Detection (Database Level)
- **Automatic**: Trigger SQL detecta y omite duplicados
- **Rules**: Based on date, time, concept, amount, bank_name
- **Silent**: Duplicados ignorados sin errores
- **Performance**: No impact on backend processing

### 3. Transaction Validation
- **Data Types**: Validación de tipos y formatos
- **Business Rules**: Montos, fechas, conceptos requeridos
- **Error Reporting**: Errores detallados por línea

### 4. Reference Tracking
- **Last Transaction**: Sistema de referencia para procesamiento incremental
- **Bank Separation**: Referencias independientes por banco
- **Date Validation**: Solo procesa transacciones posteriores a la última

## API Endpoints

### Upload File
```http
POST /transactions-bank/upload
Content-Type: multipart/form-data

{
  "file": [archivo],
  "bank": "santander",
  "validateOnly": false
}
```

**Response:**
```json
{
  "success": true,
  "totalTransactions": 100,
  "validTransactions": 95,
  "invalidTransactions": 3,
  "previouslyProcessedTransactions": 2,
  "processingTime": 1250,
  "errors": ["Línea 15: Monto inválido"],
  "bankName": "Santander",
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-01-31"
  }
}
```

### Get All Transactions
```http
GET /transactions-bank
```

### Get Transaction by ID
```http
GET /transactions-bank/:id
```

### Get Transactions by Status
```http
GET /transactions-bank/status/:status
```

### Get Transactions by Date Range
```http
GET /transactions-bank/date-range?start=2024-01-01&end=2024-01-31
```

## Business Logic

### Processing Flow

1. **File Upload & Validation**
   - Verificar formato de archivo
   - Validar tamaño y tipo MIME

2. **Bank Detection & Strategy Selection**
   - Determinar banco desde parámetros o contenido
   - Seleccionar modelo de procesamiento específico

3. **Data Extraction**
   - Parsear archivo según formato
   - Aplicar transformaciones específicas del banco
   - Normalizar datos a formato estándar

4. **Transaction Validation**
   - Validar tipos de datos
   - Verificar campos requeridos
   - Aplicar reglas de negocio

5. **Duplicate Detection (Database)**
   - Trigger SQL automático
   - Comparación contra transacciones existentes
   - Omisión silenciosa de duplicados

6. **Database Insertion**
   - Inserción en lote optimizada
   - Actualización de referencia de última transacción
   - Manejo de errores transaccionales

### Duplicate Detection Rules

El trigger SQL `check_transaction_duplicate` aplica estas reglas:

1. **Sin referencia**: Permite todas las transacciones (primer procesamiento)
2. **Banco diferente**: Permite todas las transacciones
3. **Fecha anterior**: Ignora transacciones anteriores al último punto
4. **Fecha posterior**: Permite transacciones nuevas
5. **Misma fecha**: Verifica duplicado exacto por todos los campos

## Data Models

### TransactionBank Interface
```typescript
interface TransactionBank {
  date: Date;
  time: string;
  concept: string;
  amount: number;
  currency: string;
  is_deposit: boolean;
  bank_name: string;
  validation_flag?: boolean;
}
```

### ProcessedBankTransaction
```typescript
interface ProcessedBankTransaction extends TransactionBank {
  id: string;
  status: 'pending' | 'processed' | 'failed' | 'reconciled';
  createdAt: Date;
  updatedAt: Date;
}
```

## Bank-Specific Models

### Santander XLSX
```typescript
class SantanderXlsxModel {
  static parse(file: Buffer): TransactionBank[] {
    // Parseo específico para formato Santander
    // Manejo de columnas específicas
    // Transformación de datos
  }
}
```

**Santander Format Mapping:**
- Column A: Fecha
- Column B: Hora
- Column C: Concepto
- Column D: Monto
- Column E: Tipo (Depósito/Retiro)

## Error Handling

### Validation Errors
```json
{
  "success": false,
  "errors": [
    "Línea 5: Fecha inválida",
    "Línea 12: Monto debe ser numérico",
    "Línea 18: Concepto es requerido"
  ]
}
```

### File Processing Errors
- **Invalid Format**: Formato de archivo no soportado
- **Corrupted File**: Archivo dañado o ilegible
- **Empty File**: Archivo sin contenido válido
- **Size Limit**: Archivo excede límite de tamaño

### Database Errors
- **Connection**: Problemas de conexión a BD
- **Constraint Violation**: Violación de restricciones
- **Trigger Error**: Error en trigger de duplicados

## Performance Optimizations

### Database Level
- **Partial Indexes**: Optimización para consultas frecuentes
- **Batch Inserts**: Inserción en lote para archivos grandes
- **Trigger Optimization**: Detección eficiente de duplicados

### Application Level
- **Streaming**: Procesamiento en streaming para archivos grandes
- **Memory Management**: Liberación de memoria durante procesamiento
- **Connection Pooling**: Reutilización de conexiones de BD

### File Processing
- **Lazy Loading**: Carga progresiva de datos
- **Format Detection**: Detección rápida de formato
- **Early Validation**: Validación temprana para fallar rápido

## Configuration

### Environment Variables
```env
DATABASE_URL=postgresql://user:pass@host:port/db
MAX_FILE_SIZE=10MB
SUPPORTED_FORMATS=xlsx,csv,json,txt
DEFAULT_CURRENCY=COP
```

### Feature Flags
```typescript
{
  enableDuplicateDetection: true,
  enableBatchProcessing: true,
  maxTransactionsPerFile: 10000,
  enableReferenceTracking: true
}
```

## Testing Strategy

### Unit Tests
- Services: `*.spec.ts` files for each service
- Models: Testing bank-specific parsing logic
- Validators: Rule validation testing

### Integration Tests
- API Endpoints: Full request/response testing
- Database: Trigger and constraint testing
- File Processing: End-to-end file upload testing

### E2E Tests
- Complete workflows from file upload to database storage
- Error scenario testing
- Performance testing with large files

## Monitoring & Logging

### Metrics
- File processing time
- Duplicate detection rate
- Validation error rate
- Database performance

### Logging
```typescript
// Structured logging
logger.info('File processed', {
  fileName,
  totalTransactions,
  validTransactions,
  processingTime,
  bankName
});
```

## Future Enhancements

### Planned Features
1. **Additional Banks**: Bancolombia, BBVA, Davivienda
2. **Advanced Validation**: ML-based anomaly detection
3. **Real-time Processing**: WebSocket updates
4. **Batch Operations**: Multiple file processing
5. **Export Functionality**: Export to various formats

### Scalability Considerations
1. **Microservice Split**: Separate processing service
2. **Queue System**: Async processing with Redis/Bull
3. **File Storage**: S3/GCS for large file handling
4. **Database Sharding**: By bank or date ranges