import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiBody } from '@nestjs/swagger';
import { ReconcileRequestDto, ReconciliationResponseDto } from '../dto';

/**
 * Decorador de Swagger para el endpoint de reconciliación bancaria
 */
export function ApiReconcileTransactions() {
  return applyDecorators(
    ApiOperation({
      summary: 'Ejecutar conciliación bancaria',
      description: `Compara transacciones bancarias con vouchers para identificar coincidencias automáticas.

**Criterios de matching:**
- Monto exacto
- Fecha dentro de ±3 días
- Número de casa coincidente

**Grupos de resultado:**
- **Conciliados**: Transacciones que coincidieron automáticamente con vouchers
- **Unfunded Vouchers**: Vouchers sin transacción bancaria asociada (comprobante sin dinero)
- **Unclaimed Deposits**: Transacciones bancarias sin voucher asociado (dinero sin comprobante)
- **Validación Manual**: Casos ambiguos que requieren revisión humana

Si no se proporcionan fechas, procesa TODOS los registros pendientes.`,
    }),
    ApiBody({
      type: ReconcileRequestDto,
      description:
        'Rango de fechas opcional para filtrar registros a conciliar',
      examples: {
        'Sin filtro (procesar todo)': {
          value: {},
          description: 'Procesa todos los registros pendientes',
        },
        'Con rango de fechas': {
          value: {
            startDate: '2025-01-01',
            endDate: '2025-01-31',
          },
          description: 'Procesa solo registros dentro del rango especificado',
        },
      },
    }),
    ApiResponse({
      status: 200,
      description: 'Conciliación ejecutada exitosamente',
      type: ReconciliationResponseDto,
      example: {
        summary: {
          totalProcessed: 48,
          conciliados: 43,
          unfundedVouchers: 5,
          unclaimedDeposits: 3,
          requiresManualValidation: 2,
        },
        conciliados: [
          {
            transactionBankId: '100',
            voucherId: 1,
            houseNumber: 15,
            amount: 1500.15,
            matchCriteria: ['AMOUNT', 'DATE'],
            confidenceLevel: 'HIGH',
          },
        ],
        unfundedVouchers: [
          {
            voucherId: 2,
            amount: 2000.0,
            date: '2025-01-10',
            reason: 'No matching bank transaction found',
          },
        ],
        unclaimedDeposits: [
          {
            transactionBankId: '101',
            amount: 3000.0,
            date: '2025-01-10',
            reason:
              'Sin voucher, sin centavos válidos, sin concepto identificable',
            requiresManualReview: true,
            houseNumber: 0,
          },
        ],
        manualValidationRequired: [
          {
            transactionBankId: '102',
            possibleMatches: [
              { voucherId: 3, similarity: 0.85, dateDifferenceHours: 12 },
              { voucherId: 4, similarity: 0.8, dateDifferenceHours: 18 },
            ],
            reason: 'Multiple vouchers with same amount',
          },
        ],
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Parámetros inválidos (formato de fecha incorrecto)',
    }),
    ApiResponse({
      status: 500,
      description: 'Error interno durante el proceso de conciliación',
    }),
  );
}
