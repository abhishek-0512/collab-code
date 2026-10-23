import { useState, useEffect } from 'react';
import {
  CheckCircle,
  XCircle,
  Play,
  Check,
  Plus,
  Loader2,
  Code2,
  AlertTriangle,
  History,
  Terminal,
} from 'lucide-react';
import { Button } from '../ui/Button';
import type { Problem, ExecutionResult, TestSuiteEvaluationResult } from '../../types';
import type { SubmissionResponse, SubmissionRecord } from '../../services/execution.service';

interface ProblemAndTestCasesPanelProps {
  problem: Problem | null;
  running: boolean;
  submitting: boolean;
  executionResult: ExecutionResult | null;
  testSuiteResult: TestSuiteEvaluationResult | null;
  submissionResult: SubmissionResponse | null;
  submissionHistory: SubmissionRecord[];
  customInput: string;
  setCustomInput: (val: string) => void;
  onRunSampleTests: () => void;
  onSubmitSolution: () => void;
}

export function ProblemAndTestCasesPanel({
  problem,
  running,
  submitting,
  testSuiteResult,
  submissionResult,
  submissionHistory,
  customInput,
  setCustomInput,
  onRunSampleTests,
  onSubmitSolution,
}: ProblemAndTestCasesPanelProps) {
  const [activeTab, setActiveTab] = useState<'testcases' | 'result' | 'submissions'>('testcases');
  const [selectedCaseIndex, setSelectedCaseIndex] = useState(0);

  // Auto-switch to result tab when tests run or submission arrives
  useEffect(() => {
    if (testSuiteResult || running) {
      setActiveTab('result');
    }
  }, [testSuiteResult, running]);

  useEffect(() => {
    if (submissionResult || submitting) {
      setActiveTab('submissions');
    }
  }, [submissionResult, submitting]);

  const sampleCases = problem?.testCases?.filter((tc) => !tc.isHidden) || [];

  // Helper to format input into LeetCode parameter view
  const formatInputDisplay = (rawInput: string, slug?: string) => {
    const lines = rawInput.trim().split(/\r?\n/).filter(Boolean);
    if (slug === 'two-sum' && lines.length >= 2) {
      return (
        <div className="flex flex-col gap-2">
          <div className="bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono">
            <span className="text-slate-500 select-none">nums = </span>
            <span className="text-slate-200">{lines[0]}</span>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono">
            <span className="text-slate-500 select-none">target = </span>
            <span className="text-slate-200">{lines[1]}</span>
          </div>
        </div>
      );
    }
    if (slug === 'binary-search' && lines.length >= 2) {
      return (
        <div className="flex flex-col gap-2">
          <div className="bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono">
            <span className="text-slate-500 select-none">nums = </span>
            <span className="text-slate-200">{lines[0]}</span>
          </div>
          <div className="bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono">
            <span className="text-slate-500 select-none">target = </span>
            <span className="text-slate-200">{lines[1]}</span>
          </div>
        </div>
      );
    }
    if (slug === 'reverse-string' || slug === 'valid-parentheses') {
      return (
        <div className="bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono">
          <span className="text-slate-500 select-none">s = </span>
          <span className="text-slate-200">&quot;{lines[0] || rawInput}&quot;</span>
        </div>
      );
    }
    if (slug === 'maximum-subarray') {
      return (
        <div className="bg-slate-950 border border-slate-800 rounded p-2 text-xs font-mono">
          <span className="text-slate-500 select-none">nums = </span>
          <span className="text-slate-200">{lines[0] || rawInput}</span>
        </div>
      );
    }
    return (
      <pre className="bg-slate-950 border border-slate-800 rounded p-2 text-slate-200 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
        {rawInput}
      </pre>
    );
  };

  return (
    <div className="h-72 border-t border-slate-800 bg-slate-900 flex flex-col overflow-hidden shrink-0 select-none">
      {/* LeetCode Header Toolbar */}
      <div className="flex items-center justify-between px-3 border-b border-slate-800 bg-slate-950/80 text-xs shrink-0 h-10">
        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 h-full">
          <button
            onClick={() => setActiveTab('testcases')}
            className={`h-full px-3 flex items-center gap-1.5 font-medium transition-colors cursor-pointer border-b-2 ${
              activeTab === 'testcases'
                ? 'text-indigo-400 border-indigo-500 bg-slate-900/50'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Code2 size={13} />
            <span>Testcase</span>
          </button>

          <button
            onClick={() => setActiveTab('result')}
            className={`h-full px-3 flex items-center gap-1.5 font-medium transition-colors cursor-pointer border-b-2 ${
              activeTab === 'result'
                ? 'text-indigo-400 border-indigo-500 bg-slate-900/50'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <Terminal size={13} />
            <span>Test Result</span>
            {running && <Loader2 size={11} className="animate-spin text-indigo-400" />}
            {testSuiteResult && !running && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                  testSuiteResult.status === 'accepted'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                    : testSuiteResult.status === 'compile_error'
                    ? 'bg-red-950 text-red-400 border border-red-800/60'
                    : 'bg-rose-950 text-rose-400 border border-rose-800/60'
                }`}
              >
                {testSuiteResult.status.replace('_', ' ')}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('submissions')}
            className={`h-full px-3 flex items-center gap-1.5 font-medium transition-colors cursor-pointer border-b-2 ${
              activeTab === 'submissions'
                ? 'text-indigo-400 border-indigo-500 bg-slate-900/50'
                : 'text-slate-400 border-transparent hover:text-slate-200'
            }`}
          >
            <History size={13} />
            <span>Submissions</span>
            {submitting && <Loader2 size={11} className="animate-spin text-indigo-400" />}
            {submissionResult && !submitting && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold uppercase ${
                  submissionResult.verdict === 'accepted'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/60'
                    : 'bg-red-950 text-red-400 border border-red-800/60'
                }`}
              >
                {submissionResult.verdict.replace('_', ' ')}
              </span>
            )}
          </button>
        </div>

        {/* Action Buttons: Run & Submit */}
        <div className="flex items-center gap-2">
          <Button
            size="xs"
            variant="secondary"
            onClick={onRunSampleTests}
            loading={running}
            className="gap-1.5 text-xs bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200 font-medium cursor-pointer"
          >
            <Play size={11} className="text-emerald-400 fill-emerald-400" />
            <span>Run</span>
          </Button>

          <Button
            size="xs"
            onClick={onSubmitSolution}
            loading={submitting}
            className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-sm shadow-emerald-600/30 cursor-pointer"
          >
            <Check size={12} />
            <span>Submit</span>
          </Button>
        </div>
      </div>

      {/* Tab 1: Testcase Editor Tab */}
      {activeTab === 'testcases' && (
        <div className="flex-1 flex overflow-hidden">
          {/* Case Pills Sidebar */}
          <div className="w-40 border-r border-slate-800 bg-slate-950/60 p-2 flex flex-col gap-1 overflow-auto shrink-0">
            {sampleCases.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setSelectedCaseIndex(idx)}
                className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
                  selectedCaseIndex === idx
                    ? 'bg-indigo-950/70 text-indigo-300 border border-indigo-700/60'
                    : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                }`}
              >
                <span>Case {idx + 1}</span>
              </button>
            ))}

            <button
              onClick={() => setSelectedCaseIndex(-1)}
              className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-left transition-colors cursor-pointer ${
                selectedCaseIndex === -1
                  ? 'bg-indigo-950/70 text-indigo-300 border border-indigo-700/60'
                  : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
              }`}
            >
              <span>Custom Input</span>
              <Plus size={11} className="text-slate-500" />
            </button>
          </div>

          {/* Case Details */}
          <div className="flex-1 p-3 overflow-auto">
            {selectedCaseIndex === -1 ? (
              <div className="flex flex-col gap-2">
                <span className="text-slate-400 text-xs font-semibold">
                  Custom Test Input (stdin / function arguments)
                </span>
                <textarea
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Enter arguments line-by-line (e.g. [2,7,11,15]\n9)"
                  rows={5}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-xs text-slate-200 font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            ) : sampleCases[selectedCaseIndex] ? (
              <div className="flex flex-col gap-3">
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold mb-1.5">
                    Testcase Input
                  </div>
                  {formatInputDisplay(sampleCases[selectedCaseIndex].input, problem?.slug)}
                </div>
                <div>
                  <div className="text-slate-500 text-[10px] uppercase font-bold mb-1.5">
                    Expected Output
                  </div>
                  <pre className="bg-slate-950 border border-slate-800 rounded p-2 text-emerald-400 font-mono text-xs overflow-x-auto whitespace-pre-wrap">
                    {sampleCases[selectedCaseIndex].expectedOutput}
                  </pre>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* Tab 2: LeetCode-Style Test Result Tab */}
      {activeTab === 'result' && (
        <div className="flex-1 flex flex-col overflow-hidden p-3 overflow-y-auto">
          {running ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
              <Loader2 size={22} className="animate-spin text-emerald-400" />
              <span className="text-xs font-medium">Running code against test cases...</span>
            </div>
          ) : !testSuiteResult ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              Click &ldquo;Run&rdquo; to execute your solution against test cases.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {/* LeetCode Verdict Header */}
              {testSuiteResult.status === 'accepted' && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-emerald-400">Accepted</span>
                    <span className="text-xs text-slate-400">
                      • Runtime: {testSuiteResult.totalTimeMs} ms
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-emerald-400">
                    Passed all {testSuiteResult.totalCases} / {testSuiteResult.totalCases} sample cases
                  </div>
                </div>
              )}

              {testSuiteResult.status === 'wrong_answer' && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <span className="text-base font-bold text-rose-500">Wrong Answer</span>
                    <span className="text-xs text-slate-400">
                      • Runtime: {testSuiteResult.totalTimeMs} ms
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-rose-400">
                    {testSuiteResult.passedCases} / {testSuiteResult.totalCases} test cases passed
                  </div>
                </div>
              )}

              {testSuiteResult.status === 'compile_error' && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-rose-500" />
                    <span className="text-base font-bold text-rose-500">Compile Error</span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">Syntax / Compilation Failed</span>
                </div>
              )}

              {testSuiteResult.status === 'runtime_error' && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-rose-500" />
                    <span className="text-base font-bold text-rose-500">Runtime Error</span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">Exception in execution</span>
                </div>
              )}

              {testSuiteResult.status === 'timeout' && (
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <div className="flex items-center gap-2">
                    <AlertTriangle size={16} className="text-amber-500" />
                    <span className="text-base font-bold text-amber-500">Time Limit Exceeded</span>
                  </div>
                  <span className="text-xs text-slate-500 font-mono">Execution timed out</span>
                </div>
              )}

              {/* If Compilation Error: show full error box */}
              {testSuiteResult.compilerError && (
                <div className="bg-rose-950/20 border border-rose-900/60 rounded-lg p-3">
                  <div className="text-[11px] font-semibold text-rose-400 mb-1.5 uppercase font-sans">
                    Compiler Diagnostics
                  </div>
                  <pre className="text-xs text-rose-300 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {testSuiteResult.compilerError}
                  </pre>
                </div>
              )}

              {/* If Runtime Error with no compiler error: show runtime traceback */}
              {testSuiteResult.runtimeError && !testSuiteResult.compilerError && (
                <div className="bg-rose-950/20 border border-rose-900/60 rounded-lg p-3">
                  <div className="text-[11px] font-semibold text-rose-400 mb-1.5 uppercase font-sans">
                    Error Traceback
                  </div>
                  <pre className="text-xs text-rose-300 font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed">
                    {testSuiteResult.runtimeError}
                  </pre>
                </div>
              )}

              {/* Case Tabs (Case 1, Case 2...) */}
              {testSuiteResult.testResults.length > 0 && (
                <div className="flex items-center gap-2 mt-1">
                  {testSuiteResult.testResults.map((tc, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedCaseIndex(idx)}
                      className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer border ${
                        selectedCaseIndex === idx
                          ? 'bg-slate-800 border-slate-700 text-slate-200'
                          : 'bg-slate-950/60 border-slate-800/80 text-slate-400 hover:bg-slate-800/40'
                      }`}
                    >
                      {tc.passed ? (
                        <CheckCircle size={11} className="text-emerald-400" />
                      ) : (
                        <XCircle size={11} className="text-rose-400" />
                      )}
                      <span>Case {idx + 1}</span>
                    </button>
                  ))}
                </div>
              )}

              {/* Selected Case Breakdown */}
              {testSuiteResult.testResults[selectedCaseIndex] && (
                <div className="flex flex-col gap-2.5 mt-1 font-mono text-xs">
                  {/* Input */}
                  <div>
                    <div className="text-slate-500 text-[10px] uppercase font-bold mb-1 font-sans">
                      Input
                    </div>
                    {formatInputDisplay(
                      testSuiteResult.testResults[selectedCaseIndex].input,
                      problem?.slug
                    )}
                  </div>

                  {/* Output */}
                  <div>
                    <div className="text-slate-500 text-[10px] uppercase font-bold mb-1 font-sans">
                      Output
                    </div>
                    <pre
                      className={`border rounded p-2 overflow-x-auto whitespace-pre-wrap font-mono text-xs ${
                        testSuiteResult.testResults[selectedCaseIndex].passed
                          ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-300'
                          : 'bg-rose-950/20 border-rose-900/50 text-rose-300'
                      }`}
                    >
                      {testSuiteResult.testResults[selectedCaseIndex].actualOutput}
                    </pre>
                  </div>

                  {/* Expected */}
                  <div>
                    <div className="text-slate-500 text-[10px] uppercase font-bold mb-1 font-sans">
                      Expected
                    </div>
                    <pre className="bg-slate-950 border border-slate-800 rounded p-2 text-emerald-400 overflow-x-auto whitespace-pre-wrap font-mono text-xs">
                      {testSuiteResult.testResults[selectedCaseIndex].expectedOutput}
                    </pre>
                  </div>

                  {/* Stdout Logs from print / console.log */}
                  {testSuiteResult.testResults[selectedCaseIndex].userStdout && (
                    <div>
                      <div className="text-slate-400 text-[10px] uppercase font-bold mb-1 font-sans flex items-center gap-1">
                        <Terminal size={10} />
                        <span>Stdout (Console Logs)</span>
                      </div>
                      <pre className="bg-slate-950 border border-slate-800 rounded p-2 text-slate-300 overflow-x-auto whitespace-pre-wrap font-mono text-xs">
                        {testSuiteResult.testResults[selectedCaseIndex].userStdout}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Submissions Tab */}
      {activeTab === 'submissions' && (
        <div className="flex-1 p-3 overflow-auto text-xs">
          {submitting ? (
            <div className="flex flex-col items-center justify-center py-12 gap-2 text-slate-400">
              <Loader2 size={20} className="animate-spin text-emerald-400" />
              <span>Judging submission against hidden test suite...</span>
            </div>
          ) : submissionResult ? (
            <div className="flex flex-col gap-3">
              {/* Submission Verdict Card */}
              <div
                className={`p-3.5 rounded-lg border flex items-center justify-between ${
                  submissionResult.verdict === 'accepted'
                    ? 'bg-emerald-950/30 border-emerald-800/80 text-emerald-300'
                    : 'bg-rose-950/30 border-rose-800/80 text-rose-300'
                }`}
              >
                <div>
                  <div className="font-bold text-sm uppercase flex items-center gap-2">
                    {submissionResult.verdict === 'accepted' ? (
                      <>
                        <CheckCircle size={15} className="text-emerald-400" />
                        <span>Accepted 🎉</span>
                      </>
                    ) : (
                      <>
                        <XCircle size={15} className="text-rose-400" />
                        <span>{submissionResult.verdict.replace('_', ' ')}</span>
                      </>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1">
                    Passed {submissionResult.passedCount} / {submissionResult.totalCount} tests
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-400 font-mono">
                  {submissionResult.executionTimeMs} ms
                </div>
              </div>

              {/* Submission History Table */}
              {submissionHistory.length > 0 && (
                <div>
                  <h4 className="text-[11px] font-semibold text-slate-400 uppercase mb-2">
                    Recent Submissions
                  </h4>
                  <div className="flex flex-col gap-1.5">
                    {submissionHistory.slice(0, 5).map((sub, i) => (
                      <div
                        key={i}
                        className="bg-slate-950/60 border border-slate-800 rounded-lg p-2 flex items-center justify-between font-mono text-[11px]"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`font-semibold uppercase text-[10px] ${
                              sub.status === 'accepted' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {sub.status.replace('_', ' ')}
                          </span>
                          <span className="text-slate-600">•</span>
                          <span className="text-slate-400">{sub.language}</span>
                        </div>
                        <div className="flex items-center gap-2 text-slate-500 text-[10px]">
                          <span>
                            {sub.passedCount}/{sub.totalCount} passed
                          </span>
                          <span>
                            {new Date(sub.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500">
              Click &ldquo;Submit&rdquo; to test your code against the full hidden test suite.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
