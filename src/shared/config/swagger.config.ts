import { Injectable } from '@nestjs/common';
import { DocumentBuilder, SwaggerCustomOptions } from '@nestjs/swagger';

/**
 * Servicio de configuración Swagger/OpenAPI
 * Centraliza la generación de configuración de documentación de API
 */
@Injectable()
export class SwaggerConfigService {
  /**
   * Crea la configuración del DocumentBuilder para Swagger
   * Define metadata, tags, autenticación y versión de la API
   *
   * @returns DocumentBuilder configurado listo para ser buildeado
   */
  createSwaggerConfig(): DocumentBuilder {
    return new DocumentBuilder()
      .setTitle('Agave Backend API')
      .setDescription(
        'API para gestión de transacciones bancarias, vouchers y conciliación',
      )
      .setVersion('1.0')
      .addTag('vouchers', 'Procesamiento de comprobantes de pago con OCR')
      .addTag('transactions-bank', 'Gestión de transacciones bancarias')
      .addTag('bank-reconciliation', 'Reconciliación de transacciones')
      .addTag('payment-management', 'Gestión de pagos y cuotas')
      .addBearerAuth();
  }

  /**
   * Obtiene las opciones de configuración para SwaggerModule.setup()
   * Define comportamiento y persistencia de autenticación
   *
   * @returns SwaggerCustomOptions para la UI
   */
  getSwaggerSetupOptions(): SwaggerCustomOptions {
    return {
      swaggerOptions: {
        persistAuthorization: true,
      },
    };
  }
}
