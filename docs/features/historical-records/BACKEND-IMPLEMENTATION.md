# Historical Records - Backend Implementation Guide

## Architecture Overview

El módulo Historical Records sigue **Clean Architecture** con separación clara de capas:

```
Domain Layer        → Business logic pura (validaciones, extracciones)
Application Layer   → Orquestación de use cases
Infrastructure      → Parseo Excel, acceso a DB, transacciones
Controllers         → HTTP interface, delegación a use cases
```

### Module Location

```
src/features/historical-records/
├── domain/                          # Lógica de negocio pura
│   ├── historical-record-row.entity.ts
│   ├── processing-result.value-object.ts
│   └── index.ts
├── dto/                             # Data Transfer Objects
│   ├── upload-historical-file.dto.ts
│   ├── historical-record-response.dto.ts
│   ├── row-error.dto.ts
│   └── index.ts
├── application/                     # Use cases (orquestación)
│   ├── upload-historical-records.use-case.ts
│   └── index.ts
├── infrastructure/                  # Detalles técnicos
│   ├── parsers/
│   │   └── historical-excel-parser.service.ts
│   └── processors/
│       ├── cta-record-creator.service.ts
│       └── historical-row-processor.service.ts
├── controllers/                     # HTTP interface
│   └── historical-records.controller.ts
├── validators/                      # Validadores de archivos
│   └── historical-file.validator.ts
└── historical-records.module.ts     # Configuración NestJS
```

---

## Domain Layer

### HistoricalRecordRow Entity

Entidad de dominio que representa una fila del Excel con lógica de negocio pura:

```typescript
class HistoricalRecordRow {
  // Propiedades inmutables
  readonly fecha: Date;
  readonly hora: string;
  readonly concepto: string;
  readonly deposito: number;
  readonly casa: number;
  readonly cuotaExtra: number;
  readonly mantto: number;
  readonly penalizacion: number;
  readonly agua: number;
  readonly rowNumber: number;

  // Factory method
  static create(params: {...}): HistoricalRecordRow

  // Business logic
  getIdentifiedHouseNumber(): number
  isValidAmountDistribution(): boolean
  isIdentifiedPayment(): boolean
  getPeriodInfo(): { year: number; month: number }
  getActiveCtaTypes(): Array<{ type: string; amount: number }>
  validate(): { isValid: boolean; errors: string[] }
}
```

**Business Rules Implementadas:**

1. **Identificación por centavos**
   ```typescript
   // $1542.42 → Casa 42
   const cents = Math.round((this.deposito % 1) * 100);
   return cents; // 42
   ```

2. **Validación de distribución de montos**
   ```typescript
   const expectedTotal = Math.floor(this.deposito);
   const actualTotal = sum(cta_*);
   return Math.abs(expectedTotal - actualTotal) < 0.01;
   ```

3. **Identificación de casa**
   ```typescript
   if (this.casa > 0) return this.casa;        // Explícita
   return Math.round((this.deposito % 1) * 100); // Por centavos
   ```

---

## Application Layer

### UploadHistoricalRecordsUseCase

Orquestador del proceso completo:

```typescript
@Injectable()
export class UploadHistoricalRecordsUseCase {
  constructor(
    private readonly excelParser: HistoricalExcelParserService,
    private readonly rowProcessor: HistoricalRowProcessorService,
  ) {}

  async execute(
    buffer: Buffer,
    validateOnly: boolean = false
  ): Promise<ProcessingResult> {
    // 1. Parse Excel
    const rows = await this.excelParser.parseFile(buffer);

    // 2. Validar todas las filas
    const validRows = rows.filter(row => row.validate().isValid);
    const errors = rows
      .filter(row => !row.validate().isValid)
      .map(row => ({ row: row.rowNumber, errors: row.validate().errors }));

    // 3. Si validateOnly, return sin DB operations
    if (validateOnly) {
      return new ProcessingResult(rows.length, validRows.length, errors.length, ...);
    }

    // 4. Procesar filas válidas (cada una en su transacción)
    for (const row of validRows) {
      const result = await this.rowProcessor.processRow(row);
      // Acumular resultados
    }

    // 5. Retornar estadísticas
    return new ProcessingResult(...);
  }
}
```

**Flujo:**
```
Buffer Excel
    ↓
Parse rows (HistoricalRecordRow[])
    ↓
Validate all (dominio, sin DB)
    ↓
If validateOnly: Return results (sin procesamiento)
    ↓
For each valid row:
  - Process (transaction)
  - Accumulate results/errors
    ↓
Return final statistics
```

---

## Infrastructure Layer

### HistoricalExcelParserService

