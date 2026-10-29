import mongoose from 'mongoose';
import { Problem, IProblem } from '../models/Problem';

export const DEFAULT_PROBLEMS = [
  {
    slug: 'two-sum',
    title: 'Two Sum',
    description: `Given an array of integers \`nums\` and an integer \`target\`, return indices of the two numbers such that they add up to \`target\`.

You may assume that each input would have exactly one solution, and you may not use the same element twice. You can return the answer in any order.`,
    difficulty: 'easy' as const,
    tags: ['Array', 'Hash Table'],
    constraints: `2 <= nums.length <= 10^4
-10^9 <= nums[i] <= 10^9
-10^9 <= target <= 10^9
Only one valid answer exists.`,
    examples: [
      {
        input: 'nums = [2,7,11,15], target = 9',
        output: '[0,1]',
        explanation: 'Because nums[0] + nums[1] == 9, we return [0, 1].',
      },
      {
        input: 'nums = [3,2,4], target = 6',
        output: '[1,2]',
        explanation: 'Because nums[1] + nums[2] == 6, we return [1, 2].',
      },
    ],
    testCases: [
      { input: '[2,7,11,15]\n9', expectedOutput: '[0,1]', isHidden: false },
      { input: '[3,2,4]\n6', expectedOutput: '[1,2]', isHidden: false },
      { input: '[3,3]\n6', expectedOutput: '[0,1]', isHidden: true },
      { input: '[1,5,8,3]\n4', expectedOutput: '[0,3]', isHidden: true },
    ],
    starterCode: {
      javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number[]}
 */
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
`,
      python: `def two_sum(nums, target):
    seen = {}
    for i, num in enumerate(nums):
        diff = target - num
        if diff in seen:
            return [seen[diff], i]
        seen[num] = i
    return []
`,
      java: `import java.util.*;

public class Solution {
    public static int[] twoSum(int[] nums, int target) {
        Map<Integer, Integer> map = new HashMap<>();
        for (int i = 0; i < nums.length; i++) {
            int complement = target - nums[i];
            if (map.containsKey(complement)) {
                return new int[] { map.get(complement), i };
            }
            map.put(nums[i], i);
        }
        return new int[] {};
    }
}
`,
      cpp: `#include <vector>
#include <unordered_map>
using namespace std;

vector<int> twoSum(vector<int>& nums, int target) {
    unordered_map<int, int> map;
    for (int i = 0; i < nums.size(); i++) {
        int diff = target - nums[i];
        if (map.count(diff)) {
            return {map[diff], i};
        }
        map[nums[i]] = i;
    }
    return {};
}
`,
    },
  },
  {
    slug: 'reverse-string',
    title: 'Reverse String',
    description: `Write a function that reverses a string. The input string is given as an array of characters or string.

You must do this by modifying the input array in-place or returning the reversed string with O(1) extra memory.`,
    difficulty: 'easy' as const,
    tags: ['Two Pointers', 'String'],
    constraints: `1 <= s.length <= 10^5
s consists of printable ASCII characters.`,
    examples: [
      { input: 's = "hello"', output: '"olleh"' },
      { input: 's = "Hannah"', output: '"hannaH"' },
    ],
    testCases: [
      { input: 'hello', expectedOutput: 'olleh', isHidden: false },
      { input: 'CollabCode', expectedOutput: 'edoCballoC', isHidden: false },
      { input: 'racecar', expectedOutput: 'racecar', isHidden: true },
      { input: 'algorithm', expectedOutput: 'mhtirogla', isHidden: true },
    ],
    starterCode: {
      javascript: `/**
 * @param {string} s
 * @return {string}
 */
function reverseString(s) {
  return s.split('').reverse().join('');
}
`,
      python: `def reverse_string(s: str) -> str:
    return s[::-1]
`,
      java: `public class Solution {
    public static String reverseString(String s) {
        return new StringBuilder(s).reverse().toString();
    }
}
`,
      cpp: `#include <string>
#include <algorithm>
using namespace std;

string reverseString(string s) {
    reverse(s.begin(), s.end());
    return s;
}
`,
    },
  },
  {
    slug: 'binary-search',
    title: 'Binary Search',
    description: `Given an array of integers \`nums\` which is sorted in ascending order, and an integer \`target\`, write a function to search \`target\` in \`nums\`.

If \`target\` exists, then return its index. Otherwise, return \`-1\`. You must write an algorithm with \`O(log n)\` runtime complexity.`,
    difficulty: 'easy' as const,
    tags: ['Array', 'Binary Search'],
    constraints: `1 <= nums.length <= 10^4
-10^4 < nums[i], target < 10^4
All the integers in nums are unique.
nums is sorted in ascending order.`,
    examples: [
      { input: 'nums = [-1,0,3,5,9,12], target = 9', output: '4', explanation: '9 exists in nums and its index is 4' },
      { input: 'nums = [-1,0,3,5,9,12], target = 2', output: '-1', explanation: '2 does not exist in nums so return -1' },
    ],
    testCases: [
      { input: '[-1,0,3,5,9,12]\n9', expectedOutput: '4', isHidden: false },
      { input: '[-1,0,3,5,9,12]\n2', expectedOutput: '-1', isHidden: false },
      { input: '[5]\n5', expectedOutput: '0', isHidden: true },
      { input: '[1,3,5,7,9]\n1', expectedOutput: '0', isHidden: true },
    ],
    starterCode: {
      javascript: `/**
 * @param {number[]} nums
 * @param {number} target
 * @return {number}
 */
function search(nums, target) {
  let left = 0;
  let right = nums.length - 1;
  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}
`,
      python: `def search(nums, target):
    left, right = 0, len(nums) - 1
    while left <= right:
        mid = (left + right) // 2
        if nums[mid] == target:
            return mid
        elif nums[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
`,
      java: `public class Solution {
    public static int search(int[] nums, int target) {
        int left = 0, right = nums.length - 1;
        while (left <= right) {
            int mid = left + (right - left) / 2;
            if (nums[mid] == target) return mid;
            if (nums[mid] < target) left = mid + 1;
            else right = mid - 1;
        }
        return -1;
    }
}
`,
      cpp: `#include <vector>
using namespace std;

int search(vector<int>& nums, int target) {
    int left = 0, right = nums.size() - 1;
    while (left <= right) {
        int mid = left + (right - left) / 2;
        if (nums[mid] == target) return mid;
        if (nums[mid] < target) left = mid + 1;
        else right = mid - 1;
    }
    return -1;
}
`,
    },
  },
  {
    slug: 'valid-parentheses',
    title: 'Valid Parentheses',
    description: `Given a string \`s\` containing just the characters '(', ')', '{', '}', '[' and ']', determine if the input string is valid.

An input string is valid if:
1. Open brackets must be closed by the same type of brackets.
2. Open brackets must be closed in the correct order.
3. Every close bracket has a corresponding open bracket of the same type.`,
    difficulty: 'easy' as const,
    tags: ['String', 'Stack'],
    constraints: `1 <= s.length <= 10^4
s consists of parentheses only '()[]{}'.`,
    examples: [
      { input: 's = "()"', output: 'true' },
      { input: 's = "()[]{}"', output: 'true' },
      { input: 's = "(]"', output: 'false' },
    ],
    testCases: [
      { input: '()', expectedOutput: 'true', isHidden: false },
      { input: '()[]{}', expectedOutput: 'true', isHidden: false },
      { input: '(]', expectedOutput: 'false', isHidden: true },
      { input: '([)]', expectedOutput: 'false', isHidden: true },
    ],
    starterCode: {
      javascript: `/**
 * @param {string} s
 * @return {boolean}
 */
function isValid(s) {
  const stack = [];
  const map = { ')': '(', '}': '{', ']': '[' };
  for (const char of s) {
    if (char in map) {
      if (stack.pop() !== map[char]) return false;
    } else {
      stack.push(char);
    }
  }
  return stack.length === 0;
}
`,
      python: `def is_valid(s: str) -> bool:
    stack = []
    mapping = {")": "(", "}": "{", "]": "["}
    for char in s:
        if char in mapping:
            top = stack.pop() if stack else '#'
            if mapping[char] != top:
                return False
        else:
            stack.append(char)
    return not stack
`,
      java: `import java.util.*;

public class Solution {
    public static boolean isValid(String s) {
        Deque<Character> stack = new ArrayDeque<>();
        for (char c : s.toCharArray()) {
            if (c == '(') stack.push(')');
            else if (c == '{') stack.push('}');
            else if (c == '[') stack.push(']');
            else if (stack.isEmpty() || stack.pop() != c) return false;
        }
        return stack.isEmpty();
    }
}
`,
      cpp: `#include <string>
#include <stack>
using namespace std;

bool isValid(string s) {
    stack<char> st;
    for (char c : s) {
        if (c == '(') st.push(')');
        else if (c == '{') st.push('}');
        else if (c == '[') st.push(']');
        else {
            if (st.empty() || st.top() != c) return false;
            st.pop();
        }
    }
    return st.empty();
}
`,
    },
  },
  {
    slug: 'maximum-subarray',
    title: 'Maximum Subarray',
    description: `Given an integer array \`nums\`, find the subarray with the largest sum, and return its sum.

A subarray is a contiguous non-empty sequence of elements within an array.`,
    difficulty: 'medium' as const,
    tags: ['Array', 'Dynamic Programming', 'Divide and Conquer'],
    constraints: `1 <= nums.length <= 10^5
-10^4 <= nums[i] <= 10^4`,
    examples: [
      {
        input: 'nums = [-2,1,-3,4,-1,2,1,-5,4]',
        output: '6',
        explanation: 'The subarray [4,-1,2,1] has the largest sum 6.',
      },
      { input: 'nums = [1]', output: '1' },
      { input: 'nums = [5,4,-1,7,8]', output: '23' },
    ],
    testCases: [
      { input: '[-2,1,-3,4,-1,2,1,-5,4]', expectedOutput: '6', isHidden: false },
      { input: '[1]', expectedOutput: '1', isHidden: false },
      { input: '[5,4,-1,7,8]', expectedOutput: '23', isHidden: true },
      { input: '[-1]', expectedOutput: '-1', isHidden: true },
    ],
    starterCode: {
      javascript: `/**
 * @param {number[]} nums
 * @return {number}
 */
function maxSubArray(nums) {
  let maxSoFar = nums[0];
  let currMax = nums[0];
  for (let i = 1; i < nums.length; i++) {
    currMax = Math.max(nums[i], currMax + nums[i]);
    maxSoFar = Math.max(maxSoFar, currMax);
  }
  return maxSoFar;
}
`,
      python: `def max_sub_array(nums):
    max_so_far = nums[0]
    curr_max = nums[0]
    for x in nums[1:]:
        curr_max = max(x, curr_max + x)
        max_so_far = max(max_so_far, curr_max)
    return max_so_far
`,
      java: `public class Solution {
    public static int maxSubArray(int[] nums) {
        int maxSoFar = nums[0];
        int currMax = nums[0];
        for (int i = 1; i < nums.length; i++) {
            currMax = Math.max(nums[i], currMax + nums[i]);
            maxSoFar = Math.max(maxSoFar, currMax);
        }
        return maxSoFar;
    }
}
`,
      cpp: `#include <vector>
#include <algorithm>
using namespace std;

int maxSubArray(vector<int>& nums) {
    int maxSoFar = nums[0];
    int currMax = nums[0];
    for (int i = 1; i < nums.size(); i++) {
        currMax = max(nums[i], currMax + nums[i]);
        maxSoFar = max(maxSoFar, currMax);
    }
    return maxSoFar;
}
`,
    },
  },
];

