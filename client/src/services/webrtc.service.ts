/**
 * WebRTC Mesh Voice Manager
 * Coordinates multi-party live audio rooms with Socket.IO signaling.
 */

import { getSocket } from './socket.service';
import type { VoiceParticipant, VoiceStatus } from '../types';

const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ],
};

export interface WebRTCVoiceCallbacks {
  onStatusChange: (status: VoiceStatus) => void;
  onParticipantJoined: (p: VoiceParticipant) => void;
  onParticipantLeft: (socketId: string) => void;
  onParticipantMute: (socketId: string, isMuted: boolean) => void;
  onParticipantSpeaking: (socketId: string, isSpeaking: boolean) => void;
  onLocalSpeaking: (isSpeaking: boolean) => void;
  onError: (errorMessage: string) => void;
}

export class WebRTCVoiceManager {
  private roomId: string | null = null;
  private localStream: MediaStream | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private audioElements = new Map<string, HTMLAudioElement>();
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();

  // Audio Analysis for Speaking Detection
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private speakingInterval: any = null;
  private isSpeaking = false;
  private isMuted = false;

  private callbacks: WebRTCVoiceCallbacks | null = null;
  private isVoiceActive = false;

  public async joinVoice(roomId: string, callbacks: WebRTCVoiceCallbacks): Promise<void> {
    this.roomId = roomId;
    this.callbacks = callbacks;
    this.callbacks.onStatusChange('connecting');

    // 1. Request microphone access strictly on-demand
    try {
      this.localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
    } catch (err: any) {
      let message = 'Failed to access microphone.';
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        message = 'Microphone permission denied. Please allow microphone access in your browser.';
      } else if (err.name === 'NotFoundError') {
        message = 'No microphone device was detected on your computer.';
      }
      this.callbacks.onError(message);
      this.callbacks.onStatusChange('error');
      return;
    }

    this.isVoiceActive = true;
    this.isMuted = false;

    // 2. Setup local speaking detection
    this.setupAudioAnalysis();

    // 3. Register Socket.IO Signaling Listeners
    this.setupSignalingListeners();

