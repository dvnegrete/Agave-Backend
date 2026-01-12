# Historical Records Upload - Technical Documentation

## 1. Overview

### What is Historical Records Upload?

Historical Records Upload is a backend feature that allows importing historical accounting records from Excel files (.xlsx) into the Agave system. These records represent past financial transactions (deposits) that occurred before the system was implemented.

### Purpose

- Import legacy accounting data from Excel spreadsheets into the database
- Preserve historical transaction records with full traceability
- Handle both identified payments (with assigned house) and unidentified payments (requiring manual assignment)
- Maintain accounting integrity through context-dependent validation rules

### Users

- System administrators
- Accounting staff migrating historical data

---

## 2. Context-Dependent Validation Logic

The feature implements flexible validation rules that adapt based on whether a payment has an assigned house (`Casa` column).

### Casa = 0 (Unidentified Payment)

When `Casa = 0`, the payment is unidentified and requires manual house assignment.

**Validation Rules:**
- `sum(cta_*) MUST be 0`
  - No amounts can be assigned to `Cuota Extra`, `Mantto`, `Penalizacion`, or `Agua`
  - Conceptos (expense categories) cannot be assigned until the house is identified
- Payment appears in `/unclaimed-deposits` endpoint with `validation_status = 'not-found'`
- Requires manual assignment via `POST /unclaimed-deposits/{id}/assign-house`

**Database Behavior:**
- Creates `transactions_bank` record
- Creates `transactions_status` with `validation_status = 'not-found'`
- Does NOT create `records` entry
- Does NOT create `house_records` entry
- Does NOT create any `cta_*` records

**Example:**
```
FECHA: 2023-01-15
DEPOSITO: 1542.42
Casa: 0
Cuota Extra: 0
Mantto: 0
Penalizacion: 0
Agua: 0
→ Valid: sum(cta_*) = 0 ✓
→ Will appear in unclaimed-deposits
```

---

### Casa > 0 (Identified Payment)

When `Casa > 0`, the payment is already assigned to a specific house.

**Validation Rules:**
- `sum(cta_*) CAN be 0 OR MUST equal floor(DEPOSITO)`
- Two valid scenarios:
  1. **No conceptos assigned** (`sum(cta_*) = 0`): Money remains in suspense without concept allocation
  2. **Conceptos assigned** (`sum(cta_*) > 0`): Must match floor of deposit amount

**Database Behavior:**

**Scenario 1: `sum(cta_*) = 0` (Money in Suspense)**
- Creates `transactions_bank` record
- Creates `transactions_status` with `validation_status = 'confirmed'`
- Creates `records` entry (with NULL cta_* foreign keys)
- Creates `house_records` association
- Does NOT create any `cta_*` records
- Payment appears in `/unclaimed-deposits` endpoint for concept allocation

**Scenario 2: `sum(cta_*) > 0` (Conceptos Assigned)**
- Creates `transactions_bank` record
- Creates `transactions_status` with `validation_status = 'confirmed'`
- Creates `cta_*` records for non-zero amounts
- Creates `records` entry (with cta_* foreign keys populated)
- Creates `house_records` association
- Does NOT appear in `/unclaimed-deposits`

**Examples:**

```
# Valid: Money in suspense (no conceptos)
FECHA: 2023-01-15
DEPOSITO: 1542.00
Casa: 42
Cuota Extra: 0
Mantto: 0
Penalizacion: 0
Agua: 0
→ Valid: sum(cta_*) = 0 ✓
→ Record created, appears in unclaimed-deposits
```

```
# Valid: Conceptos match deposit floor
FECHA: 2023-01-15
DEPOSITO: 1542.99
Casa: 42
Cuota Extra: 800
Mantto: 500
Penalizacion: 200
Agua: 42
→ Valid: floor(1542.99) = 1542, sum(800+500+200+42) = 1542 ✓
→ Record created with cta_* links
```

```
# Invalid: Conceptos don't match
FECHA: 2023-01-15
DEPOSITO: 1542.00
Casa: 42
Cuota Extra: 800
Mantto: 500
Penalizacion: 100
Agua: 0
→ Invalid: floor(1542) = 1542, but sum(800+500+100) = 1400 ✗
→ Validation error, row rejected
```

