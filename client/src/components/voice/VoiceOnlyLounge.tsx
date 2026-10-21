import { Mic, MicOff, Code2, Users, Volume2 } from 'lucide-react';
import { useRoomStore } from '../../stores/room.store';
import { useAuthStore } from '../../stores/auth.store';
import { Button } from '../ui/Button';

export function VoiceOnlyLounge() {
  const { user } = useAuthStore();
  const {
    currentRoom,
    users,
    voiceParticipants,
    isMuted,
    isLocalSpeaking,
    toggleVoiceOnlyMode,
  } = useRoomStore();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 bg-slate-950 overflow-auto select-none">
      {/* Header */}
      <div className="text-center mb-10 max-w-md">
        <div className="inline-flex items-center gap-2 bg-indigo-950/60 border border-indigo-800/40 text-indigo-300 text-xs px-3 py-1 rounded-full mb-3">
          <Volume2 size={13} className="text-indigo-400" />
          <span>Voice-Only Lounge Mode</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-100 tracking-tight">
          {currentRoom?.name || 'Voice Discussion'}
        </h2>
        <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
          Discuss algorithm design, time complexity, and interview logic together.
        </p>

        <Button
          size="sm"
          variant="outline"
          onClick={toggleVoiceOnlyMode}
          className="mt-4 gap-2 text-xs"
        >
          <Code2 size={14} />
          Return to Code Editor
        </Button>
      </div>

      {/* Participant Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 max-w-4xl w-full">
        {/* Local User Card */}
        <div
          className={`flex flex-col items-center p-6 rounded-2xl border transition-all ${
            isLocalSpeaking
              ? 'bg-slate-900 border-emerald-500/80 shadow-xl shadow-emerald-500/10 ring-2 ring-emerald-500/30'
              : 'bg-slate-900/60 border-slate-800'
          }`}
        >
          <div className="relative mb-4">
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-indigo-700 to-indigo-500 flex items-center justify-center text-2xl font-bold text-white shadow-lg">
              {user?.username?.[0]?.toUpperCase() || 'U'}
            </div>
            {isLocalSpeaking && (
              <span className="absolute -inset-1.5 rounded-full border-2 border-emerald-400 animate-ping opacity-75 pointer-events-none" />
            )}
            <div
              className={`absolute bottom-0 right-0 p-1.5 rounded-full border-2 border-slate-900 ${
                isMuted ? 'bg-red-600 text-white' : 'bg-emerald-500 text-white'
              }`}
            >
              {isMuted ? <MicOff size={12} /> : <Mic size={12} />}
            </div>
          </div>

          <span className="font-semibold text-sm text-slate-100">{user?.username} (You)</span>
          <span className="text-[11px] text-slate-400 mt-0.5">
            {isMuted ? 'Muted' : isLocalSpeaking ? 'Speaking...' : 'Listening'}
          </span>

          {/* Sound Wave Animation */}
          <div className="flex items-center gap-1 mt-4 h-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <span
                key={i}
                className={`w-1 rounded-full transition-all duration-150 ${
                  isLocalSpeaking
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-slate-700 h-1.5'
                }`}
                style={{
                  height: isLocalSpeaking ? `${Math.max(6, (i * 5) % 18)}px` : '4px',
                }}
              />
            ))}
          </div>
        </div>

        {/* Remote Users Cards */}
        {users
          .filter((u) => u.username !== user?.username)
          .map((u) => {
            const vState = voiceParticipants.get(u.socketId);
            const inVoice = !!vState;
            const isSpeaking = vState?.isSpeaking ?? false;
            const isMuted = vState?.isMuted ?? true;

            return (
              <div
                key={u.socketId}
                className={`flex flex-col items-center p-6 rounded-2xl border transition-all ${
                  isSpeaking
                    ? 'bg-slate-900 border-emerald-500/80 shadow-xl shadow-emerald-500/10 ring-2 ring-emerald-500/30'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <div className="relative mb-4">
                  <div
                    className="w-20 h-20 rounded-full border-2 border-slate-900 flex items-center justify-center text-2xl font-bold text-white shadow-lg"
                    style={{ backgroundColor: u.color }}
                  >
                    {u.username[0]?.toUpperCase() || 'U'}
                  </div>
                  {isSpeaking && (
                    <span className="absolute -inset-1.5 rounded-full border-2 border-emerald-400 animate-ping opacity-75 pointer-events-none" />
                  )}
                  {inVoice && (
                    <div
                      className={`absolute bottom-0 right-0 p-1.5 rounded-full border-2 border-slate-900 ${
                        isMuted ? 'bg-red-600 text-white' : 'bg-emerald-500 text-white'
                      }`}
                    >
                      {isMuted ? <MicOff size={12} /> : <Mic size={12} />}
                    </div>
                  )}
                </div>

                <span className="font-semibold text-sm text-slate-100 truncate max-w-[140px]">
                  {u.username}
                </span>
                <span className="text-[11px] text-slate-400 mt-0.5">
                  {!inVoice
                    ? 'Not in voice'
                    : isMuted
                    ? 'Muted'
                    : isSpeaking
                    ? 'Speaking...'
                    : 'Listening'}
                </span>

                {/* Sound Wave Animation */}
                <div className="flex items-center gap-1 mt-4 h-5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span
                      key={i}
                      className={`w-1 rounded-full transition-all duration-150 ${
                        isSpeaking
                          ? 'bg-emerald-400 animate-pulse'
                          : 'bg-slate-700 h-1.5'
                      }`}
                      style={{
                        height: isSpeaking ? `${Math.max(6, (i * 6) % 18)}px` : '4px',
                      }}
                    />
                  ))}
                </div>
              </div>
            );
          })}
      </div>

      <div className="mt-12 flex items-center gap-2 text-xs text-slate-500">
        <Users size={14} />
        <span>{users.length} total participants in session</span>
      </div>
    </div>
  );
}
