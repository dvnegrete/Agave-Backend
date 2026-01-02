# Optimización de Connection Pool - Guía Completa

## 1. Estado Actual de la Configuración

### ❌ Problemas Identificados

```typescript
// database.config.ts - Configuración ACTUAL (sin optimización)
return {
  type: 'postgres',
  url: config.url || this.getConnectionString(),
  host: config.host,
  port: config.port,
  username: config.username,
  password: config.password,
  database: config.database,
  ssl: config.ssl ? { rejectUnauthorized: false } : false,
  autoLoadEntities: true,
  synchronize: process.env.NODE_ENV === 'development',
  logging: process.env.NODE_ENV === 'development',
  // ❌ FALTA: Configuración de Connection Pool
  // ❌ FALTA: Timeouts y límites de conexión
  // ❌ FALTA: Configuración de idle connections
};
```

**Consecuencias:**
- ❌ TypeORM usa valores **default** de pool (pequeño)
- ❌ Sin límites en conexiones abiertas
- ❌ Sin timeouts configurados (riesgo de conexiones colgadas)
- ❌ Riesgo de ECONNRESET bajo carga
- ❌ Sin monitoreo de pool

---

## 2. Configuración Actual vs Recomendada

### Pool por Defecto de TypeORM/PostgreSQL

```
DEFAULT (TypeORM):
├─ max: 10 conexiones
├─ idle timeout: 30,000 ms (30 segundos)
└─ Sin validación periódica
```

### Recomendado (Basado en Carga)

```
PRODUCCIÓN:
├─ max: 20 conexiones (x2 del default)
├─ maxQueryQueue: 100
├─ idleTimeoutMillis: 30,000 ms
├─ connectionTimeoutMillis: 5,000 ms
└─ validationQuery: SELECT 1

DESARROLLO:
├─ max: 5 conexiones
├─ maxQueryQueue: 50
├─ idleTimeoutMillis: 10,000 ms
└─ connectionTimeoutMillis: 3,000 ms
```

---

## 3. Solución Mejorada

### A. Configuración Optimizada del Pool

**Archivo:** `src/shared/config/database.config.ts` (MEJORADO)

```typescript
@Injectable()
export class DatabaseConfigService {
  // ... código existente ...

  getTypeOrmConfig(): TypeOrmModuleOptions {
    const config = this.getDatabaseConfig();
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const isDevelopment = this.configService.get<string>('NODE_ENV') === 'development';

    // ✅ Configuración optimizada de pool según ambiente
    const poolConfig = isProduction
      ? this.getProductionPoolConfig()
      : isDevelopment
        ? this.getDevelopmentPoolConfig()
        : this.getDefaultPoolConfig();

    return {
      type: 'postgres',
      url: config.url || this.getConnectionString(),
      host: config.host,
      port: config.port,
      username: config.username,
      password: config.password,
      database: config.database,
      ssl: config.ssl ? { rejectUnauthorized: false } : false,
      autoLoadEntities: true,
      synchronize: isDevelopment,
      logging: isDevelopment,
      migrations: [__dirname + '/../../database/migrations/*{.ts,.js}'],
      migrationsRun: false,

      // ✅ NUEVO: Pool Configuration
      maxConnections: poolConfig.maxConnections,
      maxQueryQueue: poolConfig.maxQueryQueue,
      idleTimeoutMillis: poolConfig.idleTimeoutMillis,
      connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,

      // ✅ NUEVO: Connection Validation
      connectionTestQuery: 'SELECT 1',

      // ✅ NUEVO: Logging de conexiones
      ...(isDevelopment && {
        extra: {
          max: poolConfig.maxConnections,
          idleTimeoutMillis: poolConfig.idleTimeoutMillis,
          connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
          allowExitOnIdle: false, // Mantener conexiones vivas
        },
      }),
    };
  }

  // ✅ NUEVO: Configuración específica por ambiente
  private getProductionPoolConfig() {
    return {
      maxConnections: 20,           // Max 20 conexiones simultáneas
      maxQueryQueue: 100,           // Max 100 queries esperando
      idleTimeoutMillis: 30000,     // 30 segundos de timeout idle
      connectionTimeoutMillis: 5000, // 5 segundos para conectar
    };
  }

  private getDevelopmentPoolConfig() {
    return {
      maxConnections: 5,            // Max 5 conexiones (menos recursos)
      maxQueryQueue: 50,
      idleTimeoutMillis: 10000,     // 10 segundos
      connectionTimeoutMillis: 3000, // 3 segundos
    };
  }

  private getDefaultPoolConfig() {
    return {
      maxConnections: 10,
      maxQueryQueue: 50,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 4000,
    };
  }
}
```

---

## 4. Mejores Prácticas en el Código

### ❌ ANTES: Sin optimización de pool