Parsea archivos Excel y convierte a entidades de dominio:

```typescript
@Injectable()
export class HistoricalExcelParserService {
  async parseFile(buffer: Buffer): Promise<HistoricalRecordRow[]> {
    // 1. XLSX.read(buffer) → workbook
    // 2. findHeaderRow() → índice de encabezados
    // 3. Para cada fila válida:
    //    - parseRow() → HistoricalRecordRow
    // 4. Retornar array de entidades
  }

  private findHeaderRow(data: any[][]): number {
    // Auto-detección: busca filas con keywords coincidentes
    // Requiere 7+ de 9 columnas esperadas
  }

  private parseRow(row: any[], headers: string[], rowNumber): HistoricalRecordRow {
    // Map columns by name (case-insensitive)
    // Parse tipos: Date (múltiples formatos), Time, String, Number
    // Crear HistoricalRecordRow.create()
  }

  // Date parsing soporta:
  // - ISO: YYYY-MM-DD
  // - DD/MM/YYYY
  // - DD/MM (año actual)
  // - Excel serial (days since 1900-01-01)
}
```

**Características:**
- ✅ Auto-detección de encabezados (busca en primeras 10 filas)
- ✅ Soporta múltiples formatos de fecha/hora
- ✅ Manejo de filas vacías
- ✅ Row-by-row error handling sin detener el parsing
- ✅ Logging detallado

### CtaRecordCreatorService

Crea registros en tablas cta_* dentro de una transacción:

```typescript
@Injectable()
export class CtaRecordCreatorService {
  constructor(
    private readonly ctaMaintenanceRepository: CtaMaintenanceRepository,
    private readonly ctaWaterRepository: CtaWaterRepository,
    private readonly ctaPenaltiesRepository: CtaPenaltiesRepository,
    private readonly ctaExtraordinaryFeeRepository: CtaExtraordinaryFeeRepository,
  ) {}

  async createCtaRecords(
    row: HistoricalRecordRow,
    periodId: number,
    queryRunner: QueryRunner
  ): Promise<CtaRecordIds> {
    // Para cada cta_* con monto > 0:
    // - Crear registro en tabla correspondiente
    // - Guardar el ID
    // Retornar objeto con IDs

    // Ejemplo:
    // if (row.cuotaExtra > 0) {
    //   const cta = await ctaExtraordinaryFeeRepository.create(
    //     { amount: row.cuotaExtra, period_id: periodId },
    //     queryRunner  // ← Crítico: usar queryRunner para transacción
    //   );
    //   ids.cta_extraordinary_fee_id = cta.id;
    // }

    return ids; // { cta_extraordinary_fee_id?, cta_maintence_id?, ... }
  }
}
```

### HistoricalRowProcessorService

Orquesta el procesamiento completo de una fila con transacción ACID:

```typescript
@Injectable()
export class HistoricalRowProcessorService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly ensurePeriodExistsUseCase: EnsurePeriodExistsUseCase,
    private readonly ctaRecordCreatorService: CtaRecordCreatorService,
    private readonly recordRepository: RecordRepository,
    private readonly houseRecordRepository: HouseRecordRepository,
    private readonly houseRepository: HouseRepository,
  ) {}

  async processRow(row: HistoricalRecordRow): Promise<RowProcessingResult> {
    // 1. Validar (sin DB)
    if (!row.validate().isValid) {
      return { success: false, error: {...} };
    }

    // 2. Crear transacción
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 3. Obtener/crear Period
      const { year, month } = row.getPeriodInfo();
      const period = await this.ensurePeriodExistsUseCase.execute(year, month);

      // 4. Crear registros cta_*
      const ctaIds = await this.ctaRecordCreatorService.createCtaRecords(
        row, period.id, queryRunner
      );

      // 5. Crear Record
      const record = await this.recordRepository.create(
        { ...ctaIds },
        queryRunner
      );

      // 6. Crear HouseRecord si casa identificada
      if (row.isIdentifiedPayment()) {
        const houseNumber = row.getIdentifiedHouseNumber();
        const house = await this.houseRepository.findByNumberHouse(houseNumber);
        if (!house) throw new Error(`Casa ${houseNumber} no existe`);

        await this.houseRecordRepository.create(
          { house_id: house.id, record_id: record.id },
          queryRunner
        );
      }

      // 7. Commit
      await queryRunner.commitTransaction();
      return { success: true, recordId: record.id };

    } catch (error) {
      // 8. Rollback en error
      await queryRunner.rollbackTransaction();
      return { success: false, error: { row_number, error_type: 'database', message } };

    } finally {
      await queryRunner.release();
    }
  }
}
```