    // 4. Emit voice:join to server
    const socket = getSocket();
    socket.emit('voice:join', { roomId: this.roomId, isMuted: this.isMuted });
    this.callbacks.onStatusChange('connected');
  }

  public toggleMute(): boolean {
    if (!this.localStream) return true;

    this.isMuted = !this.isMuted;
    this.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !this.isMuted;
    });

    if (this.isMuted && this.isSpeaking) {
      this.isSpeaking = false;
      this.callbacks?.onLocalSpeaking(false);
      const socket = getSocket();
      if (this.roomId) {
        socket.emit('voice:speaking', { roomId: this.roomId, isSpeaking: false });
      }
    }

    const socket = getSocket();
    if (this.roomId) {
      socket.emit('voice:mute-state', { roomId: this.roomId, isMuted: this.isMuted });
    }

    return this.isMuted;
  }

  public getIsMuted(): boolean {
    return this.isMuted;
  }

  public getIsActive(): boolean {
    return this.isVoiceActive;
  }

  public leaveVoice(): void {
    if (!this.isVoiceActive && !this.localStream) return;

    const socket = getSocket();
    if (this.roomId) {
      socket.emit('voice:leave', { roomId: this.roomId });
    }

    // Stop speaking detection
    if (this.speakingInterval) {
      clearInterval(this.speakingInterval);
      this.speakingInterval = null;
    }
    if (this.audioContext && this.audioContext.state !== 'closed') {
      try {
        this.audioContext.close();
      } catch {
        // Ignored
      }
      this.audioContext = null;
    }

    // Stop and release local microphone stream
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => track.stop());
      this.localStream = null;
    }

    // Close all WebRTC peer connections
    this.peerConnections.forEach((pc) => pc.close());
    this.peerConnections.clear();

    // Stop and remove all remote audio elements
    this.audioElements.forEach((audio) => {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
    });
    this.audioElements.clear();

    this.pendingCandidates.clear();
    this.cleanupSignalingListeners();

    this.isVoiceActive = false;
    this.isSpeaking = false;
    this.isMuted = false;
    this.roomId = null;

    this.callbacks?.onStatusChange('idle');
  }

  // ─── Private WebRTC Signaling & Mesh Connection ─────────────

  private setupSignalingListeners(): void {
    const socket = getSocket();

    // Existing peers already in the voice room: create offer to each
    socket.on('voice:existing-participants', async (data: { participants: VoiceParticipant[] }) => {
      for (const p of data.participants) {
        this.callbacks?.onParticipantJoined(p);
        await this.initiateCallToPeer(p.socketId);
      }
    });

    // New participant joined voice: store participant
    socket.on('voice:participant-joined', (data: { participant: VoiceParticipant }) => {
      this.callbacks?.onParticipantJoined(data.participant);
    });

    // Participant left voice
    socket.on('voice:participant-left', (data: { socketId: string }) => {
      this.closePeer(data.socketId);
      this.callbacks?.onParticipantLeft(data.socketId);
    });

    // Received SDP Offer from a peer
    socket.on('voice:offer', async (data: { senderSocketId: string; offer: RTCSessionDescriptionInit }) => {
      await this.handleReceiveOffer(data.senderSocketId, data.offer);
    });

    // Received SDP Answer from a peer
    socket.on('voice:answer', async (data: { senderSocketId: string; answer: RTCSessionDescriptionInit }) => {
      await this.handleReceiveAnswer(data.senderSocketId, data.answer);
    });

    // Received ICE Candidate from a peer
    socket.on('voice:ice-candidate', async (data: { senderSocketId: string; candidate: RTCIceCandidateInit }) => {
      await this.handleReceiveIceCandidate(data.senderSocketId, data.candidate);
    });

    // Mute toggle notification
    socket.on('voice:mute-state', (data: { socketId: string; isMuted: boolean }) => {
      this.callbacks?.onParticipantMute(data.socketId, data.isMuted);
    });

    // Speaking indicator notification
    socket.on('voice:speaking', (data: { socketId: string; isSpeaking: boolean }) => {
      this.callbacks?.onParticipantSpeaking(data.socketId, data.isSpeaking);
    });

    // Voice error notification
    socket.on('voice:error', (data: { message: string }) => {
      this.callbacks?.onError(data.message);
    });
  }

  private cleanupSignalingListeners(): void {
    const socket = getSocket();
    socket.off('voice:existing-participants');
    socket.off('voice:participant-joined');
    socket.off('voice:participant-left');
    socket.off('voice:offer');
    socket.off('voice:answer');
    socket.off('voice:ice-candidate');
    socket.off('voice:mute-state');
    socket.off('voice:speaking');
    socket.off('voice:error');
  }

  private createPeerConnection(remoteSocketId: string): RTCPeerConnection {
    const pc = new RTCPeerConnection(RTC_CONFIG);

    // Add local microphone tracks to peer connection
    if (this.localStream) {
      this.localStream.getTracks().forEach((track) => {
        pc.addTrack(track, this.localStream!);
      });
    }

    // ICE Candidate generation
    pc.onicecandidate = (event) => {
      if (event.candidate && this.roomId) {
        const socket = getSocket();
        socket.emit('voice:ice-candidate', {
          roomId: this.roomId,
          targetSocketId: remoteSocketId,
          candidate: event.candidate,
        });
      }
    };

    // Remote audio stream received
    pc.ontrack = (event) => {
      const [remoteStream] = event.streams;
      if (remoteStream) {
        let audio = this.audioElements.get(remoteSocketId);
        if (!audio) {
          audio = document.createElement('audio');
          audio.autoplay = true;
          this.audioElements.set(remoteSocketId, audio);
        }
        audio.srcObject = remoteStream;
        audio.play().catch(() => {
          // Auto-play was prevented by browser policy; user interaction unblocks it
        });
      }
    };

    // Connection state debugging & auto-cleanup
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        this.closePeer(remoteSocketId);
      }
    };

    this.peerConnections.set(remoteSocketId, pc);
    return pc;
  }

  private async initiateCallToPeer(remoteSocketId: string): Promise<void> {
    try {
      const pc = this.createPeerConnection(remoteSocketId);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: false,
      });
      await pc.setLocalDescription(offer);

      const socket = getSocket();
      socket.emit('voice:offer', {
        roomId: this.roomId,
        targetSocketId: remoteSocketId,
        offer,
      });
    } catch (err: any) {
      console.error(`[WebRTC] Failed to initiate call to ${remoteSocketId}:`, err);
    }
  }

  private async handleReceiveOffer(senderSocketId: string, offer: RTCSessionDescriptionInit): Promise<void> {
    try {
      const pc = this.createPeerConnection(senderSocketId);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));

      // Process any ICE candidates that arrived before remoteDescription
      const pending = this.pendingCandidates.get(senderSocketId) || [];
      for (const candidate of pending) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      this.pendingCandidates.delete(senderSocketId);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const socket = getSocket();
      socket.emit('voice:answer', {
        roomId: this.roomId,
        targetSocketId: senderSocketId,
        answer,
      });
    } catch (err: any) {
      console.error(`[WebRTC] Failed to handle offer from ${senderSocketId}:`, err);
    }
  }

  private async handleReceiveAnswer(senderSocketId: string, answer: RTCSessionDescriptionInit): Promise<void> {
    const pc = this.peerConnections.get(senderSocketId);
    if (!pc) return;

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer));

      const pending = this.pendingCandidates.get(senderSocketId) || [];
      for (const candidate of pending) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      this.pendingCandidates.delete(senderSocketId);
    } catch (err: any) {
      console.error(`[WebRTC] Failed to handle answer from ${senderSocketId}:`, err);
    }
  }

  private async handleReceiveIceCandidate(senderSocketId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const pc = this.peerConnections.get(senderSocketId);
    if (pc && pc.remoteDescription && pc.remoteDescription.type) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err: any) {
        console.error('[WebRTC] Failed to add ICE candidate:', err);
      }
    } else {
      // Queue candidate until remote description is set
      if (!this.pendingCandidates.has(senderSocketId)) {
        this.pendingCandidates.set(senderSocketId, []);
      }
      this.pendingCandidates.get(senderSocketId)!.push(candidate);
    }
  }

  private closePeer(socketId: string): void {
    const pc = this.peerConnections.get(socketId);
    if (pc) {
      pc.close();
      this.peerConnections.delete(socketId);
    }

    const audio = this.audioElements.get(socketId);
    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();
      this.audioElements.delete(socketId);
    }
  }

  // ─── Speaking Detection via Web Audio API ──────────────────

  private setupAudioAnalysis(): void {
    if (!this.localStream) return;

    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.audioContext = new AudioCtx();
      const source = this.audioContext.createMediaStreamSource(this.localStream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      this.analyser.smoothingTimeConstant = 0.4;
      source.connect(this.analyser);

      const buffer = new Uint8Array(this.analyser.frequencyBinCount);
      const THRESHOLD = 22; // RMS audio amplitude threshold

      this.speakingInterval = setInterval(() => {
        if (!this.analyser || this.isMuted) {
          if (this.isSpeaking) {
            this.isSpeaking = false;
            this.callbacks?.onLocalSpeaking(false);
          }
          return;
        }

        this.analyser.getByteFrequencyData(buffer);
        let sum = 0;
        for (let i = 0; i < buffer.length; i++) {
          sum += buffer[i];
        }
        const average = sum / buffer.length;
        const nowSpeaking = average > THRESHOLD;

        if (nowSpeaking !== this.isSpeaking) {
          this.isSpeaking = nowSpeaking;
          this.callbacks?.onLocalSpeaking(nowSpeaking);

          const socket = getSocket();
          if (this.roomId) {
            socket.emit('voice:speaking', {
              roomId: this.roomId,
              isSpeaking: nowSpeaking,
            });
          }
        }
      }, 150);
    } catch (err) {
      console.warn('[WebRTC] Web Audio API speaking detection unavailable:', err);
    }
  }
}

export const webrtcVoiceManager = new WebRTCVoiceManager();
