import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DatabaseHealthService } from './shared/health/database-health.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Verificar que la BD está disponible antes de continuar
  // Reintentos automáticos con backoff exponencial: 1 intento inicial,
  // luego espera 2s, 4s, 8s si es necesario
  console.log('🔍 Verificando conectividad con la Base de Datos...');
  const databaseHealthService = app.get(DatabaseHealthService);
  try {
    await databaseHealthService.waitForDatabase(3, 2000);
  } catch (error) {
    console.error(
      '❌ No se puede conectar a la Base de Datos. Deteniendo aplicación.',
    );
    process.exit(1);
  }

  // Habilitar validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Habilitar CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true,
  });

  // Configurar Swagger/OpenAPI
  const config = new DocumentBuilder()
    .setTitle('Agave Backend API')
    .setDescription(
      'API para gestión de transacciones bancarias, vouchers y conciliación',
    )
    .setVersion('1.0')
    .addTag('vouchers', 'Procesamiento de comprobantes de pago con OCR')
    .addTag('transactions-bank', 'Gestión de transacciones bancarias')
    .addTag('bank-reconciliation', 'Reconciliación de transacciones')
    .addTag('payment-management', 'Gestión de pagos y cuotas')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Exponer en /api/docs
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Exponer el JSON de OpenAPI en /api/docs-json para generación de cliente
  SwaggerModule.setup('api/docs-json', app, document, {
    jsonDocumentUrl: '/api/docs-json',
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  console.log(`✅ Servidor iniciado en puerto ${port}`);
  console.log(`📚 Swagger UI available at: http://localhost:${port}/api/docs`);
  console.log(
    `📄 OpenAPI JSON available at: http://localhost:${port}/api/docs-json`,
  );
}

bootstrap().catch(error => {
  console.error('❌ Error fatal durante el bootstrap:', error.message);
  process.exit(1);
});
