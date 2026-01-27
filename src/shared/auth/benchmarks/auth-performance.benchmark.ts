/**
 * Performance Benchmarks para AuthService
 * Mide el tiempo de ejecución de operaciones críticas de autenticación
 *
 * Ejecución:
 *   npm run benchmark
 */

import { performance } from 'perf_hooks';

interface BenchmarkResult {
  operation: string;
  iterations: number;
  totalTime: number; // ms
  avgTime: number; // ms
  minTime: number; // ms
  maxTime: number; // ms
  opsPerSecond: number;
  status: 'PASS' | 'FAIL';
  targetMs: number;
  actualVsTarget: string; // e.g., "1.5x slower"
}

/**
 * Benchmark base class
 */
export class AuthPerformanceBenchmark {
  private results: BenchmarkResult[] = [];

  /**
   * Medir tiempo de ejecución de una función
   */
  async measure(
    name: string,
    fn: () => Promise<void>,
    iterations: number = 100,
    targetMs: number = 100,
  ): Promise<BenchmarkResult> {
    console.log(`\n⏱️  Benchmarking: ${name}`);
    console.log(`   Iterations: ${iterations}, Target: ${targetMs}ms`);

    const times: number[] = [];

    // Warmup
    for (let i = 0; i < 5; i++) {
      await fn();
    }

    // Actual benchmark
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await fn();
      const end = performance.now();
      times.push(end - start);
    }

    const totalTime = times.reduce((a, b) => a + b, 0);
    const avgTime = totalTime / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const opsPerSecond = (iterations / totalTime) * 1000;

    const status = avgTime <= targetMs ? 'PASS' : 'FAIL';
    const ratio = avgTime / targetMs;
    const actualVsTarget =
      ratio <= 1.0
        ? `✅ ${(ratio * 100).toFixed(0)}% of target`
        : `⚠️  ${(ratio * 100).toFixed(0)}% of target (${(ratio - 1).toFixed(1)}x slower)`;

    const result: BenchmarkResult = {
      operation: name,
      iterations,
      totalTime,
      avgTime,
      minTime,
      maxTime,
      opsPerSecond,
      status,
      targetMs,
      actualVsTarget,
    };

    this.results.push(result);

    // Print result
    console.log(`   Total: ${totalTime.toFixed(2)}ms`);
    console.log(`   Avg:   ${avgTime.toFixed(2)}ms (target: ${targetMs}ms)`);
    console.log(`   Range: ${minTime.toFixed(2)}ms - ${maxTime.toFixed(2)}ms`);
    console.log(`   Ops/s: ${opsPerSecond.toFixed(0)}`);
    console.log(`   ${actualVsTarget}`);
    console.log(`   Status: ${status}`);

