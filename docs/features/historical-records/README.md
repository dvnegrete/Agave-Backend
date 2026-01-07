# Historical Records Module

## Quick Summary

Módulo para **cargar registros contables históricos desde archivos Excel** con distribución pre-calculada entre múltiples cuentas (mantenimiento, agua, penalizaciones, cuota extraordinaria).

**Use Case:** Importar datos históricos de años anteriores, auditorías, o migraciones de otros sistemas.

---

## Key Features

✅ **Excel Upload** - Soporta .xlsx con múltiples formatos de fecha
✅ **Atomic Transactions** - Cada fila procesada en su propia transacción
✅ **Smart Identification** - Extrae número de casa de centavos del depósito ($1542.42 → Casa 42)
✅ **Automatic Period Creation** - Períodos se crean automáticamente
✅ **Validation First** - Todas las filas se validan antes de cualquier inserción
✅ **Dry-Run Mode** - Validar sin insertar con `validateOnly=true`
✅ **Detailed Errors** - Reportes granulares por fila
✅ **Clean Architecture** - Separación clear: domain, application, infrastructure

---

## Quick Start

### For Frontend Developers

**Upload an Excel file:**

```typescript
const formData = new FormData();
formData.append('file', excelFile);
formData.append('validateOnly', 'false');

const response = await fetch('/historical-records/upload', {
  method: 'POST',
  headers: { 'Authorization': `Bearer ${token}` },
  body: formData,
});

const result = await response.json();
console.log(`Success: ${result.successful}/${result.total_rows}`);
console.log(`Errors: ${result.errors.length}`);
console.log(`Created IDs: ${result.created_record_ids}`);
```

📖 Full guide: [FRONTEND-INTEGRATION.md](./FRONTEND-INTEGRATION.md)

### For Backend Developers

**Module Structure:**

```
src/features/historical-records/
├── domain/              # Business logic
├── application/         # Use cases
├── infrastructure/      # Parsers, processors
├── controllers/         # HTTP interface
├── dto/                 # Data transfer objects
└── validators/          # File validators
```

📖 Full guide: [BACKEND-IMPLEMENTATION.md](./BACKEND-IMPLEMENTATION.md)

---

## Excel Format

### Required Columns

| Column | Type | Required | Notes |
|--------|------|----------|-------|
| FECHA | Date | ✅ | ISO, DD/MM/YYYY, or DD/MM format |
| HORA | Time | ✅ | HH:MM:SS or HH:MM format |
| CONCEPTO | String | ✅ | Description/concept |
| DEPOSITO | Number | ✅ | Total amount (dollars + cents identify house) |
| Casa | Number | ✅ | House number (0 = use deposit cents) |
| Cuota Extra | Number | ✅ | Amount for extraordinary fee account |
| Mantto | Number | ✅ | Amount for maintenance account |
| Penalizacion | Number | ✅ | Amount for penalties account |
| Agua | Number | ✅ | Amount for water account |

### Business Rules

1. **Amount Distribution**: `floor(DEPOSITO) == sum(cta_*)`
   - **DEPOSITO** can have decimals (cents used for house identification)
   - **cta_*** amounts are **always integers** (decimals are floored/truncated, never rounded)
   - Validation: `floor(DEPOSITO)` must exactly equal `sum(floor(Cuota Extra) + floor(Mantto) + floor(Penalizacion) + floor(Agua))`
   - **Important**: cta_* are floored (truncated), NOT rounded
     - `250.51` → `floor(250.51)` = `250` (NOT 251)
     - `250.49` → `floor(250.49)` = `250`
   - Examples:
     - `DEPOSITO=850.51`, cta_*=[600, 250.51] → floor: [600, 250] → sum=850, floor(850.51)=850 → **OK** ✓
     - `DEPOSITO=850.51`, cta_*=[600, 250.49] → floor: [600, 250] → sum=850, floor(850.51)=850 → **OK** ✓
     - `DEPOSITO=850.49`, cta_*=[600, 250.49] → floor: [600, 250] → sum=850, floor(850.49)=850 → **OK** ✓

2. **House Identification**:
   - If `Casa > 0`: use that number
   - If `Casa = 0`: extract from cents (e.g., $1542.42 → House 42)
   - If `Casa = 0` and cents = 0: unidentified (no HouseRecord created)

