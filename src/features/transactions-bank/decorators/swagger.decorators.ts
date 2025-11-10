import { applyDecorators } from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiBody,
  ApiConsumes,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';

/**
 * Decorador de Swagger para el endpoint de upload de archivos bancarios
 */
export function ApiUploadBankFile() {
  return applyDecorators(
    ApiOperation({
      summary: 'Subir archivo de estado de cuenta bancario',
      description: `Procesa un archivo de estado de cuenta bancario y extrae transacciones automáticamente.

**Formatos soportados:**
- Excel (.xlsx)
- CSV (.csv)
- JSON (.json)
- Texto (.txt)

**Modelos de bancos disponibles:**
- SantanderXlsx
- (Extensible con Strategy Pattern)

**Opciones de procesamiento:**
- Validar sin insertar (dry-run)
- Saltar duplicados
- Procesar en lotes`,
    }),
    ApiConsumes('multipart/form-data'),
    ApiQuery({
      name: 'bank',
      required: false,
      description: 'Nombre del banco (opcional, puede venir en el body)',
      example: 'Santander',
    }),
    ApiBody({
      description: 'Archivo y opciones de procesamiento',
      schema: {
        type: 'object',
        properties: {
          file: {
            type: 'string',
            format: 'binary',
            description: 'Archivo de estado de cuenta (max 10MB)',
          },
          description: {
            type: 'string',
            description: 'Descripción del upload',
            example: 'Estado de cuenta Enero 2025',
          },
          bank: {
            type: 'string',
            description: 'Nombre del banco',
            example: 'Santander',
          },
          model: {
            type: 'string',
            description: 'Modelo específico a usar',
            example: 'SantanderXlsx',
          },
          validateOnly: {
            type: 'boolean',
            description: 'Solo validar, no insertar en BD',
            default: false,
          },
          skipDuplicates: {
            type: 'boolean',
            description: 'Saltar transacciones duplicadas',
            default: false,
          },
        },
        required: ['file'],
      },
    }),
    ApiResponse({
      status: 201,
      description: 'Archivo procesado exitosamente',
      schema: {
        example: {
          message: 'Archivo procesado exitosamente',
          processedTransactions: 45,
          errors: [],
          transactions: [
            {
              id: 1,
              date: '2025-01-15',
              time: '10:30:00',
              concept: 'PAGO TRANSFERENCIA',
              amount: 1500.0,
              is_deposit: true,
              currency: 'MXN',
              bank_name: 'Santander',
              status: 'processed',
            },
          ],
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Archivo inválido o error de procesamiento',
    }),
  );
}

/**
 * Decorador de Swagger para el endpoint de listar transacciones
 */
export function ApiGetAllTransactions() {
  return applyDecorators(
    ApiOperation({
      summary: 'Listar transacciones bancarias',
      description:
        'Obtiene todas las transacciones bancarias con filtros opcionales por estado o rango de fechas.',
    }),
    ApiQuery({
      name: 'status',
      required: false,
      enum: ['pending', 'processed', 'failed', 'reconciled'],
      description: 'Filtrar por estado de la transacción',
    }),
    ApiQuery({
      name: 'startDate',
      required: false,
      type: String,
      description: 'Fecha de inicio (YYYY-MM-DD)',
      example: '2025-01-01',
    }),
    ApiQuery({
      name: 'endDate',
      required: false,
      type: String,
      description: 'Fecha de fin (YYYY-MM-DD)',
      example: '2025-01-31',
    }),
    ApiResponse({
      status: 200,
      description: 'Lista de transacciones',
      schema: {
        example: [
          {
            id: 1,
            date: '2025-01-15',
            time: '10:30:00',
            concept: 'PAGO TRANSFERENCIA',
            amount: 1500.0,
            is_deposit: true,
            currency: 'MXN',
            bank_name: 'Santander',
            status: 'processed',
            createdAt: '2025-01-15T10:30:00Z',
          },
        ],
      },
    }),
  );
}

/**
 * Decorador de Swagger para el endpoint de resumen estadístico
 */
export function ApiGetTransactionSummary() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtener resumen estadístico',
      description:
        'Obtiene estadísticas generales de todas las transacciones bancarias.',
    }),
    ApiResponse({
      status: 200,
      description: 'Resumen estadístico',
      schema: {
        example: {
          totalTransactions: 150,
          totalDeposits: 100,
          totalWithdrawals: 50,
          totalAmount: 75000.0,
          byStatus: {
            pending: 10,
            processed: 120,
            failed: 5,
            reconciled: 15,
          },
        },
      },
    }),
  );
}

/**
 * Decorador de Swagger para el endpoint de obtener transacción por ID
 */
export function ApiGetTransactionById() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtener transacción por ID',
      description: 'Obtiene los detalles de una transacción específica.',
    }),
    ApiParam({
      name: 'id',
      description: 'ID de la transacción',
      example: '1',
    }),
    ApiResponse({
      status: 200,
      description: 'Transacción encontrada',
    }),
    ApiResponse({
      status: 404,
      description: 'Transacción no encontrada',
    }),
  );
}

/**
 * Decorador de Swagger para el endpoint de crear transacción
 */
export function ApiCreateTransaction() {
  return applyDecorators(
    ApiOperation({
      summary: 'Crear transacción manualmente',
      description: 'Crea una nueva transacción bancaria de forma manual.',
    }),
    ApiResponse({
      status: 201,
      description: 'Transacción creada exitosamente',
    }),
    ApiResponse({
      status: 400,
      description: 'Datos inválidos',
    }),
  );
}

/**
 * Decorador de Swagger para el endpoint de actualizar transacción
 */
export function ApiUpdateTransaction() {
  return applyDecorators(
    ApiOperation({
      summary: 'Actualizar transacción',
      description: 'Actualiza los datos de una transacción existente.',
    }),
    ApiParam({
      name: 'id',
      description: 'ID de la transacción',
      example: '1',
    }),
    ApiResponse({
      status: 200,
      description: 'Transacción actualizada exitosamente',
    }),
    ApiResponse({
      status: 404,
      description: 'Transacción no encontrada',
    }),
  );
}

/**
 * Decorador de Swagger para el endpoint de eliminar transacción
 */
export function ApiDeleteTransaction() {
  return applyDecorators(
    ApiOperation({
      summary: 'Eliminar transacción',
      description: 'Elimina una transacción bancaria del sistema.',
    }),
    ApiParam({
      name: 'id',
      description: 'ID de la transacción',
      example: '1',
    }),
    ApiResponse({
      status: 200,
      description: 'Transacción eliminada exitosamente',
      schema: {
        example: {
          message: 'Transacción eliminada exitosamente',
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'Transacción no encontrada',
    }),
  );
}

/**
 * Decorador de Swagger para el endpoint de conciliación legacy
 */
export function ApiReconcileTransactionsLegacy() {
  return applyDecorators(
    ApiOperation({
      summary: 'Conciliar transacciones (Legacy)',
      description: `Proceso de conciliación legacy.

**Nota:** Se recomienda usar el endpoint \`/bank-reconciliation/reconcile\` que tiene más funcionalidades.`,
    }),
    ApiResponse({
      status: 200,
      description: 'Conciliación completada',
      schema: {
        example: {
          message: 'Conciliación completada exitosamente',
          reconciled: 45,
          pending: 5,
        },
      },
    }),
    ApiResponse({
      status: 400,
      description: 'Error durante la conciliación',
    }),
  );
}