---

## 3. Implementation Changes

### 3.1 `historical-record-row.entity.ts`

**Location:** `/src/features/historical-records/domain/historical-record-row.entity.ts`

**Key Method: `isValidAmountDistribution()`**

Implements the context-dependent validation logic:

```typescript
isValidAmountDistribution(): boolean {
  const expectedTotal = Math.floor(this.deposito);
  const actualTotal = this.getSumCtaAmounts();

  // Case 1: Casa = 0 (unidentified payment)
  if (this.casa === 0) {
    // Must have no cta_* assigned (will be reconciled manually)
    return actualTotal === 0;
  }

  // Case 2: Casa > 0 (identified payment)
  // Either no cta_* (sum = 0) or exact match with floor(deposito)
  return actualTotal === 0 || expectedTotal === actualTotal;
}
```

**Other Methods:**
- `getSumCtaAmounts()`: Returns sum of all cta_* amounts
- `isIdentifiedPayment()`: Returns `true` if `casa > 0`
- `getActiveCtaTypes()`: Returns list of cta_* types with amounts > 0
- `validate()`: Orchestrates all validation rules

---

### 3.2 `cta-record-creator.service.ts`

**Location:** `/src/features/historical-records/infrastructure/processors/cta-record-creator.service.ts`

**Key Behavior:**

Skips cta_* record creation when `sum(cta_*) = 0`:

```typescript
async createCtaRecords(
  row: HistoricalRecordRow,
  periodId: number,
  queryRunner: QueryRunner,
): Promise<CtaRecordIds> {
  const ids: CtaRecordIds = {};
  const activeTypes = row.getActiveCtaTypes();

  // If no active cta types (sum = 0), skip cta creation
  if (activeTypes.length === 0) {
    this.logger.debug(
      `Row ${row.rowNumber}: No cta_* records to create (sum of cta_* = 0)`,
    );
    return ids; // Return empty object
  }

  // Create cta_* records for active types...
}
```

**Database Tables Created:**
- `cta_extraordinary_fee` (if `Cuota Extra > 0`)
- `cta_maintenance` (if `Mantto > 0`)
- `cta_penalties` (if `Penalizacion > 0`)
- `cta_water` (if `Agua > 0`)

---

### 3.3 `historical-row-processor.service.ts`

**Location:** `/src/features/historical-records/infrastructure/processors/historical-row-processor.service.ts`

**Key Method: `processRow()`**

Differentiates between `Casa = 0` and `Casa > 0`:

**For Casa = 0:**
```typescript
// Casa = 0: NO Record, NO HouseRecord
// Transaction will be pending in unclaimed-deposits
this.logger.debug(
  `Row ${row.rowNumber}: Casa = 0 (unidentified), Record not created. Will appear in unclaimed-deposits.`,
);
```

**For Casa > 0:**
```typescript
// Casa > 0: Create Record and HouseRecord
const record = await this.recordRepository.create(
  {
    transaction_status_id: transactionStatus.id,
    vouchers_id: null,
    ...ctaIds, // May be empty if sum(cta_*) = 0
  },
  queryRunner,
);

// Create house-record association
const houseRecord = await this.houseRecordRepository.create(
  {
    house_id: ensureResult.house.id,
    record_id: record.id,
  },
  queryRunner,
);
```

**Transaction Status Assignment:**
- Casa = 0: `validation_status = 'not-found'`
- Casa > 0: `validation_status = 'confirmed'`

---

## 4. Processing Flow

### Flow Diagram

```
Excel File Upload
       ↓
Parse Excel → Extract rows
       ↓
Validate rows (no DB)
       ↓
   Casa = 0?
   ↙      ↘
 YES      NO (Casa > 0)
   ↓         ↓
sum=0?   sum=0 OR sum=floor(DEPOSITO)?
   ↓         ↓
Create:   Create:
- TransactionBank         - TransactionBank
- TransactionStatus       - TransactionStatus
  (status: not-found)       (status: confirmed)
                           - cta_* records (if sum > 0)
                           - Record
                           - HouseRecord
       ↓
Appears in /unclaimed-deposits
```

