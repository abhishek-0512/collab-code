import Editor from '@monaco-editor/react';
import { Maximize2, Minimize2, Edit3, Lock } from 'lucide-react';
import { useRoomStore } from '../../stores/room.store';
import type { SharedWorkspaceSnapshot } from '../../types';

const LANG_MAP: Record<string, string> = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  java: 'java',
  cpp: 'cpp',
  go: 'go',
  rust: 'rust',
};

const LANG_LABELS: Record<string, string> = {
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  python: 'Python',
  java: 'Java',
  cpp: 'C++',
  go: 'Go',
  rust: 'Rust',
};

interface SharedEditorPanelProps {
  snapshot: SharedWorkspaceSnapshot;
  isFocused?: boolean;
  canWrite?: boolean;
  onCodeChange?: (newCode: string) => void;
}

export function SharedEditorPanel({
  snapshot,
  isFocused,
  canWrite = false,
  onCodeChange,
}: SharedEditorPanelProps) {
  const { setViewMode, setFocusedSocketId } = useRoomStore();

  const handleMaximize = () => {
    setFocusedSocketId(snapshot.socketId);
    setViewMode('focused');
  };

  const handleMinimize = () => {
    setViewMode('shared-grid');
    setFocusedSocketId(null);
  };

  return (
    <div className="flex flex-col h-full border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
      {/* Editor Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-slate-900/90 border-b border-slate-800/80 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
            style={{ backgroundColor: snapshot.color }}
          >
            {snapshot.username.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs font-medium text-slate-200 truncate">{snapshot.username}</span>
          <span className="text-[10px] font-mono text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
            {LANG_LABELS[snapshot.language] || snapshot.language}
          </span>

          {/* Write / Read-Only Status Indicator */}
          {canWrite ? (
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/60 px-2 py-0.5 rounded font-medium">
              <Edit3 size={10} />
              <span>Can Edit</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[10px] text-slate-500 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded">
              <Lock size={10} />
              <span>Read Only</span>
            </span>
          )}
        </div>

        <button
          onClick={isFocused ? handleMinimize : handleMaximize}
          className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          title={isFocused ? 'Exit full view' : 'Maximize'}
        >
          {isFocused ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
        </button>
      </div>

      {/* Write Permission Banner */}
      {canWrite && (
        <div className="bg-emerald-950/40 border-b border-emerald-900/50 px-3 py-1 text-[11px] text-emerald-300 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5">
            <Edit3 size={11} className="text-emerald-400" />
            <span>You have write access to {snapshot.username}&apos;s code. Your edits sync live!</span>
          </div>
        </div>
      )}

      {/* Monaco Editor: Editable if canWrite is true, else Read-Only */}
      <div className="flex-1">
        <Editor
          height="100%"
          language={LANG_MAP[snapshot.language] || 'javascript'}
          value={snapshot.code}
          onChange={(val) => {
            if (canWrite && onCodeChange) {
              onCodeChange(val || '');
            }
          }}
          theme="vs-dark"
          options={{
            readOnly: !canWrite,
            fontSize: 13,
            fontFamily: "'JetBrains Mono', Consolas, Menlo, monospace",
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            lineNumbers: 'on',
            lineHeight: 20,
            tabSize: 2,
            automaticLayout: true,
            padding: { top: 8, bottom: 8 },
            domReadOnly: !canWrite,
            renderLineHighlight: canWrite ? 'line' : 'none',
            cursorStyle: canWrite ? 'line' : 'underline',
          }}
        />
      </div>
    </div>
  );
}
