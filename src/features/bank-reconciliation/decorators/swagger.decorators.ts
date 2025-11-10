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
- **Pendientes**: Vouchers sin transacción bancaria asociada
- **Sobrantes**: Transacciones bancarias sin voucher asociado
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
          totalVouchers: 50,
          totalTransactions: 48,
          matched: 45,
          pendingVouchers: 5,
          surplusTransactions: 3,
          manualValidationRequired: 2,
        },
        conciliados: [
          {
            voucher: { id: 1, monto: 1500.15, casa: 15 },
            transaction: { id: 100, monto: 1500.15, fecha: '2025-01-05' },
            matchConfidence: 1.0,
          },
        ],
        pendientes: [
          {
            voucher: { id: 2, monto: 2000.0, casa: 20 },
            reason: 'No se encontró transacción bancaria coincidente',
          },
        ],
        sobrantes: [
          {
            transaction: { id: 101, monto: 3000.0, fecha: '2025-01-10' },
            reason: 'No se encontró voucher coincidente',
          },
        ],
        manualValidationRequired: [
          {
            voucher: { id: 3, monto: 1000.0 },
            possibleMatches: [
              { transaction: { id: 102 }, matchScore: 0.85 },
              { transaction: { id: 103 }, matchScore: 0.8 },
            ],
            reason: 'Múltiples transacciones candidatas',
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