---

### 4 Main Processing Cases

#### Case 1: Unidentified Payment (Casa = 0, sum = 0)

**Input:**
```
Casa: 0
DEPOSITO: 1542.42
Cuota Extra: 0, Mantto: 0, Penalizacion: 0, Agua: 0
```

**Output:**
- `transactions_bank`: Created
- `transactions_status`: Created (validation_status = 'not-found')
- `records`: NOT created
- `house_records`: NOT created
- `cta_*`: NOT created
- **Appears in `/unclaimed-deposits`**

---

#### Case 2: Identified Payment, No Conceptos (Casa > 0, sum = 0)

**Input:**
```
Casa: 42
DEPOSITO: 1542.00
Cuota Extra: 0, Mantto: 0, Penalizacion: 0, Agua: 0
```

**Output:**
- `transactions_bank`: Created
- `transactions_status`: Created (validation_status = 'confirmed')
- `records`: Created (all cta_* foreign keys = NULL)
- `house_records`: Created
- `cta_*`: NOT created
- **Appears in `/unclaimed-deposits` for concept allocation**

---

#### Case 3: Identified Payment, Conceptos Assigned (Casa > 0, sum > 0)

**Input:**
```
Casa: 42
DEPOSITO: 1542.99
Cuota Extra: 800, Mantto: 500, Penalizacion: 200, Agua: 42
sum = 1542, floor(1542.99) = 1542 ✓
```

**Output:**
- `transactions_bank`: Created
- `transactions_status`: Created (validation_status = 'confirmed')
- `cta_extraordinary_fee`: Created (amount: 800)
- `cta_maintenance`: Created (amount: 500)
- `cta_penalties`: Created (amount: 200)
- `cta_water`: Created (amount: 42)
- `records`: Created (cta_* foreign keys populated)
- `house_records`: Created
- **Does NOT appear in `/unclaimed-deposits`**

---

#### Case 4: Invalid - Mismatch

**Input:**
```
Casa: 42
DEPOSITO: 1542.00
Cuota Extra: 800, Mantto: 500, Penalizacion: 100, Agua: 0
sum = 1400, floor(1542) = 1542 ✗
```

**Output:**
- Validation error: "Amount distribution error - floor(DEPOSITO: 1542) = 1542 but sum(cta_*) = 1400"
- Row rejected
- No database records created

---

## 5. API Endpoints

### 5.1 POST `/historical-records/upload`

**Description:** Upload and process historical records Excel file.

**Request:**
- Method: `POST`
- Content-Type: `multipart/form-data`
- Query Parameter: `bankName` (required, e.g., "BBVA")
- Body:
  - `file`: Excel file (.xlsx, max 10MB)
  - `description`: Optional description (string)
  - `validateOnly`: Optional boolean (default: false)