```typescript
// confirm-voucher-frontend.use-case.ts (INCORRECTO)
async execute(input: ConfirmVoucherFrontendInput) {
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();

  // ❌ Conexión abierta indefinidamente
  // ❌ Si falla algo, leak de conexión

  try {
    // ...
  } finally {
    await queryRunner.release();
  }
}
```

### ✅ DESPUÉS: Con mejores prácticas

```typescript
// confirm-voucher-frontend.use-case.ts (CORRECTO)
async execute(input: ConfirmVoucherFrontendInput) {
  // ✅ Validaciones SIN conexión primero
  const amount = parseFloat(monto);
  if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
    throw new BadRequestException(...);
  }

  // ✅ Operaciones independientes ANTES de QueryRunner
  const duplicateCheck = await this.duplicateDetector.detectDuplicate(...);
  const generateResult = await generateUniqueConfirmationCode(...);

  // ✅ QueryRunner SOLO para la transacción crítica
  const queryRunner = this.dataSource.createQueryRunner();
  await queryRunner.connect();

  let startedTransaction = false;
  try {
    await queryRunner.startTransaction();
    startedTransaction = true;

    // ... operaciones ...

    await queryRunner.commitTransaction();
  } catch (error) {
    if (startedTransaction) {
      await queryRunner.rollbackTransaction();
    }
    throw error;
  } finally {
    await queryRunner.release(); // ✅ Siempre liberar
  }
}
```

---

## 5. Alternativas a QueryRunner (Comparación)

### Opción 1: QueryRunner (ACTUAL)
```typescript
✅ Control total de transacciones
✅ Perfecto para transacciones complejas
❌ Requiere gestión manual de conexión
❌ Más verbose
❌ Riesgo de leak si no se libera bien
```

### Opción 2: Repository Transactions (RECOMENDADO para casos simples)
```typescript
// Más simple, automático
await this.dataSource.transaction(async (manager) => {
  await manager.save(user);
  await manager.save(house);
});

✅ Automático - no necesita liberar
✅ Menos código
✅ Menos error-prone
❌ Menos control granular
```

### Opción 3: DataSource.query() (INCORRECTO para transacciones)
```typescript
// ❌ NO usar para transacciones
await this.dataSource.query('UPDATE ...');

❌ Sin control de transacción
❌ Auto-commit
❌ Peligroso para operaciones relacionadas
```

---

## 6. Implementación: Usar transaction() cuando sea posible

### Refactorización del uso case (ALTERNATIVA MEJORADA)

```typescript
import { DataSource } from 'typeorm';

@Injectable()
export class ConfirmVoucherFrontendUseCase {
  constructor(
    private readonly dataSource: DataSource,
    private readonly voucherRepository: VoucherRepository,
    // ... otros repositorios ...
  ) {}

  async execute(input: ConfirmVoucherFrontendInput): Promise<ConfirmVoucherFrontendOutput> {
    // Validaciones primero (sin BD)
    const amount = parseFloat(input.monto);
    if (isNaN(amount) || !isFinite(amount) || amount <= 0) {
      throw new BadRequestException(...);
    }

    // Operaciones de BD ANTES de transacción
    const duplicateCheck = await this.duplicateDetector.detectDuplicate(...);
    if (duplicateCheck.isDuplicate) {
      throw new ConflictException(...);
    }

    // ✅ MEJOR: Usar transaction() en lugar de QueryRunner
    return await this.dataSource.transaction(async (manager) => {
      // Toda la lógica transaccional aquí

      // Crear usuario si es necesario
      let user = null;
      if (input.userId) {
        user = await manager.findOne(User, { where: { id: input.userId } });
        if (!user) {
          user = manager.create(User, {
            id: input.userId,
            cel_phone: 0,
            role: Role.TENANT,
            status: Status.ACTIVE,
          });
          await manager.save(user);
        }
      }

      // Crear o buscar casa
      let house = await manager.findOne(House, {
        where: { number_house: input.casa },
      });
      if (!house) {
        house = manager.create(House, {
          number_house: input.casa,
          user_id: user?.id || '',
        });
        await manager.save(house);
      }

      // Crear record
      const record = manager.create(Record, {
        vouchers_id: voucher.id,
        transaction_status_id: null,
        // ... otros campos ...
      });
      await manager.save(record);

      // Crear house record
      const houseRecord = manager.create(HouseRecord, {
        house_id: house.id,
        record_id: record.id,
      });
      await manager.save(houseRecord);

      return {
        success: true,
        confirmationCode: generateResult.code,
        voucher: { /* ... */ },
      };
    });
    // ✅ Transacción automáticamente comprometida o revertida
  }
}
```

---

## 7. Monitoreo y Debug

### ✅ Logging de Conexiones

```typescript
// database.module.ts
getTypeOrmConfig(): TypeOrmModuleOptions {
  return {
    // ... configuración ...

    extra: {
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,

      // ✅ Logging de pool
      ...(isDevelopment && {
        log: (message: string) => {
          console.log(`[DB POOL] ${message}`);
        },
      }),
    },

    // ✅ Logging de queries
    logging: isDevelopment ? ['query', 'error', 'warn'] : ['error'],
  };
}
```

