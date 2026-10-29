import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Users,
  Copy,
  Check,
  Play,
  Send,
  MessageSquare,
  BookOpen,
  Loader2,
  ArrowLeft,
  ChevronDown,
  Eye,
  EyeOff,
  RotateCcw,
  LayoutGrid,
} from 'lucide-react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Badge } from '../components/ui/Badge';
import { Tooltip } from '../components/ui/Tooltip';
import { useAuthStore } from '../stores/auth.store';
import { useRoomStore } from '../stores/room.store';
import { connectSocket, getSocket } from '../services/socket.service';
import { webrtcVoiceManager } from '../services/webrtc.service';
import { VoiceControls } from '../components/voice/VoiceControls';
import { VoiceOnlyLounge } from '../components/voice/VoiceOnlyLounge';
import { VoiceToTextComposer } from '../components/chat/VoiceToTextComposer';
import { VoiceNoteRecorder } from '../components/chat/VoiceNoteRecorder';
import { ParticipantsSidebar } from '../components/workspace/ParticipantsSidebar';
import { SharedEditorGrid } from '../components/workspace/SharedEditorGrid';
import { SharedEditorPanel } from '../components/workspace/SharedEditorPanel';
import { ProblemAndTestCasesPanel } from '../components/workspace/ProblemAndTestCasesPanel';
import * as roomService from '../services/room.service';
import * as problemService from '../services/problem.service';
import * as executionService from '../services/execution.service';
import type {
  Problem,
  ExecutionResult,
  Language,
  RoomUser,
  ChatMessage,
  TestSuiteEvaluationResult,
  WorkspaceStatus,
  SharedWorkspaceSnapshot,
} from '../types';

const LANGUAGE_MAP: Record<string, string> = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  java: 'java',
  cpp: 'cpp',
  go: 'go',
  rust: 'rust',
};

// Core supported languages as specified in the product brief
const SUPPORTED_LANGUAGES: Array<{ value: Language; label: string }> = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'typescript', label: 'TypeScript' },
];