function isMongoConnected(): boolean {
  return mongoose.connection.readyState === 1;
}

export async function getProblems(difficulty?: string) {
  if (isMongoConnected()) {
    const query: Record<string, unknown> = {};
    if (difficulty) {
      query.difficulty = difficulty;
    }
    return Problem.find(query).sort({ createdAt: 1 });
  }

  if (difficulty) {
    return DEFAULT_PROBLEMS.filter((p) => p.difficulty === difficulty);
  }
  return DEFAULT_PROBLEMS;
}

/**
 * Clean LeetCode HTML content to readable markdown.
 */
function cleanLeetCodeHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<pre>([\s\S]*?)<\/pre>/gi, (_, c) => '\n```\n' + c + '\n```\n')
    .replace(/<code>(.*?)<\/code>/gi, '`$1`')
    .replace(/<strong class="example">/gi, '\n\nExample ')
    .replace(/<strong>(.*?)<\/strong>/gi, '**$1**')
    .replace(/<em>(.*?)<\/em>/gi, '*$1*')
    .replace(/<li>/gi, '\n- ')
    .replace(/<\/?[^>]+(>|$)/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Dynamically fetches any LeetCode problem from the official public GraphQL API.
 * Completely free, no API key or credentials required.
 */
export async function fetchLeetCodeProblem(slugOrUrl: string) {
  const cleanSlug = slugOrUrl
    .replace(/^https?:\/\/(www\.)?leetcode\.com\/problems\//i, '')
    .replace(/\/+$/, '')
    .trim()
    .toLowerCase();

  if (!cleanSlug) return null;

  const query = `query getQuestionDetail($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      questionFrontendId
      title
      titleSlug
      content
      difficulty
      topicTags { name }
      codeSnippets { langSlug code }
      exampleTestcaseList
      sampleTestCase
    }
  }`;

  try {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://leetcode.com',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
      body: JSON.stringify({ query, variables: { titleSlug: cleanSlug } }),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return null;
    const json: any = await res.json();
    const q = json?.data?.question;
    if (!q || !q.title) return null;

    const starterCode: Record<string, string> = {};
    if (Array.isArray(q.codeSnippets)) {
      for (const snip of q.codeSnippets) {
        if (snip.langSlug === 'python3' || snip.langSlug === 'python') starterCode.python = snip.code;
        if (snip.langSlug === 'javascript') starterCode.javascript = snip.code;
        if (snip.langSlug === 'typescript') starterCode.typescript = snip.code;
        if (snip.langSlug === 'java') starterCode.java = snip.code;
        if (snip.langSlug === 'cpp') starterCode.cpp = snip.code;
      }
    }

    const examples: Array<{ input: string; output: string; explanation?: string }> = [];
    const testCases: Array<{ input: string; expectedOutput: string; isHidden?: boolean }> = [];

    const regex = /<strong>Input:<\/strong>\s*([\s\S]*?)<strong>Output:<\/strong>\s*([\s\S]*?)(?:<strong>Explanation:<\/strong>\s*([\s\S]*?))?(?=(?:<strong class="example">|Constraints:|$))/gi;
    let match: RegExpExecArray | null;
    const strip = (s: string) =>
      s.replace(/<\/?[^>]+(>|$)/g, '').replace(/&nbsp;/g, ' ').replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();

    while ((match = regex.exec(q.content || '')) !== null) {
      const rawIn = strip(match[1]);
      const rawOut = strip(match[2]);
      examples.push({
        input: rawIn,
        output: rawOut,
        explanation: match[3] ? strip(match[3]) : undefined,
      });

      const cleanInput = rawIn
        .replace(/^[a-zA-Z0-9_]+\s*=\s*/, '')
        .replace(/,\s*[a-zA-Z0-9_]+\s*=\s*/g, '\n');

      testCases.push({
        input: cleanInput,
        expectedOutput: rawOut,
        isHidden: false,
      });
    }

    if (testCases.length === 0 && Array.isArray(q.exampleTestcaseList)) {
      for (const tc of q.exampleTestcaseList) {
        testCases.push({
          input: tc,
          expectedOutput: '',
          isHidden: false,
        });
      }
    }

    let diff: 'easy' | 'medium' | 'hard' = 'medium';
    const rawDiff = (q.difficulty || '').toLowerCase();
    if (rawDiff === 'easy' || rawDiff === 'medium' || rawDiff === 'hard') {
      diff = rawDiff;
    }

    return {
      slug: cleanSlug,
      title: `${q.questionFrontendId ? q.questionFrontendId + '. ' : ''}${q.title}`,
      description: cleanLeetCodeHtml(q.content),
      difficulty: diff,
      tags: Array.isArray(q.topicTags) ? q.topicTags.map((t: any) => t.name) : ['LeetCode'],
      constraints: '',
      examples,
      testCases,
      starterCode,
    };
  } catch (err) {
    console.warn(`[ProblemService] LeetCode GraphQL fetch failed for "${cleanSlug}":`, err);
    return null;
  }
}

function getSlugCandidates(input: string): string[] {
  const s = input
    .replace(/^https?:\/\/(www\.)?leetcode\.com\/problems\//i, '')
    .replace(/\/+$/, '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const numWords: Record<string, string> = {
    zero: '0', one: '1', two: '2', three: '3', four: '4', five: '5',
    six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  };

  const candidates = new Set<string>([s]);

  // "three-sum" -> "3sum", "three-sum-closest" -> "3sum-closest"
  let withDigits = s;
  for (const [word, digit] of Object.entries(numWords)) {
    withDigits = withDigits.replace(new RegExp(`\\b${word}\\b`, 'g'), digit);
  }
  withDigits = withDigits.replace(/(\d)-([a-z])/g, '$1$2');
  candidates.add(withDigits);

  // "3-sum" -> "3sum"
  candidates.add(s.replace(/(\d)-([a-z])/g, '$1$2'));

  return Array.from(candidates);
}

async function searchLeetCodeSlug(keyword: string): Promise<string | null> {
  const query = `query problemsetQuestionList($categorySlug: String, $limit: Int, $skip: Int, $filters: QuestionListFilterInput) {
    problemsetQuestionList: questionList(
      categorySlug: $categorySlug
      limit: $limit
      skip: $skip
      filters: $filters
    ) {
      questions: data {
        title
        titleSlug
      }
    }
  }`;

  try {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://leetcode.com',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
      },
      body: JSON.stringify({
        query,
        variables: { categorySlug: '', limit: 3, skip: 0, filters: { searchKeywords: keyword } },
      }),
      signal: AbortSignal.timeout(6000),
    });

    const json: any = await res.json();
    const list = json?.data?.problemsetQuestionList?.questions || [];
    return list.length > 0 ? list[0].titleSlug : null;
  } catch {
    return null;
  }
}

