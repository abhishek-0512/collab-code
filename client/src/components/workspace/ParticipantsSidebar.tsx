import {
  Users,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Edit3,
  Check,
  Shield,
} from 'lucide-react';
import { useRoomStore } from '../../stores/room.store';
import { Tooltip } from '../ui/Tooltip';
import type { WorkspaceStatus } from '../../types';

const LANG_LABELS: Record<string, string> = {
  javascript: 'JS',
  typescript: 'TS',
  python: 'PY',
  java: 'Java',
  cpp: 'C++',
  go: 'Go',
  rust: 'Rust',
};

const LANG_COLORS: Record<string, string> = {
  javascript: 'text-yellow-400',
  typescript: 'text-blue-400',
  python: 'text-green-400',
  java: 'text-orange-400',
  cpp: 'text-cyan-400',
  go: 'text-sky-400',
  rust: 'text-amber-500',
};

function VerdictIcon({ verdict }: { verdict: WorkspaceStatus['lastVerdict'] }) {
  if (!verdict) return null;
  switch (verdict) {
    case 'accepted':
      return <CheckCircle size={12} className="text-emerald-400" />;
    case 'wrong_answer':
      return <XCircle size={12} className="text-rose-400" />;
    case 'compile_error':
    case 'runtime_error':
      return <AlertCircle size={12} className="text-rose-400" />;
    case 'timeout':
      return <Clock size={12} className="text-amber-400" />;
    default:
      return null;
  }
}

interface ParticipantsSidebarProps {
  currentSocketId?: string | null;
  onToggleWriteAccess?: (targetSocketId: string, canWrite: boolean) => void;
}

