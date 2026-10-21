/**
 * MediaRecorder Audio Capture Service for Voice Notes
 */

export interface AudioRecordingResult {
  blob: Blob;
  dataUrl: string;
  durationSeconds: number;
}

export class AudioRecorderService {
  private mediaRecorder: MediaRecorder | null = null;
  private stream: MediaStream | null = null;
  private audioChunks: Blob[] = [];
  private startTime = 0;

  public static isSupported(): boolean {
    return typeof window !== 'undefined' && !!window.MediaRecorder;
  }

  public async startRecording(): Promise<void> {
    if (!AudioRecorderService.isSupported()) {
      throw new Error('Audio recording is not supported in this browser.');
    }

    this.audioChunks = [];
    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });

    let mimeType = 'audio/webm';
    if (!MediaRecorder.isTypeSupported('audio/webm')) {
      if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      } else if (MediaRecorder.isTypeSupported('audio/ogg')) {
        mimeType = 'audio/ogg';
      } else {
        mimeType = '';
      }
    }

    this.mediaRecorder = mimeType
      ? new MediaRecorder(this.stream, { mimeType })
      : new MediaRecorder(this.stream);

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        this.audioChunks.push(event.data);
      }
    };

    this.startTime = Date.now();
    this.mediaRecorder.start(250);
  }

  public stopRecording(): Promise<AudioRecordingResult> {
    return new Promise((resolve, reject) => {
      if (!this.mediaRecorder) {
        return reject(new Error('No active recorder'));
      }

      const durationSeconds = Math.max(1, Math.round((Date.now() - this.startTime) / 1000));

      this.mediaRecorder.onstop = () => {
        const mimeType = this.mediaRecorder?.mimeType || 'audio/webm';
        const blob = new Blob(this.audioChunks, { type: mimeType });

        // Release media tracks
        this.stream?.getTracks().forEach((track) => track.stop());
        this.stream = null;
        this.mediaRecorder = null;

        const reader = new FileReader();
        reader.onloadend = () => {
          resolve({
            blob,
            dataUrl: reader.result as string,
            durationSeconds,
          });
        };
        reader.onerror = () => reject(new Error('Failed to encode audio'));
        reader.readAsDataURL(blob);
      };

      try {
        this.mediaRecorder.stop();
      } catch (err) {
        reject(err);
      }
    });
  }

  public cancelRecording(): void {
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      try {
        this.mediaRecorder.stop();
      } catch {
        // Ignored
      }
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.mediaRecorder = null;
    this.audioChunks = [];
  }
}

export const audioRecorderService = new AudioRecorderService();