**Transacción Workflow:**
```
┌─── Transaction START
├─ 1. Query Period (ACID)
├─ 2. Create cta_* records (ACID)
├─ 3. Create Record (ACID)
├─ 4. Create HouseRecord (ACID)
├─ → Success: COMMIT ✓
└─ → Error: ROLLBACK ✗
```

---

## Controller

### HistoricalRecordsController

HTTP interface para el endpoint:

```typescript
@ApiTags('historical-records')
@Controller('historical-records')
@UseGuards(AuthGuard)
export class HistoricalRecordsController {
  constructor(private readonly uploadHistoricalRecordsUseCase: UploadHistoricalRecordsUseCase) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadHistoricalFile(
    @UploadedFile(
      new ParseFilePipe({
        validators: [
          new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 }),
          new HistoricalFileValidator(),
        ],
      })
    )
    file: Express.Multer.File,
    @Body() uploadDto: UploadHistoricalFileDto,
  ): Promise<HistoricalRecordResponseDto> {
    // 1. Validar archivo (guardias)
    // 2. Ejecutar use case
    // 3. Retornar response
  }
}
```

**Guardias:**
- ✅ `AuthGuard`: Requiere JWT token
- ⚠️ AdminGuard: TODO (cuando esté disponible)
- ✅ MaxFileSizeValidator: 10MB máximo
- ✅ HistoricalFileValidator: Solo .xlsx

---

## Data Flow Diagram

```
Request HTTP
  ↓
Controller
  ├─ Parse multipart form data
  ├─ Validar archivo (MaxSize, Format)
  ├─ Guardia: AuthGuard
  ↓
UploadHistoricalRecordsUseCase.execute()
  ├─ Parser
  │  ├─ XLSX.read(buffer)
  │  ├─ Auto-detect headers
  │  └─ Parse rows → HistoricalRecordRow[]
  │
  ├─ Validar todas las filas (sin DB)
  │  └─ row.validate() → isValid + errors
  │
  ├─ If validateOnly: return stats (sin DB)
  │
  └─ For each valid row:
     ↓
     HistoricalRowProcessorService.processRow()
       ├─ QueryRunner.startTransaction()
       ├─ EnsurePeriodExistsUseCase(year, month)
       ├─ CtaRecordCreatorService.createCtaRecords()
       │  ├─ CtaMaintenance.create() (si monto > 0)
       │  ├─ CtaWater.create() (si monto > 0)
       │  ├─ CtaPenalties.create() (si monto > 0)
       │  └─ CtaExtraordinaryFee.create() (si monto > 0)
       ├─ RecordRepository.create({ ...ctaIds })
       ├─ If casa identified:
       │  └─ HouseRecordRepository.create()
       ├─ Commit/Rollback
       └─ Return result
     ↓
Response: ProcessingResult.toResponseDto()
  ├─ total_rows
  ├─ successful
  ├─ failed
  ├─ errors[]
  └─ created_record_ids[]
```

---

## Database Interactions

### QueryRunner Pattern

Cada fila usa su propia transacción:

```typescript
// En HistoricalRowProcessorService
const queryRunner = this.dataSource.createQueryRunner();

// 1. Create (usa queryRunner)
const cta = await ctaMaintenanceRepository.create(data, queryRunner);
// Repository interpreta: si queryRunner → usa queryRunner.manager.save()

// 2. Create (usa queryRunner)
const record = await recordRepository.create({ ...ctaIds }, queryRunner);

// 3. Commit/Rollback
if (success) await queryRunner.commitTransaction();
else await queryRunner.rollbackTransaction();
```

**Ventajas:**
- ✅ Atomicidad: Todo o nada por fila
- ✅ Aislamiento: Una fila fallida no afecta otras
- ✅ Consistencia: No hay estado intermedio
- ✅ Durabilidad: Commit garantizado

### Repositories Used

| Repositorio | Uso | Métodos |
|-------------|-----|---------|
| CtaMaintenanceRepository | Crear cta_maintenance | `create(data, queryRunner?)` |
| CtaWaterRepository | Crear cta_water | `create(data, queryRunner?)` |
| CtaPenaltiesRepository | Crear cta_penalties | `create(data, queryRunner?)` |
| CtaExtraordinaryFeeRepository | Crear cta_extraordinary_fee | `create(data, queryRunner?)` |
| RecordRepository | Crear Record | `create(data, queryRunner?)` |
| HouseRecordRepository | Crear HouseRecord | `create(data, queryRunner?)` |
| HouseRepository | Buscar House | `findByNumberHouse()`, `exists()` |
| EnsurePeriodExistsUseCase | Obtener/crear Period | `execute(year, month)` |