**Response:**
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
      "message": "Amount distribution error - floor(DEPOSITO: 1542.42) = 1542 but sum(cta_*) = 1500"
    }
  ],
  "created_record_ids": [1, 2, 3, ...]
}
```

**Controller:** `HistoricalRecordsController`
**Use Case:** `UploadHistoricalRecordsUseCase`

**Processing:**
- Parses Excel file using `HistoricalExcelParserService`
- Validates all rows before processing
- Processes valid rows with concurrency limit (max 3 parallel)
- Each row processed in its own transaction (atomic)
- Returns detailed error report for failed rows

---

## 6. Database Schema

### 6.1 Tables Affected

#### `transactions_bank`
- Stores the raw bank transaction data
- Always created for every imported row

**Relevant Columns:**
- `id`: bigint (primary key)
- `date`: date
- `time`: time
- `concept`: varchar(225)
- `amount`: float (DEPOSITO value)
- `is_deposit`: boolean (always true for historical records)
- `bank_name`: text (from bankName query parameter)
- `confirmation_status`: boolean

---

#### `transactions_status`
- Tracks validation status of each transaction

**Relevant Columns:**
- `id`: int (primary key)
- `transactions_bank_id`: bigint (FK)
- `validation_status`: enum (ValidationStatus)
- `identified_house_number`: int (nullable)
- `reason`: text
- `processed_at`: timestamptz

**Possible `validation_status` Values:**
- `'not-found'`: Casa = 0 (unidentified)
- `'confirmed'`: Casa > 0 (identified)
- `'conflict'`: Multiple possible matches (not used in historical import)
- `'pending'`: Initial state (not used in historical import)
- `'requires-manual'`: Needs manual review (not used in historical import)

---

#### `records`
- Central table linking transaction to expense categories
- Only created if `Casa > 0`

**Relevant Columns:**
- `id`: int (primary key)
- `transaction_status_id`: int (FK)
- `vouchers_id`: int (nullable, always NULL for historical)
- `cta_extraordinary_fee_id`: int (nullable)
- `cta_maintence_id`: int (nullable)
- `cta_penalities_id`: int (nullable)
- `cta_water_id`: int (nullable)

**Behavior:**
- If `sum(cta_*) = 0`: All cta_* FKs are NULL
- If `sum(cta_*) > 0`: Populated with corresponding cta_* record IDs

---

#### `house_records`
- Junction table linking houses to records
- Only created if `Casa > 0`

**Relevant Columns:**
- `id`: int (primary key)
- `house_id`: int (FK)
- `record_id`: int (FK)

---

#### `cta_*` Tables

Five tables storing expense category amounts:

1. **`cta_extraordinary_fee`**: Cuota Extra
2. **`cta_maintenance`**: Mantto
3. **`cta_penalties`**: Penalizacion
4. **`cta_water`**: Agua
5. **`cta_other_payments`**: Not used in historical import

**Common Columns:**
- `id`: int (primary key)
- `amount`: float
- `period_id`: int (FK to periods table)

**Creation Condition:**
- Only created if corresponding Excel column value > 0

---

#### `manual_validation_approvals`
- Audit table for manual house assignments

**Relevant Columns:**
- `id`: int (primary key)
- `transaction_id`: bigint (FK to transactions_bank)
- `approved_by_user_id`: uuid (FK to users)
- `approval_notes`: text
- `approved_at`: timestamptz

**Created When:**
- Admin manually assigns house via `/unclaimed-deposits/{id}/assign-house`

---

### 6.2 Data Flow Example

**Excel Row:**
```
FECHA: 2023-01-15
HORA: 14:30:00
CONCEPTO: "Pago mensual"
DEPOSITO: 1542.00
Casa: 42
Cuota Extra: 800
Mantto: 500
Penalizacion: 200
Agua: 42
```

**Database Records Created:**

1. **`transactions_bank` (id: 100)**
   ```
   date: 2023-01-15
   time: 14:30:00
   concept: "Pago mensual"
   amount: 1542.00
   is_deposit: true
   bank_name: "BBVA"
   ```

2. **`transactions_status` (id: 200)**
   ```
   transactions_bank_id: 100
   validation_status: 'confirmed'
   identified_house_number: 42
   reason: "Registro histórico importado - Con casa asignada"
   processed_at: 2024-01-08 10:00:00
   ```

3. **`cta_extraordinary_fee` (id: 301)**
   ```
   amount: 800
   period_id: 50 (2023-01)
   ```

4. **`cta_maintenance` (id: 401)**
   ```
   amount: 500
   period_id: 50
   ```

5. **`cta_penalties` (id: 501)**
   ```
   amount: 200
   period_id: 50
   description: "Pago mensual"
   ```

6. **`cta_water` (id: 601)**
   ```
   amount: 42
   period_id: 50
   ```

7. **`records` (id: 700)**
   ```
   transaction_status_id: 200
   vouchers_id: NULL
   cta_extraordinary_fee_id: 301
   cta_maintence_id: 401
   cta_penalities_id: 501
   cta_water_id: 601
   ```

8. **`house_records` (id: 800)**
   ```
   house_id: 42
   record_id: 700
   ```

---

## 7. Test Cases

### Test Case 1: Unidentified Payment

**Input Excel Row:**
```
FECHA: 2023-01-15
DEPOSITO: 1542.42
Casa: 0
Cuota Extra: 0
Mantto: 0
Penalizacion: 0
Agua: 0
CONCEPTO: "Depósito sin identificar"
```

**Expected Behavior:**
- Validation passes
- Creates `transactions_bank`
- Creates `transactions_status` with `validation_status = 'not-found'`
- Does NOT create `records`, `house_records`, or `cta_*`
- Appears in `/unclaimed-deposits`

**Verification Query:**
```sql
SELECT
  tb.id,
  tb.amount,
  ts.validation_status,
  ts.identified_house_number,
  r.id AS record_id
