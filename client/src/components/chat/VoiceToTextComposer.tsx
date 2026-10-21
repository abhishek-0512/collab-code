import { useState, useRef, useEffect } from 'react';
import { Mic, MicOff, Send, X, Check, Loader2, AlertCircle } from 'lucide-react';
import { speechService, SpeechToTextService } from '../../services/speech.service';
import { Tooltip } from '../ui/Tooltip';

interface VoiceToTextComposerProps {
  onSendMessage: (text: string, isVoiceTranscribed?: boolean) => void;
  disabled?: boolean;
}

export function VoiceToTextComposer({ onSendMessage, disabled }: VoiceToTextComposerProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [draftText, setDraftText] = useState('');
  const [interimText, setInterimText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setIsSupported(SpeechToTextService.isSupported());
  }, []);

  const handleStartListening = () => {
    setError(null);
    setInterimText('');
    setDraftText('');

    if (!SpeechToTextService.isSupported()) {
      setError('Web Speech is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    setIsRecording(true);
    speechService.start({
      onInterim: (interim) => {
        setInterimText(interim);
      },
      onFinal: (final) => {
        setDraftText((prev) => (prev ? `${prev} ${final}` : final).trim());
        setInterimText('');
      },
      onError: (err) => {
        setError(err);
        setIsRecording(false);
      },
      onEnd: () => {
        setIsRecording(false);
      },
    });
  };

  const handleStopListening = () => {
    speechService.stop();
    setIsRecording(false);
    setInterimText('');
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleCancel = () => {
    speechService.abort();
    setIsRecording(false);
    setDraftText('');
    setInterimText('');
    setError(null);
  };

  const handleSend = () => {
    const finalContent = (draftText + (interimText ? ` ${interimText}` : '')).trim();
    if (!finalContent) return;

    speechService.stop();
    setIsRecording(false);
    onSendMessage(finalContent, true);
    setDraftText('');
    setInterimText('');
    setError(null);
  };

  // If currently active (recording or review draft)
  const isComposerActive = isRecording || draftText.length > 0 || error !== null;

  return (
    <div className="relative flex items-center">
      {!isComposerActive ? (
        <Tooltip
          content={
            isSupported
              ? 'Voice-to-Text: Speak message naturally'
              : 'Voice-to-Text (Unsupported in this browser)'
          }
          position="top"
        >
          <button
            type="button"
            onClick={handleStartListening}
            disabled={disabled || !isSupported}
            className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-400 hover:bg-slate-800 disabled:opacity-40 transition-colors cursor-pointer"
          >
            <Mic size={15} />
          </button>
        </Tooltip>
      ) : (
        /* Expanded Floating Voice Composer Draft Bubble */
        <div className="absolute bottom-full right-0 mb-2 w-72 bg-slate-900 border border-indigo-500/60 rounded-xl p-3 shadow-2xl z-30 flex flex-col gap-2">
          {/* Status Bar */}
          <div className="flex items-center justify-between text-xs pb-1 border-b border-slate-800">
            <div className="flex items-center gap-1.5 text-indigo-400 font-medium">
              {isRecording ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span className="text-red-400 font-semibold">Listening...</span>
                </>
              ) : (
                <>
                  <Check size={12} className="text-emerald-400" />
                  <span className="text-slate-300">Review & Edit Draft</span>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="text-slate-400 hover:text-slate-200 text-xs p-1 rounded hover:bg-slate-800 cursor-pointer"
              title="Discard draft"
            >
              <X size={13} />
            </button>
          </div>

          {error && (
            <div className="flex items-start gap-1.5 bg-red-950/40 border border-red-800/60 text-red-300 text-[11px] p-2 rounded-lg">
              <AlertCircle size={13} className="shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Editable Transcription Draft */}
          <div className="relative">
            <textarea
              ref={textareaRef}
              rows={3}
              value={draftText}
              onChange={(e) => setDraftText(e.target.value)}
              placeholder={isRecording ? 'Speak now...' : 'Transcribed message...'}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-sans leading-relaxed"
            />
            {interimText && (
              <div className="text-[11px] text-slate-400 italic px-2 py-1 bg-slate-950/80 rounded border border-slate-800/80 flex items-center gap-1.5 mt-1">
                <Loader2 size={10} className="animate-spin text-indigo-400 shrink-0" />
                <span className="truncate">{interimText}</span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-1">
            {isRecording ? (
              <button
                type="button"
                onClick={handleStopListening}
                className="inline-flex items-center gap-1 text-xs text-amber-400 hover:text-amber-300 bg-amber-950/40 border border-amber-800/60 px-2 py-1 rounded-lg cursor-pointer transition-colors"
              >
                <MicOff size={11} />
                <span>Done Speaking</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartListening}
                className="inline-flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 bg-slate-800 px-2 py-1 rounded-lg cursor-pointer transition-colors"
              >
                <Mic size={11} />
                <span>Resume</span>
              </button>
            )}

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleCancel}
                className="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSend}
                disabled={!draftText.trim() && !interimText.trim()}
                className="inline-flex items-center gap-1 text-xs bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-white font-medium px-2.5 py-1 rounded-lg shadow-sm cursor-pointer transition-colors"
              >
                <span>Send</span>
                <Send size={11} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