---

## Error Handling

### Validation Errors (Domain)

No tocan BD:

```typescript
if (!row.validate().isValid) {
  return {
    success: false,
    error: {
      row_number: row.rowNumber,
      error_type: 'validation',
      message: validation.errors.join('; ')
    }
  };
}
```

### Database Errors (Infrastructure)

Disparan rollback automático:

```typescript
try {
  // DB operations
  await queryRunner.commitTransaction();
} catch (error) {
  await queryRunner.rollbackTransaction();
  return {
    success: false,
    error: {
      row_number: row.rowNumber,
      error_type: 'database',
      message: error.message,
      details: { concepto, deposito, casa }
    }
  };
}
```

### File Validation Errors (HTTP)

Guardias y validadores:

```typescript
if (!isValidFileType) {
  throw new BadRequestException('Solo se permiten archivos Excel (.xlsx)');
}

if (fileSizeBytes > 10 * 1024 * 1024) {
  throw new BadRequestException('El archivo no debe superar 10MB');
}
```

---

## Testing Strategy

### Unit Tests: Domain Entity

```typescript
describe('HistoricalRecordRow', () => {
  it('should identify house from deposit cents', () => {
    const row = HistoricalRecordRow.create({
      // ... fields
      deposito: 1542.42,
      casa: 0 // Not identified
    });

    expect(row.getIdentifiedHouseNumber()).toBe(42);
  });

  it('should validate amount distribution', () => {
    const row = HistoricalRecordRow.create({
      deposito: 1500.00,
      cuotaExtra: 500,
      mantto: 800,
      penalizacion: 0,
      agua: 200
      // sum = 1500, floor(1500) = 1500 ✓
    });

    expect(row.isValidAmountDistribution()).toBe(true);
  });

  it('should fail on amount mismatch', () => {
    const row = HistoricalRecordRow.create({
      deposito: 1500.00,
      cuotaExtra: 500,
      mantto: 700, // Wrong: should be 800
      penalizacion: 0,
      agua: 200
      // sum = 1400, floor(1500) = 1500 ✗
    });

    const { isValid, errors } = row.validate();
    expect(isValid).toBe(false);
    expect(errors[0]).toContain('Amount mismatch');
  });
});
```

### Unit Tests: Parser Service

```typescript
describe('HistoricalExcelParserService', () => {
  it('should parse valid Excel file', async () => {
    const service = new HistoricalExcelParserService();
    const buffer = fs.readFileSync('test-fixtures/valid.xlsx');

    const rows = await service.parseFile(buffer);

    expect(rows).toHaveLength(10);
    expect(rows[0]).toBeInstanceOf(HistoricalRecordRow);
  });

  it('should support multiple date formats', async () => {
    // Test ISO, DD/MM/YYYY, DD/MM, Excel serial
  });

  it('should detect header row automatically', async () => {
    // Test with headers at row 0, 5, 10
  });
});
```

### Integration Tests: End-to-End

```typescript
describe('Historical Records Upload [E2E]', () => {
  it('should upload and process valid file', async () => {
    const file = new File([excelBuffer], 'valid.xlsx');

    const response = await uploadHistoricalRecords(file, {
      validateOnly: false
    });

    expect(response.successful).toBeGreaterThan(0);
    expect(response.errors.length).toBe(0);
    expect(response.created_record_ids.length).toBe(response.successful);

    // Verify BD
    const records = await db.record.findMany({
      where: { id: { in: response.created_record_ids } }
    });
    expect(records).toHaveLength(response.successful);
  });

  it('should validate only without inserting', async () => {
    const file = new File([excelBuffer], 'valid.xlsx');

    const response = await uploadHistoricalRecords(file, {
      validateOnly: true
    });

    // No records should be created
    const records = await db.record.findMany({
      where: { id: { in: response.created_record_ids } }
    });
    expect(records).toHaveLength(0);
  });
});
```

---

## Logging Strategy

### Critical Points

```typescript
// HistoricalExcelParserService
this.logger.log(`Successfully parsed ${records.length} rows from Excel file`);

// HistoricalRowProcessorService
this.logger.log(`Processing row ${row.rowNumber} with transaction`);
this.logger.debug(`Period ${year}-${month} ID: ${period.id}`);
this.logger.debug(`Created Record ID: ${record.id}`);

// UploadHistoricalRecordsUseCase
this.logger.log(`Parsed ${rows.length} rows from Excel file`);
this.logger.log(`Validation complete: ${validRows.length} valid, ${errors.length} invalid`);
this.logger.log(`Processing complete: ${successfulCount} successful`);
```

