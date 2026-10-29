/**
 * test-project-problems.ts
 *
 * Evaluates all 5 built-in project problems across all 4 primary languages
 * (JavaScript, Python, Java, C++) against their authorized test cases.
 *
 * Verifies:
 *  1. Two Sum (Array / Hash Table)
 *  2. Reverse String (Two Pointers / String)
 *  3. Binary Search (Binary Search / Array)
 *  4. Valid Parentheses (Stack / String)
 *  5. Maximum Subarray (Dynamic Programming / Array)
 *
 * Runs against Docker execution when DOCKER_EXECUTION=true or local sandbox.
 */

import { DEFAULT_PROBLEMS, getProblemBySlug } from '../src/services/problem.service';
import { evaluateTestCases } from '../src/services/execution.service';

const green  = (s: string) => `\x1b[32m${s}\x1b[0m`;
const red    = (s: string) => `\x1b[31m${s}\x1b[0m`;
const yellow = (s: string) => `\x1b[33m${s}\x1b[0m`;
const bold   = (s: string) => `\x1b[1m${s}\x1b[0m`;
const cyan   = (s: string) => `\x1b[36m${s}\x1b[0m`;

async function main() {
  console.log(bold('\n╔══════════════════════════════════════════════════════════════════╗'));
  console.log(bold('║  Collab Code — Problem Evaluation Test Suite (All 5 Problems)    ║'));
  console.log(bold('╚══════════════════════════════════════════════════════════════════╝'));
  console.log(`Execution Mode: ${process.env.DOCKER_EXECUTION === 'true' ? cyan('Docker Sandbox (collab-code-runner:local)') : yellow('Local Sandbox')}\n`);

  let totalTests = 0;
  let passedTests = 0;
  let failedTests = 0;

  const languages = ['javascript', 'python', 'java', 'cpp'] as const;

  for (const prob of DEFAULT_PROBLEMS) {
    console.log(bold(`\n▶ Problem: ${prob.title} [${prob.slug}] (${prob.difficulty.toUpperCase()})`));
    console.log(`  Test cases: ${prob.testCases.length} (${prob.testCases.filter(t => !t.isHidden).length} visible, ${prob.testCases.filter(t => t.isHidden).length} hidden)`);

    for (const lang of languages) {
      totalTests++;
      const code = prob.starterCode[lang];
      if (!code) {
        console.log(`  ${yellow('⚠')} ${lang}: No starter code defined`);
        continue;
      }

      const start = Date.now();
      try {
        const result = await evaluateTestCases(
          code,
          lang,
          prob.testCases.map((tc) => ({ input: tc.input, expectedOutput: tc.expectedOutput })),
          prob.slug
        );

        const duration = Date.now() - start;

        if (result.status === 'accepted' && result.allPassed) {
          console.log(`  ${green('✔')} ${lang.padEnd(12)} → ${green('ACCEPTED')} (${result.passedCases}/${result.totalCases} cases passed, ${duration}ms)`);
          passedTests++;
        } else {
          console.log(`  ${red('✘')} ${lang.padEnd(12)} → ${red(result.status.toUpperCase())} (${result.passedCases}/${result.totalCases} passed, ${duration}ms)`);
          if (result.compilerError) {
            console.log(`      ${red('Compile error:')} ${result.compilerError.slice(0, 300)}`);
          }
          if (result.runtimeError) {
            console.log(`      ${red('Runtime error:')} ${result.runtimeError.slice(0, 300)}`);
          }
          failedTests++;
        }
      } catch (err) {
        console.log(`  ${red('✘')} ${lang.padEnd(12)} → EXCEPTION: ${err}`);
        failedTests++;
      }
    }
  }

  // Also test intentional failure detection on Two Sum
  console.log(bold(`\n▶ Negative Test: Intentional Wrong Answer on Two Sum`));
  totalTests++;
  const wrongCode = `function twoSum(nums, target) { return [999, 999]; }`;
  const wrongRes = await evaluateTestCases(
    wrongCode,
    'javascript',
    DEFAULT_PROBLEMS[0].testCases.map(tc => ({ input: tc.input, expectedOutput: tc.expectedOutput })),
    'two-sum'
  );
  if (wrongRes.status === 'wrong_answer' && !wrongRes.allPassed) {
    console.log(`  ${green('✔')} Wrong solution correctly rejected as ${green('WRONG_ANSWER')} (${wrongRes.passedCases}/${wrongRes.totalCases} passed)`);
    passedTests++;
  } else {
    console.log(`  ${red('✘')} Negative test failed: expected wrong_answer, got ${wrongRes.status}`);
    failedTests++;
  }

  console.log(bold('\n══════════════════════════════════════════════════════════════════'));
  console.log(`Total Scenarios Tested : ${totalTests}`);
  console.log(`Passed                 : ${green(String(passedTests))}`);
  console.log(`Failed                 : ${failedTests > 0 ? red(String(failedTests)) : green('0')}`);
  console.log(bold('══════════════════════════════════════════════════════════════════\n'));

  if (failedTests > 0) {
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