FROM transactions_bank tb
JOIN transactions_status ts ON ts.transactions_bank_id = tb.id
LEFT JOIN records r ON r.transaction_status_id = ts.id
WHERE tb.concept = 'Depósito sin identificar';

-- Expected result:
-- record_id: NULL
-- validation_status: 'not-found'
-- identified_house_number: NULL
```

---

### Test Case 2: Identified Payment with Conceptos

**Input Excel Row:**
```
FECHA: 2023-02-20
DEPOSITO: 1542.99
Casa: 42
Cuota Extra: 800
Mantto: 500
Penalizacion: 200
Agua: 42
CONCEPTO: "Pago completo"
```

**Expected Behavior:**
- Validation passes (floor(1542.99) = 1542, sum = 1542)
- Creates all database records
- Does NOT appear in `/unclaimed-deposits`

**Verification Query:**
```sql
SELECT
  tb.id,
  tb.amount,
  ts.validation_status,
  r.id AS record_id,
  hr.house_id,
  cef.amount AS cuota_extra,
  cm.amount AS mantto,
  cp.amount AS penalizacion,
  cw.amount AS agua
FROM transactions_bank tb
JOIN transactions_status ts ON ts.transactions_bank_id = tb.id
JOIN records r ON r.transaction_status_id = ts.id
JOIN house_records hr ON hr.record_id = r.id
LEFT JOIN cta_extraordinary_fee cef ON cef.id = r.cta_extraordinary_fee_id
LEFT JOIN cta_maintenance cm ON cm.id = r.cta_maintence_id
LEFT JOIN cta_penalties cp ON cp.id = r.cta_penalities_id
LEFT JOIN cta_water cw ON cw.id = r.cta_water_id
WHERE tb.concept = 'Pago completo';

-- Expected result:
-- record_id: NOT NULL
-- house_id: 42
-- cuota_extra: 800
-- mantto: 500
-- penalizacion: 200
-- agua: 42
```

---

### Test Case 3: Identified Payment, No Conceptos (Suspense)

**Input Excel Row:**
```
FECHA: 2023-03-10
DEPOSITO: 1000.00
Casa: 25
Cuota Extra: 0
Mantto: 0
Penalizacion: 0
Agua: 0
CONCEPTO: "Pago en suspense"
```

**Expected Behavior:**
- Validation passes (sum = 0)
- Creates `transactions_bank`, `transactions_status`, `records`, `house_records`
- Does NOT create any `cta_*`
- Appears in `/unclaimed-deposits` (for concept allocation)

**Verification Query:**
```sql
SELECT
  tb.id,
  tb.amount,
  ts.validation_status,
  r.id AS record_id,
  hr.house_id,
  r.cta_extraordinary_fee_id,
  r.cta_maintence_id,
  r.cta_penalities_id,
  r.cta_water_id
FROM transactions_bank tb
JOIN transactions_status ts ON ts.transactions_bank_id = tb.id
JOIN records r ON r.transaction_status_id = ts.id
JOIN house_records hr ON hr.record_id = r.id
WHERE tb.concept = 'Pago en suspense';

