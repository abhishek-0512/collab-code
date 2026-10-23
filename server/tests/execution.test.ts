import { test, describe } from 'node:test';
import assert from 'node:assert';
import { executeCode } from '../src/services/execution.service';

describe('Code Execution Service Isolation & Validation', () => {
  test('unsupported language should return error without running', async () => {
    const res = await executeCode({
      code: 'print("hello")',
      language: 'unsupported_lang_xyz',
    });
    assert.strictEqual(res.status, 'error');
    assert.ok(res.stderr.includes('not supported'));
  });

  test('valid javascript execution via boundary should return formatted result', async () => {
    const res = await executeCode({
      code: 'console.log("Hello from test runner");',
      language: 'javascript',
    });
    // In environments with outbound internet, status is 'success', if offline it gracefully reports 'unavailable'
    assert.ok(['success', 'unavailable'].includes(res.status));
    if (res.status === 'success') {
      assert.ok(res.stdout.includes('Hello from test runner'));
    }
  });

  test('syntax error should be captured in compiler/stderr', async () => {
    const res = await executeCode({
      code: 'const x = ;',
      language: 'javascript',
    });
    assert.ok(['error', 'compile_error', 'unavailable'].includes(res.status));
  });
});
