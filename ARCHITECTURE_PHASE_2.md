# Phase 2 Architecture: Balance Calculation & Payment Reconciliation

**Status**: Documented for Future Implementation
**Last Updated**: 2026-01-08

## Overview

This document outlines the architecture for Phase 2 of the payment management system, which will implement:
1. House balance calculation (debt, credit, accumulated cents)
2. CTA (Cuenta) record assignment from historical records
3. Bank reconciliation with payment allocation

---

## Phase 1 (Completed)

### Current State
- Historical records are loaded from Excel files and stored in database
- Records are associated to houses via `HouseRecord` junction table
- Endpoint `GET /payment-management/houses/:houseId/payments` returns:
  - Bank transactions (from `TransactionBank` entity)
  - Historical records (from `Record` entity with cta_* relationships)
  - Both merged and sorted by date

### Data Flow
```
Excel Upload
    ↓
HistoricalRecordRow (domain entity)
    ↓
Validation & Period Lookup
    ↓
CTA Record Creation (cta_maintenance, cta_water, cta_penalties, cta_extraordinary_fee)
    ↓
Record Entity (FK to cta_*)
    ↓
HouseRecord Junction (maps Record → House)
    ↓
GET /payments endpoint (combined view)
```

---

## Phase 2: Balance & Reconciliation Architecture

### 2.1 Balance Calculation (`GET /payment-management/houses/:houseId/balance`)

#### Responsibilities
The balance endpoint will calculate three key values for a house:

1. **Debt (Deuda)**: Amount owed by the house
   - Sum of all expected payments for the period minus actual payments received
   - Only counts periods that have passed the due date

2. **Credit (Crédito)**: Overpayment/advance
   - Amount paid in excess of obligations
   - Can be applied to future periods

3. **Accumulated Cents (Centavos Acumulados)**: House identification mechanism
   - Decimal portion of historical deposits used to identify houses (e.g., $1542.42 → House 42)
   - Used when Casa = 0 in Excel uploads
   - Grows with each unidentified payment

#### Database Structure

**RecordAllocation** entity (already exists)
```typescript
- id: number
- record_id: number (FK to Record)
- house_id: number (FK to House)
- period_id: number (FK to Period)
- concept_type: AllocationConceptType (enum: extraordinary_fee, maintenance, water, penalties)
- concept_id: number (FK to specific cta_* record)
- allocated_amount: number (amount applied)
- expected_amount: number (amount owed)
- payment_status: PaymentStatus (enum: complete, partial, overpaid)
- created_at: Date
```

### 2.2 CTA Assignment Flow

#### Current Implementation Status
- ✅ Historical records create CTA records during upload
- ✅ Record references cta_* entities via FK
- ❌ RecordAllocations are NOT populated during historical record upload
- ❌ CTA assignments to specific payment concepts are incomplete

#### Phase 2 Implementation

**Step 1: RecordAllocation Population During Upload**
```
For each valid HistoricalRecordRow:
  1. Create Period (or get existing)
  2. Create cta_* records (fee, maintenance, water, penalties)
  3. Create Record with FK to cta_*
  4. Create HouseRecord (identifies house)
  5. [NEW] For each active CTA type:
     - Create RecordAllocation entry
     - Link record_id → concept_id (cta_* FK)
     - Set allocation amounts = deposited amounts
     - Mark payment_status = complete
```

**Data Structure Example**
```
Historical Excel Row:
  DEPOSITO: $1542.42
  Casa: 42
  Cuota Extra: $200
  Mantto: $800
  Penalizacion: $300
  Agua: $242.42

Results in:
  Record {id: 101, cta_extraordinary_fee_id: 51, cta_maintence_id: 52, ...}
  HouseRecord {house_id: 42, record_id: 101}
  RecordAllocation {
    record_id: 101, house_id: 42, period_id: 5,
    concept_type: 'extraordinary_fee', concept_id: 51,
    allocated_amount: 200, expected_amount: 200,
    payment_status: 'complete'
  }
  [Same for other concepts...]
```

**Step 2: Bank Reconciliation Assignment**
```
When reconciling bank transactions:
  1. Identify house from transaction (manual input or auto-match)
  2. Find applicable periods
  3. Match payment amount to outstanding allocations
  4. Create/update RecordAllocations
  5. Update payment_status based on amount matching
```

### 2.3 Balance Calculation Logic

#### Calculation Algorithm
```typescript
async calculateBalance(houseId: number, asOfDate?: Date) {
  // Get all RecordAllocations for the house
  const allocations = await recordAllocationRepository.findByHouseId(houseId, asOfDate);

  // 1. Calculate Debt
  const debt = allocations
    .filter(a => !isPeriodDue(a.period_id) || a.payment_status !== 'complete')
    .reduce((sum, a) => {
      const remaining = a.expected_amount - a.allocated_amount;
      return sum + Math.max(0, remaining);
    }, 0);

  // 2. Calculate Credit
  const credit = allocations
    .filter(a => a.payment_status === 'overpaid')
    .reduce((sum, a) => {
      const excess = a.allocated_amount - a.expected_amount;
      return sum + excess;
    }, 0);

  // 3. Calculate Accumulated Cents
  const accumulatedCents = historicalRecords
    .filter(r => !r.isIdentified) // Records with casa = 0
    .reduce((sum, r) => sum + getCentsPortion(r.deposito), 0);

  return { debt, credit, accumulatedCents };
}
```

