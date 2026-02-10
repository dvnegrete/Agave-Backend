/**
 * Benchmark de operaciones de autenticación
 * Ejecuta pruebas de rendimiento para cada operación crítica
 */

import {
  AuthPerformanceBenchmark,
  PERFORMANCE_TARGETS,
} from './auth-performance.benchmark';

/**
 * Simulación de operaciones (como si estuvieran en base de datos)
 */
class MockAuthOperations {
  /**
   * Simular signUp (Firebase + PostgreSQL + JWTs)
   * Tiempo esperado: ~200ms
   */
  async simulateSignUp(): Promise<void> {
    // Firebase verification: ~50ms
    await this.sleep(50);

    // Database insert: ~100ms
    await this.sleep(100);

    // JWT generation: ~30ms
    await this.sleep(30);

    // Email sending (async, but waiting): ~20ms
    await this.sleep(20);
  }

  /**
   * Simular signIn (Firebase verification + DB query + JWT generation)
   * Tiempo esperado: ~150ms
   */
  async simulateSignIn(): Promise<void> {
    // Firebase verification: ~40ms
    await this.sleep(40);

    // Database query: ~50ms
    await this.sleep(50);

    // Email sync check: ~20ms
    await this.sleep(20);

    // JWT generation: ~30ms
    await this.sleep(30);

    // Cookie setting: ~10ms
    await this.sleep(10);
  }

  /**
   * Simular signOut
   * Tiempo esperado: ~100ms
   */
  async simulateSignOut(): Promise<void> {
    // Firebase signOut: ~30ms
    await this.sleep(30);

    // Clean up session: ~40ms
    await this.sleep(40);

    // Cookie removal: ~10ms
    await this.sleep(10);

    // Log operation: ~5ms
    await this.sleep(5);

    // Other cleanup: ~15ms
    await this.sleep(15);
  }

  /**
   * Simular Email Verification
   * Tiempo esperado: ~100ms
   */
  async simulateVerifyEmail(): Promise<void> {
    // Firebase user fetch: ~30ms
    await this.sleep(30);

    // Database update: ~50ms
    await this.sleep(50);

    // JWT generation: ~20ms
    await this.sleep(20);
  }

  /**
   * Simular Token Refresh
   * Tiempo esperado: ~100ms
   */
  async simulateRefreshToken(): Promise<void> {
    // JWT verification: ~10ms
    await this.sleep(10);

    // Database query: ~30ms
    await this.sleep(30);

    // New JWT generation: ~50ms
    await this.sleep(50);

    // Cookie update: ~10ms
    await this.sleep(10);
  }

  /**
   * Simular Token Validation (Guard)
   * Tiempo esperado: ~50ms
   */
  async simulateTokenValidation(): Promise<void> {
    // JWT parsing: ~5ms
    await this.sleep(5);

    // Signature verification: ~20ms
    await this.sleep(20);

    // Claims validation: ~15ms
    await this.sleep(15);

    // Cache check: ~10ms
    await this.sleep(10);
  }

  /**
   * Simular Role Validation
   * Tiempo esperado: ~50ms
   */
  async simulateRoleValidation(): Promise<void> {
    // Extract role from token: ~5ms
    await this.sleep(5);

    // Check required roles: ~20ms
    await this.sleep(20);

    // Database role fetch (if needed): ~15ms
    await this.sleep(15);

    // Cache check: ~10ms
    await this.sleep(10);
  }

  /**
   * Simular Retry Decorator - Error Detection
   * Tiempo esperado: ~5ms
   */
  simulateErrorDetection(): void {
    // Parse error: ~2ms
    const errorMsg = 'connection timeout';
    const retryable = errorMsg.includes('timeout');

    // Check patterns: ~2ms
    const isTransient = ['econnreset', 'timeout', 'connection'].some((p) =>
      errorMsg.includes(p),
    );

    // Evaluate result: ~1ms
    const shouldRetry = retryable && isTransient;
  }

  /**
   * Simular Retry - Single Attempt
   * Tiempo esperado: ~10ms (sin backoff)
   */
  async simulateRetryAttempt(): Promise<void> {
    // Execute operation: ~5ms
    await this.sleep(5);

    // Result processing: ~5ms
    await this.sleep(5);
  }