export function parseExamplesAndTestCasesFromText(text: string) {
  const regex = /(?:Example\s*\d*[:\s]*)?Input:\s*([\s\S]*?)Output:\s*([\s\S]*?)(?=(?:Example\s*\d*[:\s]*|Constraints:|$))/gi;
  let match: RegExpExecArray | null;
  const examples: Array<{ input: string; output: string; explanation?: string }> = [];
  const testCases: Array<{ input: string; expectedOutput: string; isHidden?: boolean }> = [];

  while ((match = regex.exec(text)) !== null) {
    let rawIn = match[1].trim();
    let rawOut = match[2].trim();
    let explanation: string | undefined;

    const expIdx = rawOut.indexOf('Explanation:');
    if (expIdx !== -1) {
      explanation = rawOut.substring(expIdx + 'Explanation:'.length).trim();
      rawOut = rawOut.substring(0, expIdx).trim();
    }

    examples.push({
      input: rawIn,
      output: rawOut,
      explanation,
    });

    const cleanInput = rawIn
      .replace(/^[a-zA-Z0-9_]+\s*=\s*/, '')
      .replace(/,\s*[a-zA-Z0-9_]+\s*=\s*/g, '\n')
      .trim();

    testCases.push({
      input: cleanInput,
      expectedOutput: rawOut,
      isHidden: false,
    });
  }

  return { examples, testCases };
}

