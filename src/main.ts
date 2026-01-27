import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
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
    await databaseHealthService.waitForDatabase(3, 3000);
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

  // Habilitar CORS con validación dinámica del origen
  const frontendUrl = process.env.FRONTEND_URL;

  app.enableCors({
    origin: (origin, callback) => {
      // En desarrollo local (sin origin en peticiones same-origin)
      if (!origin) {
        return callback(null, true);
      }

      // Extraer dominio del origin (remover protocolo y puerto)
      const originDomain = origin
        .replace(/^https?:\/\//, '')
        .split(':')[0];

      const expectedDomain = frontendUrl
        ?.replace(/^https?:\/\//, '')
        .split(':')[0];

      if (expectedDomain && originDomain === expectedDomain) {
        callback(null, true);
      } else {
        console.warn(`❌ CORS rejected origin: ${origin} (expected: ${frontendUrl})`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Habilitar lectura de cookies
  app.use(cookieParser());

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
  console.log(`Swagger UI available at: http://localhost:${port}/api/docs`);
  console.log(
    `OpenAPI JSON available at: http://localhost:${port}/api/docs-json`,
  );
}

bootstrap().catch(error => {
  console.error('❌ Error fatal durante el bootstrap:', error.message);
  process.exit(1);
});