export function ParticipantsSidebar({
  currentSocketId,
  onToggleWriteAccess,
}: ParticipantsSidebarProps) {
  const {
    users,
    workspaceStatuses,
    sharedSnapshots,
    editorPermissions,
    viewMode,
    focusedSocketId,
    setViewMode,
    setFocusedSocketId,
  } = useRoomStore();

  const sharedCount = Array.from(sharedSnapshots.keys()).length;

  // Collaborators that I have granted edit access to (my workspace)
  const myGrantedWriters = currentSocketId ? editorPermissions[currentSocketId] || [] : [];

  return (
    <aside className="w-60 border-r border-slate-800 bg-slate-900/70 flex flex-col overflow-hidden shrink-0 select-none">
      {/* Header */}
      <div className="px-3 py-2.5 border-b border-slate-800 bg-slate-950/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-300">
            <Users size={13} />
            <span>Participants ({users.length})</span>
          </div>
          <Tooltip content="Manage writing and reading permissions for your editor" position="bottom">
            <Shield size={12} className="text-slate-500 hover:text-slate-300 cursor-pointer" />
          </Tooltip>
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="flex border-b border-slate-800 text-[11px] bg-slate-950/40">
        <button
          onClick={() => {
            setViewMode('my-editor');
            setFocusedSocketId(null);
          }}
          className={`flex-1 py-2 text-center transition-colors cursor-pointer border-b-2 ${
            viewMode === 'my-editor'
              ? 'text-indigo-400 bg-slate-900/50 border-indigo-500 font-semibold'
              : 'text-slate-500 hover:text-slate-300 border-transparent'
          }`}
        >
          My Editor
        </button>
        <button
          onClick={() => {
            setViewMode('shared-grid');
            setFocusedSocketId(null);
          }}
          className={`flex-1 py-2 text-center transition-colors cursor-pointer border-b-2 ${
            viewMode === 'shared-grid'
              ? 'text-indigo-400 bg-slate-900/50 border-indigo-500 font-semibold'
              : 'text-slate-500 hover:text-slate-300 border-transparent'
          }`}
        >
          Shared ({sharedCount})
        </button>
      </div>

      {/* Participant List */}
      <div className="flex-1 overflow-y-auto py-2 flex flex-col gap-1 px-1.5">
        {users.map((user) => {
          const isMe = user.socketId === currentSocketId;
          const ws = workspaceStatuses.get(user.socketId);
          const lang = ws?.language || 'javascript';
          const shared = ws?.isShared || false;
          const running = ws?.isRunning || false;
          const hasSnapshot = sharedSnapshots.has(user.socketId);

          // Did I give this user permission to write in my editor?
          const iGaveWriteAccess = myGrantedWriters.includes(user.socketId);

          // Did this user give ME permission to write in their editor?
          const theyGaveMeWriteAccess = currentSocketId
            ? (editorPermissions[user.socketId] || []).includes(currentSocketId)
            : false;

          return (
            <div
              key={user.socketId}
              className={`rounded-lg border transition-all ${
                focusedSocketId === user.socketId
                  ? 'bg-indigo-950/40 border-indigo-700/60'
                  : 'bg-slate-950/40 border-slate-800/60 hover:border-slate-700'
              } p-2 flex flex-col gap-1.5`}
            >
              {/* Row 1: Avatar, Name, Language, Shared Eye, Verdict */}
              <div
                onClick={() => {
                  if (hasSnapshot && !isMe) {
                    setFocusedSocketId(user.socketId);
                    setViewMode('focused');
                  }
                }}
                className={`flex items-center gap-2 ${
                  hasSnapshot && !isMe ? 'cursor-pointer' : 'cursor-default'
                }`}
              >
                {/* Avatar */}
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ring-1 ring-white/10"
                  style={{ backgroundColor: user.color }}
                >
                  {user.username.charAt(0).toUpperCase()}
                </div>

                {/* Name & Indicators */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-medium text-slate-200 truncate">
                      {user.username} {isMe && <span className="text-slate-500 font-normal">(You)</span>}
                    </span>
                    {running && <Loader2 size={10} className="animate-spin text-emerald-400 shrink-0" />}
                    <VerdictIcon verdict={ws?.lastVerdict || null} />
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={`text-[10px] font-mono font-semibold ${LANG_COLORS[lang] || 'text-slate-400'}`}>
                      {LANG_LABELS[lang] || lang}
                    </span>
                    <span className="text-slate-600">•</span>
                    {shared ? (
                      <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400">
                        <Eye size={10} />
                        <span>Shared</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                        <EyeOff size={10} />
                        <span>Private</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2: Granular Permissions (Only for other collaborators) */}
              {!isMe && (
                <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
                  <span className="text-slate-500 text-[9px] uppercase font-semibold">Write Access</span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleWriteAccess?.(user.socketId, !iGaveWriteAccess);
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded transition-colors cursor-pointer border ${
                      iGaveWriteAccess
                        ? 'bg-emerald-950/60 border-emerald-700/60 text-emerald-300 hover:bg-emerald-900/50'
                        : 'bg-slate-800/80 border-slate-700/80 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                    }`}
                    title={
                      iGaveWriteAccess
                        ? 'Click to revoke write access to your editor'
                        : 'Click to allow this collaborator to edit your code'
                    }
                  >
                    {iGaveWriteAccess ? (
                      <>
                        <Edit3 size={9} className="text-emerald-400" />
                        <span>Can Edit</span>
                      </>
                    ) : (
                      <>
                        <Eye size={9} className="text-slate-400" />
                        <span>View Only</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Row 3: If this peer granted ME write access to their editor */}
              {!isMe && theyGaveMeWriteAccess && (
                <div className="bg-emerald-950/30 border border-emerald-900/40 rounded px-1.5 py-0.5 flex items-center gap-1 text-[9px] text-emerald-400">
                  <Check size={9} />
                  <span>Granted you edit access to their code</span>
                </div>
              )}
            </div>
          );
        })}

        {users.length === 0 && (
          <div className="text-center py-8 text-slate-600 text-xs">
            No participants yet
          </div>
        )}
      </div>
    </aside>
  );
}
