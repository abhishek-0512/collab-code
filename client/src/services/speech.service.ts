/**
 * Web Speech API Voice-to-Text Transcription Service
 * Uses browser's native SpeechRecognition / webkitSpeechRecognition
 */

// Declare SpeechRecognition interface for TypeScript
interface IWindow extends Window {
  SpeechRecognition?: any;
  webkitSpeechRecognition?: any;
}

export interface SpeechRecognitionCallbacks {
  onInterim: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (errorMsg: string) => void;
  onEnd: () => void;
}

export class SpeechToTextService {
  private recognition: any = null;
  private isListening = false;

  public static isSupported(): boolean {
    const win = window as unknown as IWindow;
    return !!(win.SpeechRecognition || win.webkitSpeechRecognition);
  }

  public start(callbacks: SpeechRecognitionCallbacks): void {
    if (!SpeechToTextService.isSupported()) {
      callbacks.onError(
        'Speech recognition is not supported in this browser. Please use Chrome, Edge, or Safari with Web Speech enabled.'
      );
      return;
    }

    if (this.isListening) {
      this.stop();
    }

    const win = window as unknown as IWindow;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

    try {
      this.recognition = new SpeechRecognitionClass();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = navigator.language || 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
      };

      this.recognition.onresult = (event: any) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const item = event.results[i];
          if (item.isFinal) {
            finalTranscript += item[0].transcript;
          } else {
            interimTranscript += item[0].transcript;
          }
        }

        if (interimTranscript) {
          callbacks.onInterim(interimTranscript);
        }
        if (finalTranscript) {
          callbacks.onFinal(finalTranscript);
        }
      };

      this.recognition.onerror = (event: any) => {
        let message = 'Speech recognition error';
        if (event.error === 'not-allowed') {
          message = 'Microphone permission denied for speech recognition.';
        } else if (event.error === 'no-speech') {
          message = 'No speech detected. Please speak into your microphone.';
        } else if (event.error === 'network') {
          message = 'Network error during speech recognition.';
        }
        this.isListening = false;
        callbacks.onError(message);
      };

      this.recognition.onend = () => {
        this.isListening = false;
        callbacks.onEnd();
      };

      this.recognition.start();
    } catch (err: any) {
      this.isListening = false;
      callbacks.onError(err.message || 'Failed to initialize speech recognition.');
    }
  }

  public stop(): void {
    if (this.recognition && this.isListening) {
      try {
        this.recognition.stop();
      } catch {
        // Ignored
      }
    }
    this.isListening = false;
  }

  public abort(): void {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch {
        // Ignored
      }
    }
    this.isListening = false;
  }
}

export const speechService = new SpeechToTextService();