async function ensureTestCases(prob: any) {
  if (!prob) return prob;
  if (!prob.testCases || prob.testCases.length === 0) {
    const parsed = parseExamplesAndTestCasesFromText(prob.description || '');
    if (parsed.testCases.length > 0) {
      prob.testCases = parsed.testCases;
      if (!prob.examples || prob.examples.length === 0) {
        prob.examples = parsed.examples;
      }
    } else {
      // Try LeetCode search to find official test cases
      const searchKey = (prob.title || prob.slug || '').replace(/-/g, ' ');
      const lcSlug = await searchLeetCodeSlug(searchKey);
      if (lcSlug) {
        const lcProb = await fetchLeetCodeProblem(lcSlug);
        if (lcProb && lcProb.testCases && lcProb.testCases.length > 0) {
          prob.testCases = lcProb.testCases;
          if (!prob.examples || prob.examples.length === 0) prob.examples = lcProb.examples;
          if (lcProb.starterCode && (!prob.starterCode || Object.keys(prob.starterCode).length === 0)) {
            prob.starterCode = lcProb.starterCode;
          }
        }
      }
    }
  }
  return prob;
}

export async function getProblemBySlug(slug: string) {
  const candidates = getSlugCandidates(slug);

  // 1. Check local MongoDB or memory defaults for any candidate alias
  for (const cand of candidates) {
    if (isMongoConnected()) {
      const problem = await Problem.findOne({ slug: cand });
      if (problem) return ensureTestCases(problem);
    }
    const found = DEFAULT_PROBLEMS.find((p) => p.slug === cand);
    if (found) return ensureTestCases(found);
  }

  // 2. Query LeetCode GraphQL for each candidate slug
  for (const cand of candidates) {
    const fetched = await fetchLeetCodeProblem(cand);
    if (fetched) {
      if (isMongoConnected()) {
        try {
          const created = await Problem.create(fetched);
          return created;
        } catch {
          return fetched;
        }
      } else {
        DEFAULT_PROBLEMS.push(fetched as any);
        return fetched;
      }
    }
  }

  // 3. Fallback: Search LeetCode by keyword/title
  const searchKeyword = slug.replace(/-/g, ' ');
  const searchSlug = await searchLeetCodeSlug(searchKeyword);
  if (searchSlug && !candidates.includes(searchSlug)) {
    const fetched = await fetchLeetCodeProblem(searchSlug);
    if (fetched) {
      if (isMongoConnected()) {
        try {
          const created = await Problem.create(fetched);
          return created;
        } catch {
          return fetched;
        }
      } else {
        DEFAULT_PROBLEMS.push(fetched as any);
        return fetched;
      }
    }
  }

  throw new Error('Problem not found');
}

