import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
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

  console.log(`📚 Swagger UI available at: http://localhost:${port}/api/docs`);
  console.log(
    `📄 OpenAPI JSON available at: http://localhost:${port}/api/docs-json`,
  );
}

bootstrap();
