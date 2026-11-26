import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '../..');

console.log('================================================================================');
console.log('  cPanel Clean-Room Appliance — 4-Tier E2E Test Suite Execution Runner');
console.log('================================================================================\n');

const testSuites = [
  { tier: 'Tier 1', name: 'Feature Coverage (68 Features across 9 Categories)', file: 'tests/e2e/tier1_features.test.mjs' },
  { tier: 'Tier 2', name: 'Boundary & Corner Cases (Adversarial Security & Stress)', file: 'tests/e2e/tier2_boundaries.test.mjs' },
  { tier: 'Tier 3', name: 'Cross-Feature Interactions (Pairwise Pipelines)', file: 'tests/e2e/tier3_interactions.test.mjs' },
  { tier: 'Tier 4', name: 'Real-World Scenarios (Acme WP, Legacy PHP, cpmove Round-Trip)', file: 'tests/e2e/tier4_realworld_tenant.test.mjs' }
];

let totalTests = 0;
let totalPassed = 0;
let totalFailed = 0;
const results = [];

const startTime = Date.now();

for (const suite of testSuites) {
  process.stdout.write(`▶ Running ${suite.tier}: ${suite.name} ... `);
  const suiteStart = Date.now();
  try {
    const output = execFileSync('node', ['--test', suite.file], {
      cwd: REPO_ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const elapsed = Date.now() - suiteStart;
    const passMatch = output.match(/ℹ pass (\d+)/);
    const failMatch = output.match(/ℹ fail (\d+)/);
    const testMatch = output.match(/ℹ tests (\d+)/);

    const passed = passMatch ? parseInt(passMatch[1], 10) : 0;
    const failed = failMatch ? parseInt(failMatch[1], 10) : 0;
    const count = testMatch ? parseInt(testMatch[1], 10) : passed + failed;

    totalTests += count;
    totalPassed += passed;
    totalFailed += failed;

    results.push({
      tier: suite.tier,
      name: suite.name,
      tests: count,
      passed,
      failed,
      durationMs: elapsed,
      status: failed === 0 ? 'PASSED' : 'FAILED'
    });

    console.log(`✅ ${passed}/${count} passed (${elapsed}ms)`);
  } catch (err) {
    const elapsed = Date.now() - suiteStart;
    const output = err.stdout || err.stderr || err.message;
    const passMatch = output.match(/ℹ pass (\d+)/);
    const failMatch = output.match(/ℹ fail (\d+)/);
    const testMatch = output.match(/ℹ tests (\d+)/);

    const passed = passMatch ? parseInt(passMatch[1], 10) : 0;
    const failed = failMatch ? parseInt(failMatch[1], 10) : 1;
    const count = testMatch ? parseInt(testMatch[1], 10) : passed + failed;

    totalTests += count;
    totalPassed += passed;
    totalFailed += failed;

    results.push({
      tier: suite.tier,
      name: suite.name,
      tests: count,
      passed,
      failed,
      durationMs: elapsed,
      status: 'FAILED'
    });

    console.log(`❌ FAILED (${failed} failures, ${elapsed}ms)`);
    console.error(output);
  }
}

const totalDuration = Date.now() - startTime;

console.log('\n================================================================================');
console.log('                          4-TIER E2E TEST SUMMARY MATRIX');
console.log('================================================================================');
console.table(results.map(r => ({
  Tier: r.tier,
  Description: r.name,
  Tests: r.tests,
  Passed: r.passed,
  Failed: r.failed,
  Status: r.status,
  Time: `${r.durationMs}ms`
})));

console.log(`\nAggregated Total: ${totalPassed}/${totalTests} Passed | ${totalFailed} Failed | Duration: ${totalDuration}ms`);

if (totalFailed === 0) {
  console.log('\n🎉 ALL 4-TIER E2E TESTS PASSED WITH 100% SUCCESS!');
  process.exit(0);
} else {
  console.error(`\n❌ E2E TEST SUITE REPORTED ${totalFailed} FAILURES.`);
  process.exit(1);
}
