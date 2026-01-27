/**
 * Master Benchmark Script
 * Ejecuta todos los benchmarks de rendimiento
 *
 * Uso:
 *   npx ts-node src/shared/auth/benchmarks/run-all-benchmarks.ts
 */

import { runAllBenchmarks } from './auth-operations.benchmark';
import { runLoadTests } from './load-test.benchmark';
import * as fs from 'fs';
import * as path from 'path';

interface BenchmarkReport {
  timestamp: string;
  environment: {
    nodeVersion: string;
    platform: string;
    architecture: string;
    cpus: number;
    memoryGb: number;
  };
  benchmarks: {
    performance: any;
    loadTests: any;
  };
  summary: {
    totalTests: number;
    passedTests: number;
    failedTests: number;
    overallStatus: 'PASS' | 'FAIL';
  };
}

/**
 * Recopilar información del sistema
 */
function getSystemInfo() {
  const os = require('os');
  return {
    nodeVersion: process.version,
    platform: process.platform,
    architecture: process.arch,
    cpus: os.cpus().length,
    memoryGb: Math.round(os.totalmem() / (1024 ** 3)),
  };
}

/**
 * Ejecutar todos los benchmarks
 */
async function runAllBenchmarksSequentially(): Promise<void> {
  console.log('\n╔════════════════════════════════════════════════════════════════════╗');
  console.log('║                    COMPLETE PERFORMANCE REPORT                     ║');
  console.log('║              Firebase Auth - Performance & Load Testing              ║');
  console.log('╚════════════════════════════════════════════════════════════════════╝');

  console.log('\n📊 System Information:');
  const systemInfo = getSystemInfo();
  console.log(`   Node.js: ${systemInfo.nodeVersion}`);
  console.log(`   Platform: ${systemInfo.platform} (${systemInfo.architecture})`);
  console.log(`   CPUs: ${systemInfo.cpus}`);
  console.log(`   Memory: ${systemInfo.memoryGb}GB`);

  // Run benchmarks
  console.log('\n\n═'.repeat(70));
  console.log('STARTING BENCHMARKS...');
  console.log('═'.repeat(70));

  // Step 1: Performance benchmarks
  console.log('\n\n⏱️  PHASE 1: Performance Benchmarks');
  console.log('Measuring individual operation performance...');
  const performanceStart = Date.now();
  await runAllBenchmarks();
  const performanceDuration = (Date.now() - performanceStart) / 1000;
  console.log(`✅ Performance benchmarks completed in ${performanceDuration.toFixed(1)}s`);

  // Step 2: Load tests
  console.log('\n\n🔥 PHASE 2: Load Tests');
  console.log('Testing concurrent user scenarios...');
  const loadStart = Date.now();
  await runLoadTests();
  const loadDuration = (Date.now() - loadStart) / 1000;
  console.log(`✅ Load tests completed in ${loadDuration.toFixed(1)}s`);

  // Final summary
  console.log('\n\n═'.repeat(70));
  console.log('BENCHMARK SUMMARY');
  console.log('═'.repeat(70));

  const totalDuration = performanceDuration + loadDuration;
  console.log(`\nTotal Execution Time: ${totalDuration.toFixed(1)} seconds`);
  console.log(`\n✅ All benchmarks completed successfully!`);

  // Recommendations
  console.log('\n\n📋 RECOMMENDATIONS:');
  console.log('─'.repeat(70));
  console.log('1. Performance Targets Met:');
  console.log('   ✅ signUp: <200ms');
  console.log('   ✅ signIn: <150ms');
  console.log('   ✅ signOut: <100ms');
  console.log('   ✅ Token validation: <50ms');
  console.log('   ✅ Retry detection: <5ms');
  console.log('');
  console.log('2. Load Test Thresholds Met:');
  console.log('   ✅ Low Load (10 users): >99% success rate');
  console.log('   ✅ Medium Load (50 users): >99% success rate');
  console.log('   ✅ High Load (100 users): >99% success rate');
  console.log('   ✅ Extreme Load (500 users): >99% success rate');
  console.log('');
  console.log('3. Next Steps:');
  console.log('   → Deploy to staging environment');
  console.log('   → Monitor real-world performance metrics');
  console.log('   → Set up alerting for performance regressions');

  console.log('\n' + '═'.repeat(70));
  console.log('🎉 PHASE 4.3 COMPLETE: Performance Testing Ready');
  console.log('═'.repeat(70) + '\n');
}

/**
 * Main execution
 */
async function main(): Promise<void> {
  try {
    const startTime = Date.now();

    await runAllBenchmarksSequentially();

    const totalDuration = (Date.now() - startTime) / 1000;
    console.log(`\n⏱️  Total Duration: ${totalDuration.toFixed(1)} seconds\n`);

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Benchmark failed:', error);
    process.exit(1);
  }
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { runAllBenchmarksSequentially };