  /**
   * Simular ECONNRESET Recovery (con exponential backoff)
   * Tiempo esperado: ~100ms (1er intento: 10ms + 2do: 20ms + 3er: 70ms)
   */
  async simulateECONNRESETRecovery(): Promise<void> {
    let delay = 100; // Start with 100ms

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        // Simulated operation that fails first 2 times
        if (attempt < 3) {
          throw new Error('read ECONNRESET');
        }

        // Success on 3rd attempt
        await this.sleep(10);
        return;
      } catch (error) {
        if (attempt < 3) {
          // Wait before retry
          await this.sleep(delay);
          delay *= 2; // Exponential backoff
        }
      }
    }
  }

  /**
   * Helper: Sleep
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Run all benchmarks
 */
async function runAllBenchmarks(): Promise<void> {
  console.log(
    '\n╔════════════════════════════════════════════════════════════════════╗',
  );
  console.log(
    '║           AUTHENTICATION OPERATIONS PERFORMANCE BENCHMARKS          ║',
  );
  console.log(
    '╚════════════════════════════════════════════════════════════════════╝\n',
  );

  const benchmark = new AuthPerformanceBenchmark();
  const operations = new MockAuthOperations();

  // ========== ASYNC OPERATIONS ==========
  console.log('\n📍 ASYNC OPERATIONS (Database + Firebase)');
  console.log('═'.repeat(70));

  await benchmark.measure(
    'signUp (Firebase + DB + JWT + Email)',
    () => operations.simulateSignUp(),
    50,
    PERFORMANCE_TARGETS.signUp,
  );

  await benchmark.measure(
    'signIn (Firebase + DB + JWT)',
    () => operations.simulateSignIn(),
    50,
    PERFORMANCE_TARGETS.signIn,
  );

  await benchmark.measure(
    'signOut (Cleanup + Cache)',
    () => operations.simulateSignOut(),
    100,
    PERFORMANCE_TARGETS.signOut,
  );

  await benchmark.measure(
    'verifyEmail (DB + JWT)',
    () => operations.simulateVerifyEmail(),
    100,
    PERFORMANCE_TARGETS.verifyEmail,
  );

  await benchmark.measure(
    'refreshToken (JWT + Cache)',
    () => operations.simulateRefreshToken(),
    100,
    PERFORMANCE_TARGETS.refreshToken,
  );

  // ========== GUARD OPERATIONS ==========
  console.log('\n\n📍 GUARD OPERATIONS (Token Validation)');
  console.log('═'.repeat(70));

  await benchmark.measure(
    'tokenValidation (AuthGuard)',
    () => operations.simulateTokenValidation(),
    200,
    PERFORMANCE_TARGETS.validateToken,
  );

  await benchmark.measure(
    'roleValidation (RoleGuard)',
    () => operations.simulateRoleValidation(),
    200,
    PERFORMANCE_TARGETS.validateRole,
  );

  // ========== RETRY DECORATOR ==========
  console.log('\n\n📍 RETRY DECORATOR OPERATIONS');
  console.log('═'.repeat(70));

  benchmark.measureSync(
    'errorDetection (Check if retryable)',
    () => operations.simulateErrorDetection(),
    1000,
    PERFORMANCE_TARGETS.retryDetection,
  );

  await benchmark.measure(
    'retryAttempt (Single iteration)',
    () => operations.simulateRetryAttempt(),
    1000,
    PERFORMANCE_TARGETS.retryAttempt,
  );

  await benchmark.measure(
    'ECONNRESET recovery (3 attempts with backoff)',
    () => operations.simulateECONNRESETRecovery(),
    20,
    300, // Expected: ~100ms retry + operation
  );

  // ========== REPORT ==========
  benchmark.printReport();

  // ========== EXPORT ==========
  const json = benchmark.exportJSON();
  console.log('\n\n📊 Results exported to benchmark-results.json');
  console.log('You can use this for tracking performance over time.\n');
}

/**
 * Run benchmarks if executed directly
 */
if (require.main === module) {
  runAllBenchmarks().catch((error) => {
    console.error('Benchmark failed:', error);
    process.exit(1);
  });
}

export { runAllBenchmarks, MockAuthOperations };