### Log Format

```
[HistoricalExcelParserService] Parsed 100 rows from Excel file
[HistoricalRowProcessorService] Processing row 1 with transaction
[HistoricalRowProcessorService] Created cta_maintenance ID: 42
[HistoricalRowProcessorService] Created Record ID: 123
[HistoricalRowProcessorService] Row 1 processed successfully (Record ID: 123)
[UploadHistoricalRecordsUseCase] Processing complete: 95 successful, 5 failed
```

---

## Performance Considerations

### Optimization Points

| Punto | Estrategia | Notas |
|-------|-----------|-------|
| Parsing | Row-by-row sin buffer total | XLSX library es eficiente |
| Validación | Parallelizable (future) | Actualmente secuencial |
| DB inserts | Per-row transactions | Garantiza consistencia, no bulk |
| Memory | Stream parsing (future) | Archivo completo en RAM actualmente |

### Recomendaciones

- ✅ Archivos < 1000 filas: óptimo
- ⚠️ Archivos 1000-10000 filas: aceptable, monitorear
- ❌ Archivos > 10000 filas: considerar batch processing o async jobs

---

## Future Improvements

### Priority: HIGH

1. **AdminGuard**: Restringir a administradores
2. **Async Processing**: Usar Bull queue para archivos grandes
3. **Progress Tracking**: WebSocket updates para UI

### Priority: MEDIUM

1. **Duplicate Detection**: Opcional flag para detectar duplicados
2. **Rollback API**: Endpoint para deshacer una carga
3. **Batch Validation**: Validar múltiples archivos en paralelo
4. **Audit Log**: Trackear quién cargó qué y cuándo

### Priority: LOW

1. **Template Download**: Descargar plantilla Excel
2. **Sample Data**: Ejemplos de archivos válidos
3. **Metrics Dashboard**: Estadísticas de cargas

---

## Troubleshooting & Debugging

### Debug Mode

```bash
DEBUG=*:* npm run start:dev
```

### Common Issues

#### Issue: "Casa no existe"
- **Causa**: House no registrada en BD
- **Fix**: Crear casa primero o usar Casa=0 (centavos)
- **Log**: `Casa 99 no existe en el sistema`

#### Issue: "Amount mismatch"
- **Causa**: floor(DEPOSITO) != sum(cta_*)
- **Fix**: Revisar montos en Excel
- **Log**: `floor(1542.42) != 1500`

#### Issue: "FECHA inválida"
- **Causa**: Formato de fecha no reconocido
- **Fix**: Usar ISO (YYYY-MM-DD), DD/MM/YYYY, o DD/MM
- **Log**: `FECHA inválida: 15-01-2023` (guión no soportado)

#### Issue: "At least one cta_* amount must be > 0"
- **Causa**: Todos los montos cta_* son 0
- **Fix**: Agregar monto en al menos una columna
- **Log**: Validación de dominio, row.getActiveCtaTypes().length == 0

---

## Related Code References

- **PaymentManagement**: `EnsurePeriodExistsUseCase`
- **BankReconciliation**: Puede usar Records creados
- **Repositories**: `RecordRepository`, `HouseRepository`
- **Entities**: `Record`, `CtaMaintenance`, `House`, `Period`

---

## API Documentation

Auto-generada por Swagger en `/api-docs`:

```
POST /historical-records/upload
  Request: multipart/form-data
  - file: .xlsx (required, max 10MB)
  - description?: string
  - validateOnly?: boolean

  Response 200:
  {
    total_rows: number,
    successful: number,
    failed: number,
    success_rate: number,
    errors: RowErrorDto[],
    created_record_ids: number[]
  }

  Response 400:
  {
    statusCode: 400,
    message: string,
    error: 'Bad Request'
  }

  Response 401:
  {
    statusCode: 401,
    message: 'Unauthorized'
  }
```

---

## Module Registration

En `src/app.module.ts`:

```typescript
import { HistoricalRecordsModule } from './features/historical-records/historical-records.module';

@Module({
  imports: [
    // ...
    HistoricalRecordsModule,  // ← Registrado aquí
    // ...
  ],
})
export class AppModule {}
```

En `database.module.ts`:

```typescript
providers: [
  // ...
  CtaMaintenanceRepository,     // ← Registrados aquí
  CtaWaterRepository,
  CtaPenaltiesRepository,
  CtaExtraordinaryFeeRepository,
  // ...
]
```

---

## Support & Contact

Para preguntas sobre implementación:
1. Revisar esta documentación
2. Revisar código fuente con comentarios detallados
3. Ejecutar tests: `npm run test`
4. Contactar al equipo de backend
