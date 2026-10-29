import { describe, it } from 'node:test';
import assert from 'node:assert';
import { normalizeOutput, evaluateTestCases } from '../src/services/execution.service';

describe('DSA Problem Test Case Evaluation Engine', () => {
  it('normalizeOutput should correctly handle arrays, JSON, and whitespace differences', () => {
    assert.strictEqual(normalizeOutput('[0, 1]'), '[0,1]');
    assert.strictEqual(normalizeOutput('[0,1]\n'), '[0,1]');
    assert.strictEqual(normalizeOutput('true\n'), 'true');
    assert.strictEqual(normalizeOutput('  hello   world  '), 'hello world');
  });

  it('evaluateTestCases should pass valid JavaScript solution', async () => {
    const code = `
function twoSum(nums, target) {
  const map = new Map();
  for (let i = 0; i < nums.length; i++) {
    const diff = target - nums[i];
    if (map.has(diff)) {
      return [map.get(diff), i];
    }
    map.set(nums[i], i);
  }
  return [];
}
`;
    const testCases = [
      { input: '[2,7,11,15]\n9', expectedOutput: '[0,1]' },
      { input: '[3,2,4]\n6', expectedOutput: '[1,2]' },
    ];

    const result = await evaluateTestCases(code, 'javascript', testCases);
    assert.strictEqual(result.allPassed, true);
    assert.strictEqual(result.passedCases, 2);
    assert.strictEqual(result.totalCases, 2);
    assert.strictEqual(result.status, 'accepted');
  });

  it('evaluateTestCases should flag wrong answer for incorrect solution', async () => {
    const code = `
function twoSum(nums, target) {
  return [99, 99];
}
`;
    const testCases = [
      { input: '[2,7,11,15]\n9', expectedOutput: '[0,1]' },
    ];

    const result = await evaluateTestCases(code, 'javascript', testCases);
    assert.strictEqual(result.allPassed, false);
    assert.strictEqual(result.passedCases, 0);
    assert.strictEqual(result.status, 'wrong_answer');
    assert.strictEqual(result.testResults[0].passed, false);
  });

  it('evaluateTestCases should pass Python solution with user print statements in stdout', async () => {
    const code = `
def two_sum(nums, target):
    print("User debugging: target is", target)
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []
`;
    const testCases = [
      { input: '[2,7,11,15]\n9', expectedOutput: '[0,1]' },
      { input: '[3,2,4]\n6', expectedOutput: '[1,2]' },
    ];

    const result = await evaluateTestCases(code, 'python', testCases, 'two-sum');
    assert.strictEqual(result.allPassed, true);
    assert.strictEqual(result.status, 'accepted');
    assert.ok(result.testResults[0].userStdout?.includes('User debugging'));
  });

  it('evaluateTestCases should capture compilation errors clearly', async () => {
    const code = `
function twoSum(nums, target) {
  this is an obvious syntax error {{{
}
`;
    const testCases = [{ input: '[2,7,11,15]\n9', expectedOutput: '[0,1]' }];
    const result = await evaluateTestCases(code, 'javascript', testCases, 'two-sum');
    assert.strictEqual(result.status, 'compile_error');
    assert.ok(result.compilerError || result.testResults[0].errorMessage);
  });

  it('evaluateTestCases should capture runtime exceptions clearly', async () => {
    const code = `
def two_sum(nums, target):
    x = 10 / 0 # ZeroDivisionError
    return []
`;
    const testCases = [{ input: '[2,7,11,15]\n9', expectedOutput: '[0,1]' }];
    const result = await evaluateTestCases(code, 'python', testCases, 'two-sum');
    assert.strictEqual(result.status, 'runtime_error');
    assert.ok(result.runtimeError?.includes('ZeroDivisionError'));
  });

  it('evaluateTestCases should pass C++ and Java solutions', async () => {
    const cppCode = `
vector<int> twoSum(vector<int>& nums, int target) {
    unordered_map<int, int> map;
    for (int i = 0; i < nums.size(); i++) {
        int diff = target - nums[i];
        if (map.count(diff)) return {map[diff], i};
        map[nums[i]] = i;
    }
    return {};
}
`;
    const testCases = [{ input: '[2,7,11,15]\n9', expectedOutput: '[0,1]' }];
    const cppResult = await evaluateTestCases(cppCode, 'cpp', testCases, 'two-sum');
    assert.strictEqual(cppResult.status, 'accepted');
    assert.strictEqual(cppResult.allPassed, true);

    const javaCode = `
class Solution {
    public static int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) return new int[] { map.get(complement), i };
            map.put(nums[i], i);
        }
        return new int[] {};
    }
}
`;
    const javaResult = await evaluateTestCases(javaCode, 'java', testCases, 'two-sum');
    assert.strictEqual(javaResult.status, 'accepted');
    assert.strictEqual(javaResult.allPassed, true);
  });

  it('evaluateTestCases should support Python class Solution with typing List[int]', async () => {
    const pyCode = `
class Solution:
    def twoSum(self, nums: List[int], target: int) -> List[int]:
        m = {}
        for i, n in enumerate(nums):
            if target - n in m:
                return [m[target - n], i]
            m[n] = i
        return []
`;
    const testCases = [{ input: '[2,7,11,15]\n9', expectedOutput: '[0,1]' }];
    const result = await evaluateTestCases(pyCode, 'python', testCases, 'two-sum');
    assert.strictEqual(result.status, 'accepted');
    assert.strictEqual(result.allPassed, true);
  });

  it('evaluateTestCases should support Java non-static method in Solution class', async () => {
    const javaCode = `
class Solution {
    public int[] twoSum(int[] nums, int target) {
        return new int[]{0, 1};
    }
}
`;
    const testCases = [{ input: '[2,7,11,15]\n9', expectedOutput: '[0,1]' }];
    const result = await evaluateTestCases(javaCode, 'java', testCases, 'two-sum');
    assert.strictEqual(result.status, 'accepted');
    assert.strictEqual(result.allPassed, true);
  });

  it('evaluateTestCases should support Java in-place char[] reverseString', async () => {
    const javaCode = `
class Solution {
    public void reverseString(char[] s) {
        int i = 0, j = s.length - 1;
        while (i < j) {
            char temp = s[i];
            s[i] = s[j];
            s[j] = temp;
            i++;
            j--;
        }
    }
}
`;
    const result = await evaluateTestCases(javaCode, 'java', [
      { input: 'hello', expectedOutput: 'olleh' },
      { input: 'algorithm', expectedOutput: 'mhtirogla' },
    ], 'reverse-string');
    assert.strictEqual(result.status, 'accepted');
    assert.strictEqual(result.allPassed, true);
  });

  it('evaluateTestCases should pass custom input without expected output', async () => {
    const pyCode = `
def two_sum(nums, target):
    return [0, 1]
`;
    const testCases = [{ input: '[1,2,3]\n4', expectedOutput: '' }];
    const result = await evaluateTestCases(pyCode, 'python', testCases, 'two-sum');
    assert.strictEqual(result.status, 'accepted');
    assert.strictEqual(result.allPassed, true);
    assert.strictEqual(result.testResults[0].passed, true);
  });
});