### 2.4 Endpoint Response Structure

```typescript
// GET /payment-management/houses/:houseId/balance
{
  house_id: 42,
  house_number: 42,
  current_period: {
    year: 2026,
    month: 1
  },
  balance: {
    debt: 500.00,           // Amount owed
    credit: 250.00,         // Overpayment
    accumulated_cents: 85.00 // Unidentified payments
  },
  period_breakdown: [
    {
      period_id: 1,
      year: 2025,
      month: 12,
      expected_amount: 1000.00,
      allocated_amount: 750.00,
      status: 'partial'  // partial, complete, overpaid
    }
  ],
  last_payment_date: "2025-12-15T00:00:00.000Z",
  payment_history_link: "/payment-management/houses/42/payments"
}
```

---

## Phase 2 Implementation Steps

### 1. Modify Historical Record Upload Flow
- **File**: `src/features/historical-records/infrastructure/processors/historical-row-processor.service.ts`
- **Changes**: After creating Record, create RecordAllocations
- **Service**: Create `RecordAllocationCreatorService`

### 2. Add RecordAllocation Repository Methods
- **File**: `src/shared/database/repositories/record-allocation.repository.ts` (may need creation)
- **Methods**:
  - `findByHouseId(houseId, asOfDate?)`
  - `findByPeriodId(periodId)`
  - `findUnpaidByHouseId(houseId)`
  - `create(dto)`
  - `updateStatus(id, status)`

### 3. Implement Balance Calculation Use Case
- **File**: `src/features/payment-management/application/calculate-house-balance.use-case.ts`
- **Responsibilities**:
  - Query RecordAllocations
  - Calculate debt/credit/cents
  - Return structured response

### 4. Create Bank Reconciliation Feature
- **Directory**: `src/features/bank-reconciliation/`
- **Components**:
  - `ReconcilePaymentUseCase`: Match transactions to allocations
  - `BankReconciliationService`: Orchestrate matching
  - `PaymentMatchingStrategy`: Algorithm for matching amounts

### 5. Update `GetHouseBalanceUseCase`
- **Current File**: Already exists but incomplete
- **Changes**: Integrate with new balance calculation logic
- **Endpoint**: `GET /payment-management/houses/:houseId/balance`

---

## Data Flow Diagram (Phase 2)

```
Bank Transaction
    ↓
Reconciliation System
    ↓
Match to House & Period
    ↓
Create/Update RecordAllocation
    ↓
Update PaymentStatus
    ↓
Calculate Balance
    ↓
GET /balance endpoint
```

---

## Important Considerations

### Allocation Status Enum
```typescript
enum PaymentStatus {
  COMPLETE = 'complete',      // allocated_amount >= expected_amount
  PARTIAL = 'partial',        // 0 < allocated_amount < expected_amount
  OVERPAID = 'overpaid',      // allocated_amount > expected_amount
  PENDING = 'pending'         // allocated_amount = 0 (not yet allocated)
}
```

### Transaction Safety
- All reconciliation operations must be atomic (per allocation)
- If a payment is split across multiple allocations, use database transactions
- Rollback on validation failure

### Historical Records & Allocations
- For historical records loaded from Excel, allocations should be created immediately
- Set `allocated_amount = expected_amount` and `payment_status = complete`
- This ensures historical records are counted correctly in balance calculations

### Credit Carryover
- Credits should carry over to next period automatically
- When paying, apply in order: current period → accumulated credits
- Document in payment allocation notes

---

## Testing Strategy

### Unit Tests
- Balance calculation with various allocation scenarios
- Status enum transitions
- Debt/credit/cents calculations

### Integration Tests
- Full flow: Upload → Allocations Created → Balance Calculated
- Reconciliation matching scenarios
- Multi-period balance calculations

### Edge Cases
- House with no records → balance = 0
- Only overpayments → debt = 0, credit > 0
- Only unidentified payments → accumulated_cents > 0
- Period transitions (Dec → Jan)

---

## Future Enhancements (Phase 3+)

1. **Automated Payment Matching**: ML/rule-based matching for bank transactions
2. **Late Payment Penalties**: Auto-apply penalties to overdue allocations
3. **Payment Plans**: Split large debts across multiple periods
4. **Billing Templates**: Auto-create expected allocations for new periods
5. **Reporting**: Monthly statements, collection reports, aging analysis

---

## Related Code References

- **CTA Entities**:
  - `src/shared/database/entities/cta-*.entity.ts` (5 files)
  - `src/shared/database/entities/record.entity.ts` - FK references

- **Existing Repository Methods**:
  - `RecordRepository.findByHouseId()` - Phase 1 addition
  - `HouseRecordRepository.findByHouseId()` - Maps records to house

- **Completed Endpoints**:
  - `GET /payment-management/houses/:houseId/payments` - Returns combined transactions
  - `POST /historical-records/upload` - Creates records with cta_*

- **Incomplete Endpoints**:
  - `GET /payment-management/houses/:houseId/balance` - Needs reconciliation data

---

## Glossary

- **CTA (Cuenta)**: Account/concept category (maintenance, water, penalties, fees)
- **Allocation**: Distribution of a payment to a specific concept in a specific period
- **Reconciliation**: Process of matching bank/historical transactions to house obligations
- **Debt**: Amount owed (expected - allocated)
- **Credit**: Overpayment that can be applied to future periods
- **Accumulated Cents**: Unidentified payment amounts kept for house identification
