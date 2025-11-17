export enum Role {
  ADMIN = 'admin',
  OWNER = 'owner',
  TENANT = 'tenant',
}

export enum Status {
  ACTIVE = 'active',
  SUSPEND = 'suspend',
  INACTIVE = 'inactive',
}

export enum ValidationStatus {
  NOT_FOUND = 'not-found',
  PENDING = 'pending',
  CONFIRMED = 'confirmed',
  REQUIRES_MANUAL = 'requires-manual',
  CONFLICT = 'conflict',
}

// =====================================================
// PAYMENT MANAGEMENT ENUMS
// =====================================================

/**
 * Tipos de conceptos para distribución de pagos
 * Utilizado en RecordAllocation para especificar a qué concepto se aplica cada monto
 */
export enum AllocationConceptType {
  MAINTENANCE = 'maintenance',
  WATER = 'water',
  EXTRAORDINARY_FEE = 'extraordinary_fee',
  PENALTIES = 'penalties',
  OTHER = 'other',
}

/**
 * Estados de pago para registros de distribución
 * Indica si un pago fue completo, parcial o excedente
 */
export enum PaymentStatus {
  COMPLETE = 'complete',
  PARTIAL = 'partial',
  OVERPAID = 'overpaid',
}

/**
 * Tipos de conceptos para montos personalizados por casa/período
 * Utilizado en HousePeriodOverride para permitir convenios de pago
 */
export enum ConceptType {
  MAINTENANCE = 'maintenance',
  WATER = 'water',
  EXTRAORDINARY_FEE = 'extraordinary_fee',
}