export async function createProblem(data: {
  title: string;
  description: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  tags?: string[];
  constraints?: string;
  examples?: Array<{ input: string; output: string; explanation?: string }>;
  testCases?: Array<{ input: string; expectedOutput: string; isHidden?: boolean }>;
  starterCode?: Record<string, string>;
}) {
  const slug =
    data.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || `problem-${Date.now()}`;
  const difficulty = data.difficulty || 'medium';
  const tags = data.tags && data.tags.length > 0 ? data.tags : ['DSA', 'LeetCode'];
  const constraints = data.constraints || '';
  let examples = data.examples || [];
  let testCases = data.testCases || [];

  if (testCases.length === 0) {
    const parsed = parseExamplesAndTestCasesFromText(data.description || '');
    if (parsed.testCases.length > 0) {
      testCases = parsed.testCases;
      if (examples.length === 0) examples = parsed.examples;
    }
  }
  const starterCode = data.starterCode || {
    javascript: '// Write your solution here\nfunction solution() {\n  \n}\n',
    python: '# Write your solution here\ndef solution():\n    pass\n',
    java: 'public class Main {\n    public static void main(String[] args) {\n        // Solution\n    }\n}\n',
    cpp: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // Solution\n    return 0;\n}\n',
  };

  if (isMongoConnected()) {
    const existing = await Problem.findOne({ slug });
    if (existing) {
      return existing;
    }
    const problem = await Problem.create({
      slug,
      title: data.title,
      description: data.description,
      difficulty,
      tags,
      constraints,
      examples,
      testCases,
      starterCode,
    });
    return problem;
  }

  // In-memory fallback
  const existing = DEFAULT_PROBLEMS.find((p) => p.slug === slug);
  if (existing) return existing;

  const customProblem = {
    slug,
    title: data.title,
    description: data.description,
    difficulty,
    tags,
    constraints,
    examples,
    testCases,
    starterCode,
  };
  DEFAULT_PROBLEMS.push(customProblem as any);
  return customProblem;
}

export async function seedProblems(): Promise<void> {
  if (!isMongoConnected()) return;

  try {
    const count = await Problem.countDocuments();
    if (count === 0) {
      await Problem.insertMany(DEFAULT_PROBLEMS);
      console.log('[Problems] Successfully seeded standard problem set.');
    }
  } catch (err) {
    console.error('[Problems] Seeding error:', err);
  }
}
