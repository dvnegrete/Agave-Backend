import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { DatabaseHealthService } from './shared/health/database-health.service';

/**
 * Valida que todas las variables de entorno críticas estén configuradas
 * Falla rápido si faltan, en lugar de causar problemas silenciosos después
 */
function validateEnvironmentVariables(): void {
  const nodeEnv = process.env.NODE_ENV || 'development';
  const frontendUrl = process.env.FRONTEND_URL;

  console.log(`📋 Environment: ${nodeEnv}`);

  // ❌ CRÍTICO: FRONTEND_URL es obligatorio en TODOS los ambientes
  if (!frontendUrl || frontendUrl.trim() === '') {
    const errorMsg =
      `\n❌ FATAL ERROR: FRONTEND_URL environment variable is missing!\n\n` +
      `This is REQUIRED in all environments for cookie security configuration.\n\n` +
      `   Current NODE_ENV: ${nodeEnv}\n\n` +
      `Configure FRONTEND_URL in your .env:\n` +
      `   - Development: FRONTEND_URL=http://localhost:PORT\n` +
      `   - Staging/Production: FRONTEND_URL=https://your-frontend-domain.com\n\n` +
      `Without FRONTEND_URL, authentication will fail!\n`;

    console.error(errorMsg);
    process.exit(1);
  }

  console.log(`✅ FRONTEND_URL: ${frontendUrl}`);

  // ⚠️ Validar NODE_ENV tiene un valor reconocido
  const validNodeEnvs = ['development', 'staging', 'production', 'test'];
  if (!validNodeEnvs.includes(nodeEnv)) {
    console.warn(
      `⚠️  Warning: NODE_ENV="${nodeEnv}" is not standard. ` +
      `Expected: ${validNodeEnvs.join(', ')}`
    );
  }

  // ✅ Validar que FRONTEND_URL tenga protocolo correcto
  if (!frontendUrl.startsWith('http://') && !frontendUrl.startsWith('https://')) {
    const errorMsg =
      `\n❌ FATAL ERROR: FRONTEND_URL must start with http:// or https://\n\n` +
      `   Current: ${frontendUrl}\n` +
      `   Invalid!\n\n` +
      `Correct examples:\n` +
      `   - http://localhost:PORT\n` +
      `   - https://your-frontend-domain.com\n`;

    console.error(errorMsg);
    process.exit(1);
  }

  // ⚠️ Advertencia si hay conflicto entre NODE_ENV y protocolo FRONTEND_URL
  const isHttps = frontendUrl.startsWith('https://');
  const isProduction = nodeEnv === 'production';
  const isStaging = nodeEnv === 'staging';
  const isDevelopment = nodeEnv === 'development';

  if (isDevelopment && isHttps) {
    console.warn(
      `⚠️  Warning: NODE_ENV=development but FRONTEND_URL is HTTPS. ` +
      `This is unusual but OK if using HTTPS in development.`
    );
  }

  if ((isProduction || isStaging) && !isHttps) {
    const errorMsg =
      `\n❌ FATAL ERROR: NODE_ENV="${nodeEnv}" requires HTTPS but FRONTEND_URL is HTTP!\n\n` +
      `   Current: ${frontendUrl}\n\n` +
      `For ${nodeEnv} environment, FRONTEND_URL must be HTTPS.\n` +
      `This is required for cookie security (secure flag).\n`;

    console.error(errorMsg);
    process.exit(1);
  }

  console.log(`✅ All environment variables validated successfully!\n`);
}


async function bootstrap() {
  // ✅ PASO 1: Validar variables de entorno críticas ANTES de crear la app
  console.log('🔐 Validando configuración de variables de entorno...');
  validateEnvironmentVariables();

  const app = await NestFactory.create(AppModule);

  // ✅ PASO 2: Verificar que la BD está disponible antes de continuar
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

      // Comparar el origin completo (incluyendo protocolo)
      if (origin === frontendUrl) {
        return callback(null, true);
      }

      // Alternativa: comparar solo dominios (para casos con puertos diferentes)
      const originDomain = origin
        .replace(/^https?:\/\//, '')
        .replace(/\/$/, '')  // remover trailing slash
        .split(':')[0];

      const expectedDomain = frontendUrl
        ?.replace(/^https?:\/\//, '')
        .replace(/\/$/, '')  // remover trailing slash
        .split(':')[0];

      if (expectedDomain && originDomain === expectedDomain) {
        return callback(null, true);
      }

      console.warn(`❌ CORS rejected origin: ${origin} (expected: ${frontendUrl})`);
      return callback(null, false);  // ✅ Rechazar sin error (permite respuesta CORS correcta)
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
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
  await app.listen(port, '0.0.0.0');  // ✅ Escuchar en todas las interfaces (requerido para Railway/Docker)

  console.log(`✅ Servidor iniciado en puerto ${port} (0.0.0.0)`);
  console.log(`Swagger UI available at: http://localhost:${port}/api/docs`);
  console.log(
    `OpenAPI JSON available at: http://localhost:${port}/api/docs-json`,
  );
}

bootstrap().catch(error => {
  console.error('❌ Error fatal durante el bootstrap:', error.message);
  process.exit(1);
});
