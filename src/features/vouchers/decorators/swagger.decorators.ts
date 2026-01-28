import { applyDecorators } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiQuery, ApiParam } from '@nestjs/swagger';

/**
 * Decorador de Swagger para el endpoint de listar vouchers
 */
export function ApiGetAllVouchers() {
  return applyDecorators(
    ApiOperation({
      summary: 'Listar vouchers/comprobantes',
      description: `Obtiene todos los vouchers procesados con filtros opcionales.

**Filtros disponibles:**
- **confirmation_status**: Filtrar por estado de confirmación (true/false)
- **startDate**: Fecha de inicio del rango (YYYY-MM-DD)
- **endDate**: Fecha de fin del rango (YYYY-MM-DD)

**Nota:** Si no se proporcionan filtros, retorna todos los vouchers.`,
    }),
    ApiQuery({
      name: 'confirmation_status',
      required: false,
      type: String,
      description:
        'Estado de confirmación (true para confirmados, false para pendientes)',
      example: 'true',
    }),
    ApiQuery({
      name: 'startDate',
      required: false,
      type: String,
      description: 'Fecha de inicio del rango (YYYY-MM-DD)',
      example: '2025-01-01',
    }),
    ApiQuery({
      name: 'endDate',
      required: false,
      type: String,
      description: 'Fecha de fin del rango (YYYY-MM-DD)',
      example: '2025-01-31',
    }),
    ApiResponse({
      status: 200,
      description: 'Lista de vouchers',
      schema: {
        example: [
          {
            id: 1,
            date: '2025-01-15',
            amount: 1500.0,
            house_number: 15,
            payment_period: 'Enero 2025',
            payment_concept: 'Mantenimiento',
            confirmation_status: true,
            url: 'vouchers/voucher_123456.jpg',
            createdAt: '2025-01-15T10:30:00Z',
            updatedAt: '2025-01-15T10:30:00Z',
          },
          {
            id: 2,
            date: '2025-01-16',
            amount: 2000.0,
            house_number: 20,
            payment_period: 'Enero 2025',
            payment_concept: 'Cuota ordinaria',
            confirmation_status: false,
            url: 'vouchers/voucher_123457.jpg',
            createdAt: '2025-01-16T14:20:00Z',
            updatedAt: '2025-01-16T14:20:00Z',
          },
        ],
      },
    }),
  );
}

/**
 * Decorador de Swagger para el endpoint de obtener voucher por ID
 */
export function ApiGetVoucherById() {
  return applyDecorators(
    ApiOperation({
      summary: 'Obtener voucher por ID',
      description: `Obtiene un voucher específico por su ID.

**Características:**
- Retorna el estado de confirmación del voucher
- Genera una URL firmada temporal (válida por 60 minutos) para visualizar la imagen del comprobante
- La URL de visualización es segura y expira automáticamente

**Nota:** Si el voucher no tiene imagen asociada, viewUrl será null.`,
    }),
    ApiParam({
      name: 'id',
      description: 'ID del voucher',
      example: '1',
      type: String,
    }),
    ApiResponse({
      status: 200,
      description: 'Voucher encontrado',
      schema: {
        example: {
          confirmation_status: true,
          url: 'vouchers/voucher_20250115_103045_abc123.jpg',
          viewUrl:
            'https://storage.googleapis.com/bucket-name/vouchers/voucher_20250115_103045_abc123.jpg?X-Goog-Algorithm=GOOG4-RSA-SHA256&X-Goog-Credential=...&X-Goog-Expires=3600',
        },
      },
    }),
    ApiResponse({
      status: 404,
      description: 'Voucher no encontrado',
      schema: {
        example: {
          statusCode: 404,
          message: 'Voucher con ID 999 no encontrado',
          error: 'Not Found',
        },
      },
    }),
  );
}