    return result;
  }

  /**
   * Medir tiempo síncrono
   */
  measureSync(
    name: string,
    fn: () => void,
    iterations: number = 1000,
    targetMs: number = 10,
  ): BenchmarkResult {
    console.log(`\n⏱️  Benchmarking: ${name}`);
    console.log(`   Iterations: ${iterations}, Target: ${targetMs}ms`);

    const times: number[] = [];

    // Warmup
    for (let i = 0; i < 10; i++) {
      fn();
    }

    // Actual benchmark
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      fn();
      const end = performance.now();
      times.push(end - start);
    }

    const totalTime = times.reduce((a, b) => a + b, 0);
    const avgTime = totalTime / iterations;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    const opsPerSecond = (iterations / totalTime) * 1000;

    const status = avgTime <= targetMs ? 'PASS' : 'FAIL';
    const ratio = avgTime / targetMs;
    const actualVsTarget =
      ratio <= 1.0
        ? `✅ ${(ratio * 100).toFixed(0)}% of target`
        : `⚠️  ${(ratio * 100).toFixed(0)}% of target`;

    const result: BenchmarkResult = {
      operation: name,
      iterations,
      totalTime,
      avgTime,
      minTime,
      maxTime,
      opsPerSecond,
      status,
      targetMs,
      actualVsTarget,
    };

    this.results.push(result);

    console.log(`   Total: ${totalTime.toFixed(2)}ms`);
    console.log(`   Avg:   ${avgTime.toFixed(2)}ms (target: ${targetMs}ms)`);
    console.log(`   Range: ${minTime.toFixed(2)}ms - ${maxTime.toFixed(2)}ms`);
    console.log(`   Ops/s: ${opsPerSecond.toFixed(0)}`);
    console.log(`   ${actualVsTarget}`);
    console.log(`   Status: ${status}`);

    return result;
  }

  /**
   * Generar reporte
   */
  printReport(): void {
    console.log('\n' + '='.repeat(80));
    console.log('PERFORMANCE BENCHMARK REPORT');
    console.log('='.repeat(80) + '\n');

    // Summary table
    console.log('SUMMARY:');
    console.log('─'.repeat(80));
    console.log(
      'Operation'.padEnd(30) +
        'Avg (ms)'.padEnd(15) +
        'Target (ms)'.padEnd(15) +
        'Ops/s'.padEnd(15) +
        'Status',
    );
    console.log('─'.repeat(80));

    let passCount = 0;
    let failCount = 0;

    this.results.forEach((result) => {
      console.log(
        result.operation.padEnd(30) +
          result.avgTime.toFixed(2).padEnd(15) +
          result.targetMs.toString().padEnd(15) +
          result.opsPerSecond.toFixed(0).padEnd(15) +
          result.status,
      );

      if (result.status === 'PASS') passCount++;
      else failCount++;
    });

    console.log('─'.repeat(80));
    console.log(`\nTotal: ${this.results.length} benchmarks`);
    console.log(`Passed: ${passCount} ✅`);
    console.log(`Failed: ${failCount} ❌`);

    // Details
    console.log('\n' + 'DETAILS:');
    console.log('─'.repeat(80));
    this.results.forEach((result) => {
      console.log(`\n${result.operation}:`);
      console.log(`  Avg Time:     ${result.avgTime.toFixed(2)}ms`);
      console.log(`  Min Time:     ${result.minTime.toFixed(2)}ms`);
      console.log(`  Max Time:     ${result.maxTime.toFixed(2)}ms`);
      console.log(`  Total Time:   ${result.totalTime.toFixed(2)}ms`);
      console.log(`  Iterations:   ${result.iterations}`);
      console.log(`  Ops/Second:   ${result.opsPerSecond.toFixed(0)}`);
      console.log(`  Target:       ${result.targetMs}ms`);
      console.log(`  Result:       ${result.actualVsTarget}`);
      console.log(`  Status:       ${result.status}`);
    });

    console.log('\n' + '='.repeat(80));
  }

  /**
   * Exportar resultados a JSON
   */
  exportJSON(): string {
    return JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        results: this.results,
        summary: {
          total: this.results.length,
          passed: this.results.filter((r) => r.status === 'PASS').length,
          failed: this.results.filter((r) => r.status === 'FAIL').length,
        },
      },
      null,
      2,
    );
  }

  /**
   * Obtener resultados
   */
  getResults(): BenchmarkResult[] {
    return this.results;
  }
}

/**
 * Performance targets (ms) para operaciones críticas
 */
export const PERFORMANCE_TARGETS = {
  // Auth operations
  signUp: 200, // 200ms
  signIn: 150, // 150ms
  signOut: 100, // 100ms
  verifyEmail: 100, // 100ms
  refreshToken: 100, // 100ms

  // Guard operations
  validateToken: 50, // 50ms
  validateRole: 50, // 50ms

  // Retry operations
  retryAttempt: 10, // 10ms per attempt (after backoff)
  retryDetection: 5, // 5ms to detect if retryable

  // Database operations
  dbQuery: 50, // 50ms for simple queries
  dbInsert: 100, // 100ms for inserts
};

/**
 * Load test constants
 */
export const LOAD_TEST_CONFIG = {
  // Concurrency levels
  LOW: 10, // 10 concurrent
  MEDIUM: 50, // 50 concurrent
  HIGH: 100, // 100 concurrent
  EXTREME: 500, // 500 concurrent

  // Duration in seconds
  DURATION: {
    QUICK: 10,
    STANDARD: 30,
    EXTENDED: 60,
  },

  // Success rate expectations
  SUCCESS_RATE_TARGET: 0.99, // 99% success rate
  ERROR_RATE_THRESHOLD: 0.01, // 1% error rate threshold
};