-- Expected result:
-- record_id: NOT NULL
-- house_id: 25
-- All cta_* FKs: NULL
-- validation_status: 'confirmed'
```

---

### Test Case 4: Validation Failure - Amount Mismatch

**Input Excel Row:**
```
FECHA: 2023-04-05
DEPOSITO: 1542.00
Casa: 30
Cuota Extra: 800
Mantto: 500
Penalizacion: 100
Agua: 0
CONCEPTO: "Pago con error"
```

**Expected Behavior:**
- Validation fails
- Error: "Amount distribution error - floor(DEPOSITO: 1542) = 1542 but sum(cta_*) = 1400"
- No database records created

**Verification Query:**
```sql
SELECT COUNT(*)
FROM transactions_bank
WHERE concept = 'Pago con error';

-- Expected result: 0
```

---

### Test Case 5: Validation Failure - Casa 0 with Conceptos

**Input Excel Row:**
```
FECHA: 2023-05-12
DEPOSITO: 1542.00
Casa: 0
Cuota Extra: 800
Mantto: 500
Penalizacion: 200
Agua: 42
CONCEPTO: "Error: Casa 0 con conceptos"
```

**Expected Behavior:**
- Validation fails
- Error: "Casa is 0 (unidentified) but cta_* amounts are assigned (sum = 1542, expected 0)"
- No database records created

**Verification Query:**
```sql
SELECT COUNT(*)
FROM transactions_bank
WHERE concept = 'Error: Casa 0 con conceptos';

-- Expected result: 0
```

---

## 8. Auditability Considerations

### Transaction Traceability

All historical records maintain full audit trails:

1. **Original Transaction Data**
   - Preserved in `transactions_bank` (date, time, concept, amount)
   - `bank_name` identifies data source

2. **Processing Metadata**
   - `transactions_status.reason` documents import source
   - `transactions_status.processed_at` records processing timestamp

3. **Manual Assignments**
   - `manual_validation_approvals` table records all manual house assignments
   - Includes user ID, timestamp, and admin notes

4. **Timestamps**
   - All tables have `created_at` and `updated_at` timestamps
   - Enables full reconstruction of data history

---

### Money Traceability

The system ensures accounting integrity:

1. **Amount Preservation**
   - Original `DEPOSITO` amount stored in `transactions_bank.amount`
   - Never modified or deleted (CASCADE deletes prevented)

2. **Concept Distribution**
   - Sum of `cta_*` amounts always equals floor(deposit) or 0
   - Enforced by validation before database write

3. **Pending Detection**
   - Money in suspense (sum = 0) appears in `/unclaimed-deposits`
   - Enables tracking of unallocated funds

---

### Cents Handling (TODO)

**Current Limitation:**
- Decimal cents are not tracked separately
- Only floor(DEPOSITO) is distributed to conceptos
- Cents remain in `transactions_bank.amount` but not allocated

**Example:**
```
DEPOSITO: 1542.99
Conceptos sum: 1542.00
Missing: 0.99 cents (not tracked)
```

**Planned Enhancement:**
- Create `cta_other_payments` record for remaining cents
- Or: Add cents adjustment field to one of the conceptos
- Or: Create dedicated "cents adjustment" table

**Tracking:**
- TODO: Implement cents reconciliation mechanism
- TODO: Add cents validation report to upload response
- TODO: Document cents handling policy in business rules

---

## 9. Related Documentation

- `/docs/features/historical-records/BACKEND-IMPLEMENTATION.md` - Implementation details
- `/docs/features/historical-records/FRONTEND-INTEGRATION.md` - Frontend integration guide
- `/docs/features/historical-records/README.md` - Feature overview
- `/docs/features/bank-reconciliation/` - Unclaimed deposits flow
- `/docs/features/payment-management/` - Payment allocation logic

---

## 10. Key Takeaways

1. **Context-Dependent Validation**: Rules change based on `Casa` value (0 vs > 0)
2. **Flexible Conceptos**: Identified payments (Casa > 0) can have conceptos or remain in suspense
3. **Manual Reconciliation**: Unidentified payments (Casa = 0) flow through `/unclaimed-deposits`
4. **Atomic Processing**: Each row processed in its own transaction for data integrity
5. **Full Audit Trail**: All imports and manual assignments are fully traceable
6. **Cents Gap**: Current implementation does not track decimal cents (TODO)

---

**Document Version:** 1.0
**Last Updated:** 2024-01-08
**Maintainer:** Backend Team
