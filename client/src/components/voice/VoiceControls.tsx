import { useState } from 'react';
import { Mic, MicOff, PhoneCall, PhoneOff, Radio, Volume2, AlertCircle } from 'lucide-react';
import { useRoomStore } from '../../stores/room.store';
import { webrtcVoiceManager } from '../../services/webrtc.service';
import { Tooltip } from '../ui/Tooltip';

interface VoiceControlsProps {
  roomId: string;
}

export function VoiceControls({ roomId }: VoiceControlsProps) {
  const {
    isVoiceJoined,
    isMuted,
    isLocalSpeaking,
    voiceStatus,
    voiceError,
    voiceParticipants,
    isVoiceOnlyMode,
    setVoiceJoined,
    setIsMuted,
    setIsLocalSpeaking,
    setVoiceStatus,
    setVoiceError,
    addVoiceParticipant,
    removeVoiceParticipant,
    updateVoiceParticipantMute,
    updateVoiceParticipantSpeaking,
    toggleVoiceOnlyMode,
  } = useRoomStore();

  const [loading, setLoading] = useState(false);
  const isConnecting = voiceStatus === 'connecting' || loading;

  const handleJoinVoice = async () => {
    setLoading(true);
    setVoiceError(null);

    await webrtcVoiceManager.joinVoice(roomId, {
      onStatusChange: (status) => {
        setVoiceStatus(status);
        if (status === 'connected') {
          setVoiceJoined(true);
          setIsMuted(webrtcVoiceManager.getIsMuted());
        } else if (status === 'idle' || status === 'error') {
          setVoiceJoined(false);
        }
      },
      onParticipantJoined: (p) => {
        addVoiceParticipant(p);
      },
      onParticipantLeft: (socketId) => {
        removeVoiceParticipant(socketId);
      },
      onParticipantMute: (socketId, muted) => {
        updateVoiceParticipantMute(socketId, muted);
      },
      onParticipantSpeaking: (socketId, speaking) => {
        updateVoiceParticipantSpeaking(socketId, speaking);
      },
      onLocalSpeaking: (speaking) => {
        setIsLocalSpeaking(speaking);
      },
      onError: (msg) => {
        setVoiceError(msg);
      },
    });

    setLoading(false);
  };

  const handleToggleMute = () => {
    const nextMuted = webrtcVoiceManager.toggleMute();
    setIsMuted(nextMuted);
  };

  const handleLeaveVoice = () => {
    webrtcVoiceManager.leaveVoice();
    setVoiceJoined(false);
    setIsMuted(false);
    setIsLocalSpeaking(false);
    setVoiceStatus('idle');
  };

  return (
    <div className="flex items-center gap-1.5">
      {voiceError && (
        <Tooltip content={voiceError} position="bottom">
          <div className="flex items-center gap-1 text-red-400 bg-red-950/60 border border-red-800/80 px-2 py-0.5 rounded text-[11px] max-w-[140px] truncate">
            <AlertCircle size={12} className="shrink-0" />
            <span className="truncate">{voiceError}</span>
          </div>
        </Tooltip>
      )}

      {!isVoiceJoined ? (
        <Tooltip content="Join Real-Time Voice Room" position="bottom">
          <button
            onClick={handleJoinVoice}
            disabled={isConnecting}
            className="flex items-center gap-1.5 bg-slate-800 hover:bg-indigo-600/30 border border-slate-700/80 hover:border-indigo-500/50 text-slate-300 hover:text-indigo-300 text-xs px-2.5 py-1 rounded-lg transition-all cursor-pointer disabled:opacity-50"
          >
            <PhoneCall size={12} className={isConnecting ? 'animate-pulse text-indigo-400' : ''} />
            <span className="hidden sm:inline font-medium">{isConnecting ? 'Connecting...' : 'Join Voice'}</span>
          </button>
        </Tooltip>
      ) : (
        <>
          {/* Mute / Unmute Button */}
          <Tooltip content={isMuted ? 'Unmute Microphone' : 'Mute Microphone'} position="bottom">
            <button
              onClick={handleToggleMute}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium transition-all cursor-pointer ${
                isMuted
                  ? 'bg-red-950/40 border-red-800/60 text-red-300 hover:bg-red-900/50'
                  : isLocalSpeaking
                  ? 'bg-emerald-950/60 border-emerald-500 text-emerald-300 shadow-sm shadow-emerald-500/20'
                  : 'bg-emerald-950/30 border-emerald-800/50 text-emerald-400 hover:bg-emerald-900/40'
              }`}
            >
              {isMuted ? (
                <MicOff size={13} className="text-red-400" />
              ) : (
                <Mic size={13} className={isLocalSpeaking ? 'animate-pulse text-emerald-300' : ''} />
              )}
              <span className="hidden md:inline">{isMuted ? 'Muted' : 'Speaking'}</span>
            </button>
          </Tooltip>

          {/* Voice Room Status & Count */}
          <div className="hidden lg:flex items-center gap-1.5 bg-slate-900 border border-slate-800 px-2 py-1 rounded-lg text-[11px] text-slate-400">
            <Volume2 size={12} className="text-emerald-400" />
            <span>{voiceParticipants.size + 1} in voice</span>
          </div>

          {/* Voice-Only Mode Toggle */}
          <Tooltip
            content={isVoiceOnlyMode ? 'Switch Back to Editor Mode' : 'Voice-Only Lounge Mode'}
            position="bottom"
          >
            <button
              onClick={toggleVoiceOnlyMode}
              className={`p-1.5 rounded-lg border text-xs transition-colors cursor-pointer ${
                isVoiceOnlyMode
                  ? 'bg-indigo-600 text-white border-indigo-500'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:bg-slate-700'
              }`}
            >
              <Radio size={13} />
            </button>
          </Tooltip>

          {/* Leave Voice Button */}
          <Tooltip content="Leave Voice Call" position="bottom">
            <button
              onClick={handleLeaveVoice}
              className="p-1.5 rounded-lg bg-red-950/30 hover:bg-red-900/50 border border-red-800/60 text-red-400 hover:text-red-300 transition-colors cursor-pointer"
            >
              <PhoneOff size={13} />
            </button>
          </Tooltip>
        </>
      )}
    </div>
  );
}
