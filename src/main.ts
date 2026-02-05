import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ApplicationBootstrapService } from './shared/bootstrap/application-bootstrap.service';
import { BootstrapConfigService } from './shared/config/bootstrap.config';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  try {
    const app = await NestFactory.create(AppModule);

    const bootstrapConfigService = app.get(BootstrapConfigService);
    const applicationBootstrapService = app.get(ApplicationBootstrapService);

    bootstrapConfigService.validateAll();

    await applicationBootstrapService.waitForDatabase();

    // ✅ Configurar la aplicación (CORS, Swagger, cookies, validation)
    await applicationBootstrapService.configure(app);

    const port = bootstrapConfigService.port;
    await app.listen(port, '0.0.0.0');

    // ✅ PASO 7: Log de éxito
    logger.log(`✅ Servidor iniciado en puerto ${port} (0.0.0.0)`);
  } catch (error) {
    const logger = new Logger('Bootstrap');
    logger.error(`❌ Error fatal durante el bootstrap: ${error.message}`);
    process.exit(1);
  }
}

bootstrap();