### ✅ Health Check de Conexión

```typescript
// shared/health/database.health.ts
import { Injectable } from '@nestjs/common';
import { HealthCheckService, HealthIndicatorResult, DatabaseHealthIndicator } from '@nestjs/terminus';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseHealthCheck implements HealthIndicator {
  constructor(
    private readonly dataSource: DataSource,
  ) {}

  async checkDatabaseHealth(): Promise<HealthIndicatorResult> {
    try {
      // ✅ Test conexión al pool
      await this.dataSource.query('SELECT 1');

      // ✅ Obtener stats del pool
      const poolSize = (this.dataSource.driver as any)?.connectedClient?.totalCount;

      return {
        database: {
          status: 'up',
          poolSize: poolSize || 'unknown',
        },
      };
    } catch (error) {
      return {
        database: {
          status: 'down',
          error: error.message,
        },
      };
    }
  }
}
```

---

## 8. Configuración de Variables de Entorno

### `.env.example`

```bash
# Database Connection Pool Configuration
DATABASE_URL=postgresql://user:password@localhost:5432/agave_db
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=user
DB_PASSWORD=password
DB_NAME=agave_db

# Pool Configuration (NUEVO)
DB_POOL_MAX=20              # Max connections
DB_POOL_IDLE_TIMEOUT=30000  # 30 segundos
DB_POOL_CONNECT_TIMEOUT=5000 # 5 segundos
DB_POOL_MAX_QUEUE=100       # Max queries waiting
```

---

## 9. Resumen de Mejores Prácticas

### ✅ DO's

1. **Pool Configuration** - Configurar según ambiente
2. **Validaciones Primero** - Antes de tomar conexiones
3. **Use transaction()** - Para transacciones simples
4. **Always Release** - En try-finally siempre liberar
5. **Logging de Pool** - Monitorear en desarrollo
6. **Connection Tests** - Validar conexiones periódicamente
7. **Timeouts** - Configurar para evitar conexiones colgadas
8. **Reutilizar Conexiones** - El pool lo hace automáticamente

### ❌ DON'Ts

1. **No usar QueryRunner sin necesidad** - Usa transaction()
2. **No crear múltiples QueryRunner** - Usa el pool
3. **No olvidar release()** - Leak de conexiones
4. **No usar Unlimited Pool** - Configura max
5. **No usar connect() sin disconnect** - Siempre cleanup
6. **No ignorar timeouts** - Conexiones colgadas
7. **No mezclar QueryRunner con repositorios** - Confusión
8. **No transacciones anidadas sin cuidado** - TypeORM no soporta bien

---

## 10. Comparación: Antes vs Después

### ANTES (Actual - Sin optimización)
```
├─ Pool: Default (10 conexiones)
├─ Sin timeout configurado
├─ QueryRunner sin gestión
├─ Riesgo: ECONNRESET bajo carga
├─ Riesgo: Leak de conexiones
└─ Rendimiento: Regular
```

### DESPUÉS (Con optimización)
```
├─ Pool: 20 conexiones (producción) / 5 (desarrollo)
├─ Timeouts configurados
├─ transaction() para casos simples
├─ QueryRunner solo cuando necesario
├─ Health checks disponibles
└─ Rendimiento: Excelente bajo carga
```

---

## 11. Plan de Implementación

### Fase 1: Configuración (CRÍTICA)
- [ ] Actualizar `database.config.ts` con pool configuration
- [ ] Agregar variables de entorno en `.env`
- [ ] Configurar distintos pools por ambiente

### Fase 2: Refactorización (RECOMENDADA)
- [ ] Convertir QueryRunner a transaction() donde sea posible
- [ ] Revisar confirm-voucher-frontend.use-case.ts
- [ ] Revisar otros use cases con transacciones

### Fase 3: Monitoreo (OPCIONAL)
- [ ] Agregar health checks
- [ ] Logging de pool en desarrollo
- [ ] Metricas de pool

---

## 12. Referencias y Lecturas

- [TypeORM Connection Options](https://typeorm.io/data-source-options)
- [PostgreSQL pg Pool Docs](https://node-postgres.com/api/pool)
- [NestJS TypeORM](https://docs.nestjs.com/techniques/database)
- [Connection Pool Management](https://en.wikipedia.org/wiki/Connection_pool)
- [TypeORM Transactions](https://typeorm.io/transactions)

---

## Conclusión

La solución actual (con QueryRunner reordenado) **funciona bien**, pero implementar la **configuración de pool optimizada** es fundamental para:

✅ Mejor rendimiento bajo carga
✅ Prevenir ECONNRESET
✅ Mejor uso de recursos
✅ Código más limpio (usando transaction())
✅ Escalabilidad en producción
