/**
 * Load Testing para AuthService
 * Simula múltiples usuarios concurrentes
 */

import { performance } from 'perf_hooks';
import { LOAD_TEST_CONFIG } from './auth-performance.benchmark';

interface LoadTestResult {
  testName: string;
  concurrency: number;
  duration: number; // seconds
  totalRequests: number;
  successRequests: number;
  failedRequests: number;
  successRate: number; // percentage
  avgResponseTime: number; // ms
  minResponseTime: number; // ms
  maxResponseTime: number; // ms
  requestsPerSecond: number;
  p95ResponseTime: number; // ms
  p99ResponseTime: number; // ms
  status: 'PASS' | 'FAIL';
}

/**
 * Load tester
 */
class LoadTester {
  private results: LoadTestResult[] = [];

  /**
   * Run load test
   */
  async runLoadTest(
    testName: string,
    operationFn: () => Promise<void>,
    concurrency: number,
    durationSeconds: number,
  ): Promise<LoadTestResult> {
    console.log(`\n🔥 Load Test: ${testName}`);
    console.log(`   Concurrency: ${concurrency} concurrent users`);
    console.log(`   Duration: ${durationSeconds} seconds`);

    const responseTimes: number[] = [];
    let successCount = 0;
    let failureCount = 0;
    const startTime = performance.now();
    const endTimeTarget = startTime + durationSeconds * 1000;

    // Worker function
    const worker = async () => {
      while (performance.now() < endTimeTarget) {
        try {
          const opStart = performance.now();
          await operationFn();
          const opEnd = performance.now();

          responseTimes.push(opEnd - opStart);
          successCount++;
        } catch (error) {
          failureCount++;
        }
      }
    };

    // Run concurrent workers
    const workers = Array.from({ length: concurrency }).map(() => worker());
    await Promise.all(workers);

    const endTime = performance.now();
    const totalTime = (endTime - startTime) / 1000; // Convert to seconds

    // Calculate metrics
    const totalRequests = successCount + failureCount;
    const successRate = (successCount / totalRequests) * 100;
    const avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
    const minResponseTime = Math.min(...responseTimes);
    const maxResponseTime = Math.max(...responseTimes);
    const requestsPerSecond = totalRequests / totalTime;

    // Calculate percentiles
    const sortedTimes = responseTimes.sort((a, b) => a - b);
    const p95Index = Math.floor(sortedTimes.length * 0.95);
    const p99Index = Math.floor(sortedTimes.length * 0.99);
    const p95ResponseTime = sortedTimes[p95Index] || 0;
    const p99ResponseTime = sortedTimes[p99Index] || 0;

    // Determine status
    const status =
      successRate >= LOAD_TEST_CONFIG.SUCCESS_RATE_TARGET * 100 ? 'PASS' : 'FAIL';

    const result: LoadTestResult = {
      testName,
      concurrency,
      duration: totalTime,
      totalRequests,
      successRequests: successCount,
      failedRequests: failureCount,
      successRate,
      avgResponseTime,
      minResponseTime,
      maxResponseTime,
      requestsPerSecond,
      p95ResponseTime,
      p99ResponseTime,
      status,
    };

    this.results.push(result);

    // Print result
    console.log(`   Total Requests: ${totalRequests}`);
    console.log(`   Success Rate: ${successRate.toFixed(2)}%`);
    console.log(`   Avg Response: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`   Min/Max: ${minResponseTime.toFixed(2)}ms / ${maxResponseTime.toFixed(2)}ms`);
    console.log(`   P95/P99: ${p95ResponseTime.toFixed(2)}ms / ${p99ResponseTime.toFixed(2)}ms`);
    console.log(`   RPS: ${requestsPerSecond.toFixed(0)}`);
    console.log(`   Status: ${status}`);

    return result;
  }

  /**
   * Print report
   */
  printReport(): void {
    console.log('\n' + '='.repeat(100));
    console.log('LOAD TEST REPORT');
    console.log('='.repeat(100) + '\n');

    // Summary table
    console.log('SUMMARY:');
    console.log('─'.repeat(100));
    console.log(
      'Test Name'.padEnd(25) +
        'Concurrency'.padEnd(15) +
        'Requests'.padEnd(15) +
        'Success %'.padEnd(15) +
        'Avg (ms)'.padEnd(15) +
        'P95 (ms)'.padEnd(15) +
        'RPS'.padEnd(10) +
        'Status',
    );
    console.log('─'.repeat(100));

    let passCount = 0;
    let failCount = 0;

    this.results.forEach((result) => {
      console.log(
        result.testName.slice(0, 24).padEnd(25) +
          result.concurrency.toString().padEnd(15) +
          result.totalRequests.toString().padEnd(15) +
          result.successRate.toFixed(2).padEnd(15) +
          result.avgResponseTime.toFixed(2).padEnd(15) +
          result.p95ResponseTime.toFixed(2).padEnd(15) +
          result.requestsPerSecond.toFixed(0).padEnd(10) +
          result.status,
      );

      if (result.status === 'PASS') passCount++;
      else failCount++;
    });

    console.log('─'.repeat(100));
    console.log(`\nTotal: ${this.results.length} load tests`);
    console.log(`Passed: ${passCount} ✅`);
    console.log(`Failed: ${failCount} ❌`);

    // Details
    console.log('\n' + 'DETAILED RESULTS:');
    console.log('─'.repeat(100));
    this.results.forEach((result) => {
      console.log(`\n${result.testName}:`);
      console.log(`  Concurrency:      ${result.concurrency} users`);
      console.log(`  Duration:         ${result.duration.toFixed(1)} seconds`);
      console.log(`  Total Requests:   ${result.totalRequests}`);
      console.log(`  Successful:       ${result.successRequests}`);
      console.log(`  Failed:           ${result.failedRequests}`);
      console.log(`  Success Rate:     ${result.successRate.toFixed(2)}%`);
      console.log(`  Avg Response:     ${result.avgResponseTime.toFixed(2)}ms`);
      console.log(`  Min Response:     ${result.minResponseTime.toFixed(2)}ms`);
      console.log(`  Max Response:     ${result.maxResponseTime.toFixed(2)}ms`);
      console.log(`  P95 Response:     ${result.p95ResponseTime.toFixed(2)}ms`);
      console.log(`  P99 Response:     ${result.p99ResponseTime.toFixed(2)}ms`);
      console.log(`  Requests/sec:     ${result.requestsPerSecond.toFixed(0)}`);
      console.log(`  Status:           ${result.status}`);
    });

    console.log('\n' + '='.repeat(100));
  }

  /**
   * Export to JSON
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
}

/**
 * Mock operations for load testing
 */
class MockLoadOperations {
  private failureRate: number = 0.01; // 1% failure rate

  async simulateAuthOperation(): Promise<void> {
    // Simulate random failure
    if (Math.random() < this.failureRate) {
      throw new Error('Simulated failure');
    }

    // Simulate operation time: 50-150ms
    const operationTime = 50 + Math.random() * 100;
    await this.sleep(operationTime);
  }

  async simulateHighLoadOperation(): Promise<void> {
    // Simulate higher failure rate under high load
    const loadFailureRate = 0.02; // 2% under high load
    if (Math.random() < loadFailureRate) {
      throw new Error('High load failure');
    }

    // Simulate operation time: 100-300ms
    const operationTime = 100 + Math.random() * 200;
    await this.sleep(operationTime);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Run load tests
 */
async function runLoadTests(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                      LOAD TESTING BENCHMARKS                       ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝\n');

  const tester = new LoadTester();
  const operations = new MockLoadOperations();

  // Test 1: Low concurrency
  console.log('\n📍 SCENARIO 1: Low Load (Normal Traffic)');
  console.log('═'.repeat(70));
  await tester.runLoadTest(
    'signIn - Low Load',
    () => operations.simulateAuthOperation(),
    LOAD_TEST_CONFIG.LOW, // 10 concurrent
    LOAD_TEST_CONFIG.DURATION.QUICK, // 10 seconds
  );

  // Test 2: Medium concurrency
  console.log('\n📍 SCENARIO 2: Medium Load (Peak Traffic)');
  console.log('═'.repeat(70));
  await tester.runLoadTest(
    'signIn - Medium Load',
    () => operations.simulateAuthOperation(),
    LOAD_TEST_CONFIG.MEDIUM, // 50 concurrent
    LOAD_TEST_CONFIG.DURATION.STANDARD, // 30 seconds
  );

  // Test 3: High concurrency
  console.log('\n📍 SCENARIO 3: High Load (Traffic Spike)');
  console.log('═'.repeat(70));
  await tester.runLoadTest(
    'signIn - High Load',
    () => operations.simulateAuthOperation(),
    LOAD_TEST_CONFIG.HIGH, // 100 concurrent
    LOAD_TEST_CONFIG.DURATION.STANDARD, // 30 seconds
  );

  // Test 4: Extreme concurrency (stress test)
  console.log('\n📍 SCENARIO 4: Extreme Load (Stress Test)');
  console.log('═'.repeat(70));
  await tester.runLoadTest(
    'signIn - Extreme Load',
    () => operations.simulateHighLoadOperation(),
    LOAD_TEST_CONFIG.EXTREME, // 500 concurrent
    LOAD_TEST_CONFIG.DURATION.QUICK, // 10 seconds (shorter for safety)
  );

  // Report
  tester.printReport();
}

/**
 * Run if executed directly
 */
if (require.main === module) {
  runLoadTests().catch((error) => {
    console.error('Load test failed:', error);
    process.exit(1);
  });
}

export { runLoadTests, LoadTester };