export function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const {
    currentRoom,
    users,
    messages,
    isConnected,
    myCode,
    myLanguage,
    isSharing,
    viewMode,
    focusedSocketId,
    sharedSnapshots,
    editorPermissions,
    isVoiceOnlyMode,
    setCurrentRoom,
    setUsers,
    addUser,
    removeUser,
    addMessage,
    setConnected,
    setMyCode,
    setMyLanguage,
    setIsSharing,
    setWorkspaceStatuses,
    updateWorkspaceStatus,
    removeWorkspaceStatus,
    setSharedSnapshots,
    addSharedSnapshot,
    updateSharedSnapshot,
    removeSharedSnapshot,
    updateSharedSnapshotCode,
    setAllPermissions,
    updateEditorPermission,
    setViewMode,
    setFocusedSocketId,
    setVoiceParticipants,
    reset,
  } = useRoomStore();

  // Local State
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [allProblems, setAllProblems] = useState<Problem[]>([]);
  const [problemOpen, setProblemOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(true);
  const [copied, setCopied] = useState(false);

  // Execution & Testing State
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [executionResult, setExecutionResult] = useState<ExecutionResult | null>(null);
  const [testSuiteResult, setTestSuiteResult] = useState<TestSuiteEvaluationResult | null>(null);
  const [submissionResult, setSubmissionResult] = useState<executionService.SubmissionResponse | null>(null);
  const [submissionHistory, setSubmissionHistory] = useState<executionService.SubmissionRecord[]>([]);

  // Chat Input
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);

  // LeetCode Import State
  const [importInput, setImportInput] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState('');

  const handleImportLeetCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = importInput.trim();
    if (!query) return;
    setIsImporting(true);
    setImportError('');
    try {
      const fetched = await problemService.getProblem(query);
      if (fetched) {
        setAllProblems((prev) => (prev.find((x) => x.slug === fetched.slug) ? prev : [fetched, ...prev]));
        setProblem(fetched);
        if (fetched.starterCode) {
          const starter = fetched.starterCode[myLanguage] || fetched.starterCode.javascript || '';
          setMyCode(starter);
        }
        setImportInput('');
        setSearchParams({ problem: fetched.slug });
      }
    } catch (err: any) {
      setImportError(err.response?.data?.error || err.message || 'Failed to import LeetCode problem');
    } finally {
      setIsImporting(false);
    }
  };

  // 1. Initial Room & Problem Load
  useEffect(() => {
    if (!roomId) return;
    let mounted = true;

    roomService
      .getRoom(roomId)
      .then((roomData) => {
        if (!mounted) return;
        setCurrentRoom(roomData);
        // Default language from room if available
        if (roomData.language) {
          setMyLanguage(roomData.language as Language);
        }
      })
      .catch((err) => {
        console.error('Failed to load room:', err);
        navigate('/dashboard');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    // Fetch problem library
    const problemSlug = searchParams.get('problem');
    problemService
      .getProblems()
      .then(async (list) => {
        if (!mounted) return;
        setAllProblems(list);
        let selectedProblem: Problem | null = null;
        if (problemSlug) {
          selectedProblem = list.find((p) => p.slug === problemSlug) || null;
          if (!selectedProblem) {
            try {
              selectedProblem = await problemService.getProblem(problemSlug);
              if (selectedProblem && mounted) {
                setAllProblems((prev) => (prev.find((x) => x.slug === selectedProblem!.slug) ? prev : [selectedProblem!, ...prev]));
              }
            } catch {
              selectedProblem = null;
            }
          }
        }
        if (!selectedProblem && list.length > 0) {
          selectedProblem = list[0];
        }

        if (selectedProblem && mounted) {
          setProblem(selectedProblem);
          // Initialize starter template if code is empty
          if (!myCode && selectedProblem.starterCode) {
            const starter = selectedProblem.starterCode[myLanguage] || selectedProblem.starterCode.javascript || '';
            setMyCode(starter);
          }
        }
      })
      .catch(() => {});

    // Fetch initial submissions
    executionService
      .getSubmissions(roomId)
      .then((subs) => {
        if (mounted) setSubmissionHistory(subs);
      })
      .catch(() => {});

    return () => {
      mounted = false;
      webrtcVoiceManager.leaveVoice();
      reset();
    };
  }, [roomId]);

  // 2. Real-Time Socket Connection & Independent Workspace Signaling
  useEffect(() => {
    if (!roomId) return;

    const socket = connectSocket();

    const handleConnect = () => {
      setConnected(true);
      socket.emit('room:join', {
        roomId,
        username: user?.username || 'Guest',
      });
    };

    if (socket.connected) {
      handleConnect();
    } else {
      socket.on('connect', handleConnect);
    }

    // Room joined payload contains current users, workspace statuses, and existing shared snapshots
    socket.on(
      'room:joined',
      (data: {
        roomId: string;
        user: RoomUser;
        users: RoomUser[];
        workspaceStatuses?: WorkspaceStatus[];
        sharedSnapshots?: SharedWorkspaceSnapshot[];
        voiceParticipants?: any[];
      }) => {
        setUsers(data.users);
        if (data.workspaceStatuses) {
          setWorkspaceStatuses(data.workspaceStatuses);
        }
        if (data.sharedSnapshots) {
          setSharedSnapshots(data.sharedSnapshots);
        }
        if ((data as any).workspacePermissions) {
          setAllPermissions((data as any).workspacePermissions);
        }
        if (data.voiceParticipants) {
          setVoiceParticipants(data.voiceParticipants);
        }
        setConnected(true);
      }
    );

    // New user joined
    socket.on('room:user-joined', (data: { user: RoomUser; users: RoomUser[]; workspaceStatus?: WorkspaceStatus }) => {
      addUser(data.user);
      setUsers(data.users);
      if (data.workspaceStatus) {
        updateWorkspaceStatus(data.workspaceStatus);
      }
    });

    // User left room
    socket.on('room:user-left', (data: { socketId: string; users: RoomUser[] }) => {
      removeUser(data.socketId);
      setUsers(data.users);
      removeWorkspaceStatus(data.socketId);
      removeSharedSnapshot(data.socketId);
    });

    // Chat message received
    socket.on('room:message', (msg: ChatMessage) => {
      addMessage(msg);
    });

    // Workspace sharing events:
    // A participant clicked "Share Editor"
    socket.on('workspace:user-shared', (snapshot: SharedWorkspaceSnapshot) => {
      addSharedSnapshot(snapshot);
      updateWorkspaceStatus({
        socketId: snapshot.socketId,
        username: snapshot.username,
        isShared: true,
        language: snapshot.language,
        isRunning: false,
        lastVerdict: null,
      });
    });

    // A participant clicked "Stop Sharing"
    socket.on('workspace:user-unshared', (data: { socketId: string }) => {
      removeSharedSnapshot(data.socketId);
      // If currently focused on that editor, exit to grid
      if (focusedSocketId === data.socketId) {
        setViewMode('shared-grid');
        setFocusedSocketId(null);
      }
    });

    // Live code keystroke update from a shared editor
    socket.on('workspace:shared-update', (snapshot: SharedWorkspaceSnapshot) => {
      updateSharedSnapshot(snapshot);
    });

    // Participant changed language or running status
    socket.on('workspace:status-changed', (status: WorkspaceStatus) => {
      updateWorkspaceStatus(status);
    });

    // Collaborator write permission changed
    socket.on(
      'workspace:permission-updated',
      (data: {
        ownerSocketId: string;
        targetSocketId: string;
        canWrite: boolean;
        allowedWriters: string[];
      }) => {
        updateEditorPermission(data.ownerSocketId, data.targetSocketId, data.canWrite);
      }
    );

    // Live peer edit received (someone edited another user's editor)
    socket.on(
      'workspace:peer-code-updated',
      (data: {
        ownerSocketId: string;
        code: string;
        editorSocketId: string;
        editorUsername: string;
      }) => {
        if (data.ownerSocketId === socket.id) {
          // A collaborator edited MY code!
          setMyCode(data.code);
        } else {
          // A collaborator edited another user's shared editor
          updateSharedSnapshotCode(data.ownerSocketId, data.code);
        }
      }
    );

    // Disconnect
    socket.on('disconnect', () => {
      setConnected(false);
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('room:joined');
      socket.off('room:user-joined');
      socket.off('room:user-left');
      socket.off('room:message');
      socket.off('workspace:user-shared');
      socket.off('workspace:user-unshared');
      socket.off('workspace:shared-update');
      socket.off('workspace:status-changed');
      socket.off('workspace:permission-updated');
      socket.off('workspace:peer-code-updated');
      socket.off('workspace:shared-update');
      socket.off('workspace:status-changed');
      socket.off('disconnect');
    };
  }, [roomId, user?.username, focusedSocketId]);

  // Scroll chat to bottom on new message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // 3. Editor Mount
  const handleEditorMount: OnMount = useCallback(
    (editor) => {
      editorRef.current = editor;
    },
    []
  );

  // 4. Local Code Change in Personal Editor
  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      const nextCode = value ?? '';
      setMyCode(nextCode);

      // Only broadcast code to the room if the user has explicitly shared their editor
      const socket = getSocket();
      if (socket && roomId && isSharing) {
        socket.emit('workspace:update', {
          roomId,
          code: nextCode,
          language: myLanguage,
        });
      }
    },
    [roomId, isSharing, myLanguage]
  );

  // 5. Independent Language Selection
  const handleLanguageChange = (newLang: Language) => {
    setMyLanguage(newLang);

    // If editor is empty or matches previous starter code, automatically load the new starter template
    if (problem?.starterCode) {
      const newStarter = problem.starterCode[newLang];
      if (newStarter) {
        // If current code is empty or matches a known starter template, swap to new template
        const isDefaultCode =
          !myCode.trim() ||
          Object.values(problem.starterCode).some((s) => s.trim() === myCode.trim());

        if (isDefaultCode) {
          setMyCode(newStarter);
        }
      }
    }

    // Broadcast status change to room (does NOT change anyone else's language)
    const socket = getSocket();
    if (socket && roomId) {
      socket.emit('workspace:language', {
        roomId,
        language: newLang,
      });

      // If already sharing, send updated code/language snapshot
      if (isSharing) {
        socket.emit('workspace:update', {
          roomId,
          code: myCode,
          language: newLang,
        });
      }
    }
  };

  // 6. Reset to Starter Template
  const handleResetTemplate = () => {
    if (!problem?.starterCode) return;
    const starter = problem.starterCode[myLanguage] || problem.starterCode.javascript || '';
    if (starter) {
      setMyCode(starter);
      const socket = getSocket();
      if (socket && roomId && isSharing) {
        socket.emit('workspace:update', {
          roomId,
          code: starter,
          language: myLanguage,
        });
      }
    }
  };

  // 7. Toggle Share / Unshare Editor
  const handleToggleShare = () => {
    const socket = getSocket();
    if (!socket || !roomId) return;

    if (!isSharing) {
      // Owner shares their editor
      setIsSharing(true);
      socket.emit('workspace:share', { roomId });
      // Send current code snapshot
      socket.emit('workspace:update', {
        roomId,
        code: myCode,
        language: myLanguage,
      });
    } else {
      // Owner unshares their editor (code remains private without deleting)
      setIsSharing(false);
      socket.emit('workspace:unshare', { roomId });
    }
  };

  // 7b. Grant / Revoke Collaborator Write Permission
  const handleToggleWriteAccess = (targetSocketId: string, canWrite: boolean) => {
    const socket = getSocket();
    if (!socket?.id || !roomId) return;
    updateEditorPermission(socket.id, targetSocketId, canWrite);
    socket.emit('workspace:grant-write', {
      roomId,
      targetSocketId,
      canWrite,
    });
  };

  // 7c. Collaborator edits a shared editor where they have write permission
  const handlePeerEdit = (ownerSocketId: string, newCode: string) => {
    const socket = getSocket();
    if (!socket || !roomId) return;
    updateSharedSnapshotCode(ownerSocketId, newCode);
    socket.emit('workspace:peer-edit', {
      roomId,
      ownerSocketId,
      code: newCode,
    });
  };

  // 8. Run Sample Tests Action
  const handleRunSampleTests = async (customInputOverride?: string) => {
    if (!myCode.trim()) return;

    setRunning(true);
    const socket = getSocket();
    if (socket && roomId) {
      socket.emit('workspace:running', { roomId, isRunning: true });
    }

    try {
      // If user typed custom input or passed custom input override, run against custom test case
      const hasCustom = typeof customInputOverride === 'string' && customInputOverride.trim().length > 0;
      const testCasesToRun = hasCustom
        ? [{ input: customInputOverride.trim(), expectedOutput: '' }]
        : undefined;

      const evalResult = await executionService.testCode({
        code: myCode,
        language: myLanguage,
        problemSlug: problem?.slug,
        testCases: testCasesToRun,
      });

      setTestSuiteResult(evalResult);

      if (socket && roomId) {
        socket.emit('workspace:running', {
          roomId,
          isRunning: false,
          lastVerdict: evalResult.status,
        });
      }
    } catch (err: any) {
      console.error('Test run failed:', err);
      const errMsg = err.response?.data?.error || err.message || 'Execution failed';
      setTestSuiteResult({
        allPassed: false,
        totalCases: 0,
        passedCases: 0,
        status: 'judge_error',
        totalTimeMs: 0,
        compilerError: errMsg,
        testResults: [],
      });
      if (socket && roomId) {
        socket.emit('workspace:running', {
          roomId,
          isRunning: false,
          lastVerdict: 'runtime_error',
        });
      }
    } finally {
      setRunning(false);
    }
  };

  // 9. Submit Solution Action (Evaluates Full Test Suite with Hidden Tests)
  const handleSubmitSolution = async () => {
    if (!myCode.trim() || !roomId) return;

    setSubmitting(true);
    const socket = getSocket();
    if (socket && roomId) {
      socket.emit('workspace:running', { roomId, isRunning: true });
    }

    try {
      const response = await executionService.submitCode({
        code: myCode,
        language: myLanguage,
        roomId,
        problemSlug: problem?.slug,
      });

      setSubmissionResult(response);

      // Refresh submissions history
      executionService.getSubmissions(roomId).then(setSubmissionHistory).catch(() => {});

      if (socket && roomId) {
        socket.emit('workspace:running', {
          roomId,
          isRunning: false,
          lastVerdict: response.verdict,
        });
      }
    } catch (err: any) {
      console.error('Submission failed:', err);
      const errMsg = err.response?.data?.error || err.message || 'Submission failed';
      setTestSuiteResult({
        allPassed: false,
        totalCases: 0,
        passedCases: 0,
        status: 'judge_error',
        totalTimeMs: 0,
        compilerError: errMsg,
        testResults: [],
      });
      if (socket && roomId) {
        socket.emit('workspace:running', {
          roomId,
          isRunning: false,
          lastVerdict: 'runtime_error',
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  // 10. Run Code (Quick Execution without Test Harness)
  const handleRunCode = async () => {
    if (!myCode.trim()) return;

    setRunning(true);
    try {
      const result = await executionService.runCode({
        code: myCode,
        language: myLanguage,
        stdin: customInput.trim() || undefined,
        roomId,
      });
      setExecutionResult(result);
    } catch (err: any) {
      setExecutionResult({
        stdout: '',
        stderr: err?.response?.data?.error || err.message || 'Execution error',
        exitCode: 1,
        executionTimeMs: 0,
        status: 'error',
      });
    } finally {
      setRunning(false);
    }
  };

  // Keyboard shortcut handler for online compiler experience (Ctrl/Cmd + Enter to Submit, Ctrl/Cmd + ' to Run)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isCmdOrCtrl = e.metaKey || e.ctrlKey;
      if (isCmdOrCtrl && e.key === 'Enter') {
        e.preventDefault();
        handleSubmitSolution();
      } else if (isCmdOrCtrl && (e.key === "'" || e.key === '"')) {
        e.preventDefault();
        if (problem) {
          handleRunSampleTests();
        } else {
          handleRunCode();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [problem, myCode, myLanguage, roomId, running, submitting]);

  // Chat message handlers
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !roomId) return;

    const socket = getSocket();
    socket.emit('room:message', {
      roomId,
      message: chatInput.trim(),
    });

    setChatInput('');
  };

  const handleSendVoiceTranscription = (text: string) => {
    if (!text.trim() || !roomId) return;
    const socket = getSocket();
    socket.emit('room:message', {
      roomId,
      message: text.trim(),
      isVoiceTranscribed: true,
    });
  };

  const handleSendAudioNote = (audioDataUrl: string, durationSeconds: number) => {
    if (!audioDataUrl || !roomId) return;
    const socket = getSocket();
    socket.emit('room:message', {
      roomId,
      message: `Audio note (${durationSeconds}s)`,
      audioUrl: audioDataUrl,
    });
  };

  const handleCopyInvite = () => {
    if (!currentRoom) return;
    navigator.clipboard.writeText(currentRoom.inviteCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-950 text-slate-400 gap-3">
        <Loader2 size={24} className="text-indigo-500 animate-spin" />
        <span className="text-xs">Connecting to collaborative DSA session...</span>
      </div>
    );
  }

  // Get focused snapshot if in focused mode
  const focusedSnapshot = focusedSocketId ? sharedSnapshots.get(focusedSocketId) : null;

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 overflow-hidden text-slate-100 font-sans selection:bg-indigo-500/30">
      {/* ─── Top Workspace Header ───────────────────────────────── */}
      <header className="h-12 border-b border-slate-800/90 bg-slate-900/90 px-4 flex items-center justify-between gap-3 shrink-0 select-none z-10">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => navigate('/dashboard')}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Back to Dashboard"
          >
            <ArrowLeft size={16} />
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <span className="font-semibold text-sm text-slate-100 truncate max-w-[160px] sm:max-w-[220px]">
              {currentRoom?.name || 'DSA Study Room'}
            </span>
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                isConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-amber-400'
              }`}
              title={isConnected ? 'Connected' : 'Connecting'}
            />
          </div>

          {/* Problem Pill / Selector in Header */}
          {problem && (
            <button
              onClick={() => setProblemOpen((prev) => !prev)}
              className="hidden md:flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 px-2.5 py-1 rounded-lg text-xs font-medium text-slate-300 transition-colors cursor-pointer"
            >
              <BookOpen size={12} className="text-indigo-400" />
              <span className="truncate max-w-[140px]">{problem.title}</span>
              <Badge
                variant={
                  problem.difficulty === 'easy'
                    ? 'success'
                    : problem.difficulty === 'medium'
                    ? 'warning'
                    : 'danger'
                }
              >
                {problem.difficulty}
              </Badge>
            </button>
          )}
        </div>

        {/* Right Header: Voice, Copy Invite, and Chat Toggle */}
        <div className="flex items-center gap-2">
          {roomId && <VoiceControls roomId={roomId} />}

          {currentRoom && (
            <button
              onClick={handleCopyInvite}
              className="flex items-center gap-1.5 bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-slate-300 text-xs px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
              title="Copy Room Invite Code"
            >
              {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
              <span className="font-mono text-[11px]">{copied ? 'Copied' : currentRoom.inviteCode}</span>
            </button>
          )}
        </div>
      </header>

      {/* ─── Main Workspace Area ───────────────────────────────── */}
      {isVoiceOnlyMode ? (
        <VoiceOnlyLounge />
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* 1. Left Participants Sidebar */}
          <ParticipantsSidebar
            currentSocketId={getSocket()?.id}
            onToggleWriteAccess={handleToggleWriteAccess}
          />

          {/* 2. Left-Center Drawer: Problem Description Panel */}
          {problemOpen && (
            <aside className="w-80 md:w-96 border-r border-slate-800 bg-slate-900/40 flex flex-col overflow-hidden shrink-0">
              <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800/80 bg-slate-900/90 gap-2">
                <select
                  value={problem?.slug || ''}
                  onChange={(e) => {
                    const selected = allProblems.find((p) => p.slug === e.target.value);
                    if (selected) {
                      setProblem(selected);
                      // Update starter template if personal editor is empty
                      if (!myCode.trim() && selected.starterCode) {
                        setMyCode(selected.starterCode[myLanguage] || selected.starterCode.javascript || '');
                      }
                    }
                  }}
                  className="flex-1 bg-slate-800 border border-slate-700/80 rounded px-2 py-1 text-xs text-slate-200 truncate focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                >
                  {allProblems.map((p) => (
                    <option key={p.slug} value={p.slug} className="bg-slate-900 text-slate-100">
                      {p.title} ({p.difficulty})
                    </option>
                  ))}
                </select>

                <button
                  onClick={() => setProblemOpen(false)}
                  className="text-slate-400 hover:text-slate-200 text-xs px-1.5 py-1 rounded hover:bg-slate-800 cursor-pointer shrink-0"
                  title="Close problem drawer"
                >
                  ✕
                </button>
              </div>

              {/* Import any LeetCode Problem */}
              <form onSubmit={handleImportLeetCode} className="px-3 py-2 border-b border-slate-800 bg-slate-950/60 flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    placeholder="Paste LeetCode URL or slug (e.g. 3sum)"
                    value={importInput}
                    onChange={(e) => setImportInput(e.target.value)}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-mono"
                  />
                  <button
                    type="submit"
                    disabled={isImporting || !importInput.trim()}
                    className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-[11px] font-medium text-white rounded transition-colors shrink-0 cursor-pointer"
                  >
                    {isImporting ? '...' : 'Import'}
                  </button>
                </div>
                {importError && (
                  <div className="text-[10px] text-rose-400 font-sans">{importError}</div>
                )}
              </form>

              <div className="flex-1 overflow-auto p-4 text-xs leading-relaxed text-slate-300 flex flex-col gap-4">
                {problem ? (
                  <>
                    <div>
                      <h3 className="font-bold text-sm text-slate-100">{problem.title}</h3>
                      <div className="flex items-center gap-2 mt-1.5">
                        <Badge
                          variant={
                            problem.difficulty === 'easy'
                              ? 'success'
                              : problem.difficulty === 'medium'
                              ? 'warning'
                              : 'danger'
                          }
                        >
                          {problem.difficulty}
                        </Badge>
                        {problem.tags.map((t) => (
                          <span
                            key={t}
                            className="text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded"
                          >
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="whitespace-pre-wrap leading-relaxed text-slate-300">
                      {problem.description}
                    </div>

                    <div>
                      <h4 className="font-semibold text-slate-200 mb-2">Examples</h4>
                      <div className="flex flex-col gap-2.5">
                        {problem.examples.map((ex, i) => (
                          <div
                            key={i}
                            className="bg-slate-900/90 border border-slate-800 rounded-lg p-2.5 font-mono text-[11px]"
                          >
                            <div className="text-slate-400 text-[10px] uppercase font-sans mb-1 font-semibold">
                              Example {i + 1}
                            </div>
                            <div>
                              <span className="text-slate-500">Input: </span>
                              <span className="text-slate-200">{ex.input}</span>
                            </div>
                            <div>
                              <span className="text-slate-500">Output: </span>
                              <span className="text-emerald-300">{ex.output}</span>
                            </div>
                            {ex.explanation && (
                              <div className="text-slate-400 font-sans text-[11px] mt-1 pt-1 border-t border-slate-800/60">
                                {ex.explanation}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {problem.constraints && (
                      <div className="bg-slate-900/60 border border-slate-800/80 rounded-lg p-3">
                        <h4 className="font-semibold text-slate-200 mb-1 text-[11px]">Constraints</h4>
                        <pre className="whitespace-pre-wrap text-[11px] text-slate-400 font-mono">
                          {problem.constraints}
                        </pre>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-12 text-slate-500">
                    <p>No problem selected.</p>
                  </div>
                )}
              </div>
            </aside>
          )}

          {/* 3. Center Workspace: Either "My Editor" OR "Shared Grid" OR "Focused Editor" */}
          <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
            {/* View Mode 1: My Personal Editor */}
            {viewMode === 'my-editor' && (
              <div className="flex-1 flex flex-col overflow-hidden">
                {/* Personal Editor Toolbar */}
                <div className="h-10 border-b border-slate-800/80 bg-slate-900/60 px-3 flex items-center justify-between text-xs shrink-0 select-none">
                  {/* Left: Language Selector & Reset Template */}
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1.5 font-medium text-slate-300">
                      <span className="text-[11px] text-slate-500 font-sans">Language:</span>
                      <div className="relative">
                        <select
                          value={myLanguage}
                          onChange={(e) => handleLanguageChange(e.target.value as Language)}
                          className="appearance-none bg-slate-800 hover:bg-slate-700/80 border border-slate-700/80 rounded px-2.5 py-1 text-xs font-semibold text-indigo-300 pr-6 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          {SUPPORTED_LANGUAGES.map((l) => (
                            <option key={l.value} value={l.value} className="bg-slate-900 text-slate-200">
                              {l.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown
                          size={11}
                          className="absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
                        />
                      </div>
                    </div>

                    <Tooltip content="Reset code to official problem template for current language" position="bottom">
                      <button
                        onClick={handleResetTemplate}
                        className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        <RotateCcw size={13} />
                      </button>
                    </Tooltip>

                    <button
                      onClick={() => (problem ? handleRunSampleTests() : handleRunCode())}
                      disabled={running || submitting}
                      className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-slate-700/80 text-xs font-medium transition-colors cursor-pointer disabled:opacity-50"
                      title="Run code against sample test cases (Ctrl/Cmd + ')"
                    >
                      {running ? (
                        <Loader2 size={11} className="animate-spin text-emerald-400" />
                      ) : (
                        <Play size={11} className="text-emerald-400 fill-emerald-400" />
                      )}
                      <span>Run</span>
                    </button>

                    <button
                      onClick={handleSubmitSolution}
                      disabled={running || submitting}
                      className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 shadow-sm shadow-emerald-600/30"
                      title="Submit solution to verify all test cases (Ctrl/Cmd + Enter)"
                    >
                      {submitting ? (
                        <Loader2 size={11} className="animate-spin text-white" />
                      ) : (
                        <Check size={12} />
                      )}
                      <span>Submit</span>
                    </button>
                  </div>

                  {/* Right: Sharing Status Toggle */}
                  <div className="flex items-center gap-2">
                    <Tooltip
                      content={
                        isSharing
                          ? 'Your editor is live-visible to meeting participants. Click to make private.'
                          : 'Your editor is currently private. Click to share it live with participants.'
                      }
                      position="bottom"
                    >
                      <button
                        onClick={handleToggleShare}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                          isSharing
                            ? 'bg-emerald-950/40 border-emerald-800/60 text-emerald-300 hover:bg-emerald-900/40'
                            : 'bg-slate-800 border-slate-700/80 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {isSharing ? (
                          <>
                            <Eye size={12} className="text-emerald-400" />
                            <span>Sharing Live</span>
                          </>
                        ) : (
                          <>
                            <EyeOff size={12} className="text-slate-400" />
                            <span>Share Editor</span>
                          </>
                        )}
                      </button>
                    </Tooltip>

                    {/* Quick Button to View Shared Grid */}
                    <button
                      onClick={() => setViewMode('shared-grid')}
                      className="flex items-center gap-1 bg-slate-800 hover:bg-slate-700 border border-slate-700/80 text-slate-300 text-xs px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                      title="View all shared editors"
                    >
                      <LayoutGrid size={12} className="text-indigo-400" />
                      <span className="hidden sm:inline">Shared Grid</span>
                    </button>
                  </div>
                </div>

                {/* Monaco Editor */}
                <div className="flex-1 min-h-0 bg-slate-950">
                  <Editor
                    height="100%"
                    language={LANGUAGE_MAP[myLanguage] || 'javascript'}
                    value={myCode}
                    onChange={handleEditorChange}
                    onMount={handleEditorMount}
                    theme="vs-dark"
                    options={{
                      fontSize: 14,
                      fontFamily: "'JetBrains Mono', Consolas, Menlo, monospace",
                      minimap: { enabled: false },
                      scrollBeyondLastLine: false,
                      lineNumbers: 'on',
                      lineHeight: 22,
                      tabSize: 2,
                      cursorBlinking: 'smooth',
                      cursorSmoothCaretAnimation: 'on',
                      smoothScrolling: true,
                      automaticLayout: true,
                      padding: { top: 12, bottom: 12 },
                      wordWrap: 'off',
                    }}
                  />
                </div>

                {/* Bottom Test Cases & Results Panel */}
                <ProblemAndTestCasesPanel
                  problem={problem}
                  running={running}
                  submitting={submitting}
                  executionResult={executionResult}
                  testSuiteResult={testSuiteResult}
                  submissionResult={submissionResult}
                  submissionHistory={submissionHistory}
                  customInput={customInput}
                  setCustomInput={setCustomInput}
                  onRunSampleTests={handleRunSampleTests}
                  onSubmitSolution={handleSubmitSolution}
                />
              </div>
            )}

            {/* View Mode 2: Multi-Editor Shared Grid */}
            {viewMode === 'shared-grid' && (
              <SharedEditorGrid
                currentSocketId={getSocket()?.id}
                onPeerEdit={handlePeerEdit}
              />
            )}

            {/* View Mode 3: Focused Single Shared Editor (Zoom / Maximize) */}
            {viewMode === 'focused' && focusedSnapshot && (
              <div className="flex-1 flex flex-col overflow-hidden bg-slate-950">
                {/* Focused Editor Top Bar */}
                <div className="h-10 border-b border-slate-800/80 bg-slate-900/80 px-3 flex items-center justify-between text-xs shrink-0 select-none">
                  <div className="flex items-center gap-2">
                    <span className="text-indigo-400 font-semibold">Viewing:</span>
                    <span className="font-bold text-slate-200">{focusedSnapshot.username}&apos;s Editor</span>
                    <Badge variant="default" className="text-[10px] font-mono">
                      {focusedSnapshot.language}
                    </Badge>
                    {editorPermissions[focusedSnapshot.socketId]?.includes(getSocket()?.id || '') ? (
                      <span className="text-[11px] text-emerald-400 font-medium">
                        (Write Access Granted • Live Synchronized)
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500">
                        (Read-Only • Live Synchronized)
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        setViewMode('shared-grid');
                        setFocusedSocketId(null);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs transition-colors cursor-pointer"
                    >
                      <LayoutGrid size={12} />
                      <span>Back to Grid</span>
                    </button>
                    <button
                      onClick={() => {
                        setViewMode('my-editor');
                        setFocusedSocketId(null);
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-xs transition-colors cursor-pointer"
                    >
                      <span>Return to My Editor</span>
                    </button>
                  </div>
                </div>

                {/* Maximized Editor */}
                <div className="flex-1 min-h-0 p-2">
                  <SharedEditorPanel
                    snapshot={focusedSnapshot}
                    isFocused={true}
                    canWrite={Boolean(
                      getSocket()?.id &&
                      (editorPermissions[focusedSnapshot.socketId] || []).includes(getSocket()?.id || '')
                    )}
                    onCodeChange={(newCode) => handlePeerEdit(focusedSnapshot.socketId, newCode)}
                  />
                </div>
              </div>
            )}
          </div>

          {/* 4. Right Drawer: Collaborative Chat & Notes */}
          {chatOpen && (
            <aside className="w-80 md:w-88 border-l border-slate-800 bg-slate-900/60 flex flex-col overflow-hidden shrink-0">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-800/80 bg-slate-900/90 text-xs shrink-0 select-none">
                <div className="flex items-center gap-1.5 font-semibold text-slate-300">
                  <MessageSquare size={13} />
                  <span>Discussion Chat</span>
                  {messages.length > 0 && (
                    <span className="text-[10px] bg-slate-800 px-1.5 rounded-full text-slate-400">
                      {messages.length}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setChatOpen(false)}
                  className="text-slate-400 hover:text-slate-200 text-xs px-1.5 py-0.5 rounded hover:bg-slate-800 cursor-pointer"
                  title="Close chat"
                >
                  ✕
                </button>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-auto p-3 flex flex-col gap-3">
                {messages.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-xs">
                    <MessageSquare size={22} className="mx-auto mb-2 text-slate-600" />
                    <p>Room discussion is active.</p>
                    <p className="mt-1 text-[11px]">Discuss problem strategies, approaches, and time complexities!</p>
                  </div>
                ) : (
                  messages.map((m, idx) => (
                    <div key={idx} className="flex flex-col text-xs">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-semibold text-[11px]" style={{ color: m.color || '#818cf8' }}>
                          {m.username}
                        </span>
                        <span className="text-[10px] text-slate-600">
                          {new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {m.isVoiceTranscribed && (
                          <span className="text-[9px] text-indigo-400 bg-indigo-950/60 border border-indigo-800/40 px-1 py-0.2 rounded">
                            Voice-to-Text
                          </span>
                        )}
                      </div>

                      <div className="mt-0.5 bg-slate-900/80 border border-slate-800/80 rounded-lg p-2 leading-relaxed">
                        <p className="text-slate-300 break-words">{m.message}</p>
                        {m.audioUrl && (
                          <div className="mt-2 pt-1.5 border-t border-slate-800/80 flex items-center gap-2">
                            <audio controls src={m.audioUrl} className="h-7 w-full" />
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Chat Input Bar */}
              <form
                onSubmit={handleSendMessage}
                className="p-2.5 border-t border-slate-800 bg-slate-900/90 flex items-center gap-1.5 relative"
              >
                <VoiceToTextComposer onSendMessage={handleSendVoiceTranscription} />
                <VoiceNoteRecorder onSendAudioNote={handleSendAudioNote} />

                <input
                  type="text"
                  placeholder="Discuss problem..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  maxLength={500}
                />

                <button
                  type="submit"
                  disabled={!chatInput.trim()}
                  className="p-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors cursor-pointer"
                >
                  <Send size={13} />
                </button>
              </form>
            </aside>
          )}
        </div>
      )}

      {/* ─── Bottom Status Rail ───────────────────────────────── */}
      <footer className="h-7 border-t border-slate-800/90 bg-slate-900/90 px-4 flex items-center justify-between text-[11px] text-slate-400 select-none shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isConnected ? 'bg-emerald-400' : 'bg-amber-400'
              }`}
            />
            <span>{isConnected ? 'Sync active' : 'Connecting...'}</span>
          </div>
          <span>•</span>
          <div className="flex items-center gap-1">
            <Users size={11} />
            <span>{users.length} in meeting</span>
          </div>
          <span>•</span>
          <span className="font-mono text-slate-500">Room: {currentRoom?.roomId}</span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setProblemOpen((prev) => !prev)}
            className="hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <BookOpen size={11} />
            <span>{problemOpen ? 'Hide Problem' : 'Show Problem'}</span>
          </button>
          <button
            onClick={() => setChatOpen((prev) => !prev)}
            className="hover:text-slate-200 flex items-center gap-1 transition-colors cursor-pointer"
          >
            <MessageSquare size={11} />
            <span>{chatOpen ? 'Hide Chat' : 'Show Chat'}</span>
          </button>
        </div>
      </footer>
    </div>
  );
}