3. **Active Accounts**: At least one cta_* must have amount > 0

### Example

```
FECHA      | HORA     | CONCEPTO         | DEPOSITO | Casa | Cuota Extra | Mantto | Penalizacion | Agua
-----------|----------|------------------|----------|------|-------------|--------|--------------|-----
2023-01-15 | 10:30:00 | Monthly payment | 1542.42  | 0    | 500         | 800    | 0            | 242
2023-01-16 | 14:20:00 | Payment H5       | 1500.00  | 5    | 500         | 800    | 0            | 200
2023-01-20 | 09:15:00 | Payment w/ fine  | 1700.00  | 12   | 500         | 800    | 200          | 200
```

---

## API Response

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

### Field Explanation

| Field | Description |
|-------|-------------|
| `total_rows` | Total rows parsed from Excel |
| `successful` | Rows successfully inserted |
| `failed` | Rows that failed validation or DB insertion |
| `success_rate` | Percentage of successful rows (0-100) |
| `errors` | Array of detailed error information |
| `created_record_ids` | IDs of Record entities created in DB |

### Error Types

- **validation** - Row data validation failed (format, amounts, etc)
- **database** - Database operation failed (house doesn't exist, FK violations, etc)
- **business_rule** - Business logic violation (detected at domain level)

---

## Features

### Processing Flow

```
Excel File → Parser → Validate All → If validateOnly: Return
                                    → If insertMode: Process Each Row
                                       ├─ Ensure Period Exists
                                       ├─ Create cta_* records
                                       ├─ Create Record
                                       ├─ Create HouseRecord (if identified)
                                       └─ Commit/Rollback
                                       → Accumulate Results
                                       → Return Statistics
```

### Transaction Handling

Each row is processed in its own **atomic transaction**:
- ✅ **Success**: All operations commit together
- ❌ **Failure**: All operations rollback (no partial data)

This ensures data consistency even if some rows fail.

### Automatic Period Creation

If a Period (year/month) doesn't exist:
- Automatically created with default configuration
- Uses `EnsurePeriodExistsUseCase` from PaymentManagement

### House Validation

If a house is identified:
- Verified to exist in the database
- If not found: row fails with clear error message
- If not identified (Casa=0, cents=0): skipped (no HouseRecord)

---

## Validations

### Row Level

- ✅ FECHA is valid date
- ✅ CONCEPTO is not empty
- ✅ DEPOSITO > 0
- ✅ Casa >= 0
- ✅ floor(DEPOSITO) == sum(cta_*)
- ✅ At least one cta_* > 0

### File Level

- ✅ File format: .xlsx only
- ✅ File size: max 10MB
- ✅ Headers: auto-detected (requires 7+ of 9 expected columns)

### Database Level

- ✅ Casa exists in houses table
- ✅ Period can be created/found
- ✅ FK references are valid
- ✅ No duplicate constraints violated

---

## Dry-Run Mode

Validate without inserting data:

```bash
POST /historical-records/upload?validateOnly=true
```

**Use cases:**
- Test file format before real upload
- Catch errors before database operations
- Preview what will be created

**Response:**
- Same format as regular response
- `created_record_ids` will be empty (no inserts)
- `successful` reflects how many rows would be valid

---

## Error Examples

### Validation Error

```json
{
  "row_number": 15,
  "error_type": "validation",
  "message": "Amount mismatch - floor(1542.42) != 1500"
}
```

**Solution**: Fix Excel amounts and re-upload

### Database Error

```json
{
  "row_number": 23,
  "error_type": "database",
  "message": "Casa 99 no existe en el sistema",
  "details": { "casa": 0 }
}
```

**Solution**: Create the house first or use different house number

### Business Rule Error

```json
{
  "row_number": 10,
  "error_type": "business_rule",
  "message": "At least one cta_* amount must be > 0"
}
```

**Solution**: Add amount to at least one accounting category

---

## Important Notes

⚠️ **Authentication Required**
- All requests must include valid JWT token
- Add `Authorization: Bearer <TOKEN>` header

⚠️ **No Duplicate Checking**
- Module allows uploading duplicate records
- Use `validateOnly` to preview before uploading
- Design allows intentional re-uploads (e.g., corrections)

⚠️ **Transaction Isolation**
- Each row is independent transaction
- One row's failure doesn't affect others
- No bulk insert - ensures consistency over speed

⚠️ **House Identification**
- Must exist in system to create HouseRecord
- If not identified (Casa=0, cents=0): Record created without house link
- Can't change house after Record is created

---

## Integration Points

### PaymentManagement Module
- Uses `EnsurePeriodExistsUseCase` to auto-create periods

### Record Entity
- Creates records with FK references to cta_* tables
- Links to houses via HouseRecord association

### Accounting Tables
- Populates: `cta_maintenance`, `cta_water`, `cta_penalties`, `cta_extraordinary_fee`
- Each record has `period_id` for temporal tracking

---

## Files & Structure

```
src/features/historical-records/
├── application/
│   ├── upload-historical-records.use-case.ts    # Main orchestrator
│   └── index.ts
├── domain/
│   ├── historical-record-row.entity.ts          # Domain entity with validations
│   ├── processing-result.value-object.ts        # Result encapsulation
│   └── index.ts
├── dto/
│   ├── upload-historical-file.dto.ts            # Request DTO
│   ├── historical-record-response.dto.ts        # Response DTO
│   ├── row-error.dto.ts                         # Error details
│   └── index.ts
├── infrastructure/
│   ├── parsers/
│   │   └── historical-excel-parser.service.ts   # Excel parser
│   └── processors/
│       ├── cta-record-creator.service.ts        # Creates cta_* records
│       └── historical-row-processor.service.ts  # Orchestrates per-row processing
├── controllers/
│   └── historical-records.controller.ts         # HTTP endpoint
├── validators/
│   └── historical-file.validator.ts             # File format validation
└── historical-records.module.ts                 # Module configuration
```

---

## Testing

### Unit Tests

```bash
npm run test -- historical-records
```

### Example Test

```typescript
describe('HistoricalRecordRow', () => {
  it('should identify house from deposit cents', () => {
    const row = HistoricalRecordRow.create({
      deposito: 1542.42,
      casa: 0
    });
    expect(row.getIdentifiedHouseNumber()).toBe(42);
  });
});
```

### E2E Test

```bash
npm run test:e2e -- historical-records
```

---

## Troubleshooting

### File Upload Fails

- ✅ Is file format .xlsx?
- ✅ Is file size < 10MB?
- ✅ Are you sending JWT token?
- ✅ Check server logs for detailed error

### Rows Not Inserting

- ✅ Do validation first with `validateOnly=true`
- ✅ Check error messages for specific row numbers
- ✅ Verify house numbers exist in system
- ✅ Verify amount distribution (floor(DEPOSITO) = sum)

### Period Not Creating

- ✅ Check if date is valid
- ✅ Verify PaymentManagement module is imported
- ✅ Check database connection

### House Not Found

- ✅ Create house first via Houses Management endpoint
- ✅ Or use Casa=0 with deposit cents for identification
- ✅ Or use unidentified records (no HouseRecord created)

---

## Documentation

📖 **Frontend Developers**: Read [FRONTEND-INTEGRATION.md](./FRONTEND-INTEGRATION.md)
- API usage examples
- React component examples
- Error handling patterns
- Excel file format details

📖 **Backend Developers**: Read [BACKEND-IMPLEMENTATION.md](./BACKEND-IMPLEMENTATION.md)
- Architecture overview
- Domain layer logic
- Transaction handling
- Testing strategies
- Performance notes

---

## Related Features

- [Payment Management](../payment-management/) - Period and configuration management
- [Bank Reconciliation](../bank-reconciliation/) - Can use created records
- [Houses Management](../houses/) - House registration required

---

## Support

**Questions?**
1. Check the relevant documentation (Frontend or Backend)
2. Review error messages and row numbers
3. Check server logs with DEBUG mode
4. Contact backend team

**Report Issues**
- Provide Excel file (sanitized if contains sensitive data)
- Include response JSON with error details
- Include server logs with DEBUG=* enabled

---

## Version History

**v1.0.0** - Initial release
- Excel parsing with auto-header detection
- Row validation and business logic
- Per-row atomic transactions
- Automatic period creation
- House identification by cents
- Dry-run mode for testing
- Comprehensive error reporting

---

**Last Updated**: January 2025
**Module Status**: ✅ Production Ready
