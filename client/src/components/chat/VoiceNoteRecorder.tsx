import { useState, useRef, useEffect } from 'react';
import { Volume2, Square, Send, Trash2, Play, Pause, Disc } from 'lucide-react';
import { audioRecorderService, AudioRecordingResult } from '../../services/audioRecorder.service';
import { Tooltip } from '../ui/Tooltip';

interface VoiceNoteRecorderProps {
  onSendAudioNote: (audioDataUrl: string, durationSeconds: number) => void;
  disabled?: boolean;
}

export function VoiceNoteRecorder({ onSendAudioNote, disabled }: VoiceNoteRecorderProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [recordedAudio, setRecordedAudio] = useState<AudioRecordingResult | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timerRef = useRef<any>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      audioRecorderService.cancelRecording();
    };
  }, []);

  const handleStartRecording = async () => {
    setError(null);
    setRecordedAudio(null);
    setSeconds(0);

    try {
      await audioRecorderService.startRecording();
      setIsRecording(true);

      timerRef.current = setInterval(() => {
        setSeconds((prev) => {
          if (prev >= 60) {
            // Auto-stop at 60s limit
            handleStopRecording();
            return 60;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      setError(err.message || 'Microphone access denied');
      setIsRecording(false);
    }
  };

  const handleStopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    try {
      const result = await audioRecorderService.stopRecording();
      setRecordedAudio(result);
    } catch (err: any) {
      setError(err.message || 'Recording failed');
    } finally {
      setIsRecording(false);
    }
  };

  const handleDiscard = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    audioRecorderService.cancelRecording();
    setIsRecording(false);
    setRecordedAudio(null);
    setIsPlaying(false);
    setSeconds(0);
    setError(null);
  };

  const handleTogglePlay = () => {
    if (!audioPreviewRef.current) return;
    if (isPlaying) {
      audioPreviewRef.current.pause();
      setIsPlaying(false);
    } else {
      audioPreviewRef.current.play();
      setIsPlaying(true);
    }
  };

  const handleSend = () => {
    if (!recordedAudio) return;
    onSendAudioNote(recordedAudio.dataUrl, recordedAudio.durationSeconds);
    handleDiscard();
  };

  const isActive = isRecording || recordedAudio !== null;

  return (
    <div className="relative flex items-center">
      {!isActive ? (
        <Tooltip content="Record Audio Voice Note (60s limit)" position="top">
          <button
            type="button"
            onClick={handleStartRecording}
            disabled={disabled}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Volume2 size={15} />
          </button>
        </Tooltip>
      ) : (
        /* Expanded Floating Voice Note Bubble */
        <div className="absolute bottom-full right-0 mb-2 w-72 bg-slate-900 border border-slate-700/80 rounded-xl p-3 shadow-2xl z-30 flex flex-col gap-2.5">
          {/* Header */}
          <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800">
            <div className="flex items-center gap-1.5 font-medium">
              {isRecording ? (
                <>
                  <Disc size={13} className="text-red-500 animate-spin" />
                  <span className="text-red-400 font-semibold">Recording Voice Note</span>
                </>
              ) : (
                <>
                  <Volume2 size={13} className="text-indigo-400" />
                  <span className="text-slate-300">Voice Note Preview</span>
                </>
              )}
            </div>
            <span className="font-mono text-xs text-slate-400">
              0:{seconds < 10 ? `0${seconds}` : seconds} / 1:00
            </span>
          </div>

          {error && <div className="text-[11px] text-red-400 bg-red-950/40 p-2 rounded">{error}</div>}

          {/* Player / Recording View */}
          {isRecording ? (
            <div className="flex items-center justify-center py-3 bg-slate-950/70 border border-slate-800/80 rounded-lg gap-3">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping" />
              <span className="text-xs text-slate-300">Speaking...</span>
              <button
                type="button"
                onClick={handleStopRecording}
                className="inline-flex items-center gap-1 text-xs bg-red-600 hover:bg-red-500 text-white px-2.5 py-1 rounded-md font-medium cursor-pointer"
              >
                <Square size={11} />
                Stop
              </button>
            </div>
          ) : recordedAudio ? (
            <div className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-lg p-2 gap-2">
              <audio
                ref={audioPreviewRef}
                src={recordedAudio.dataUrl}
                onEnded={() => setIsPlaying(false)}
                className="hidden"
              />
              <button
                type="button"
                onClick={handleTogglePlay}
                className="p-1.5 rounded-full bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
              >
                {isPlaying ? <Pause size={13} /> : <Play size={13} className="ml-0.5" />}
              </button>
              <div className="flex-1 text-[11px] text-slate-400 font-mono">
                Audio Note ({recordedAudio.durationSeconds}s)
              </div>
            </div>
          ) : null}

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleDiscard}
              className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-red-400 px-2 py-1 rounded cursor-pointer transition-colors"
            >
              <Trash2 size={12} />
              Discard
            </button>

            {recordedAudio && (
              <button
                type="button"
                onClick={handleSend}
                className="inline-flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-3 py-1 rounded-lg shadow-sm cursor-pointer transition-colors"
              >
                <span>Send Note</span>
                <Send size={11} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
