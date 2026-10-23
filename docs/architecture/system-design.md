# Collab Code — System Architecture & Design Specification

## 1. System Overview

Collab Code is a real-time collaborative coding platform engineered with horizontal scalability, strict isolation boundaries, and deterministic state synchronization.

```
                      ┌─────────────────────────────────────────┐
                      │              Web Clients                │
                      │    (React + Monaco + Yjs + Socket.IO)   │
                      └────────────────────┬────────────────────┘
                                           │
                                HTTPS / WSS Requests
                                           │
                                           ▼
                      ┌─────────────────────────────────────────┐
                      │          Nginx Reverse Proxy            │
                      └─────────────┬─────────────┬─────────────┘
                                    │             │
                    REST API Calls  │             │ WebSocket Handshake
                                    ▼             ▼
                      ┌─────────────────────────────────────────┐
                      │         Collab Code API Server          │
                      │       (Node.js, Express, Socket.IO)     │
                      └──────┬──────────────┬─────────────┬─────┘
                             │              │             │
                             │              │             │
                State & Auth │        Cache │             │ Sandboxed Execution
                             ▼              ▼             ▼
                      ┌─────────────┐ ┌───────────┐ ┌───────────────────┐
                      │   MongoDB   │ │   Redis   │ │ Isolated Sandbox  │
                      │    Atlas    │ │  Adapter  │ │  (Piston / Judge) │
                      └─────────────┘ └───────────┘ └───────────────────┘
```

---

## 2. Real-Time Synchronization Protocol

### 2.1 Dual-Layer Synchronization (CRDT + Message Stream)
Collab Code adopts an event-driven synchronization architecture:

1. **Yjs CRDT Update Channel (`yjs:update`)**:
   - Keystrokes are converted to conflict-free replicated data type (CRDT) delta binary arrays (`Uint8Array`).
   - Concurrently edited documents converge deterministically without centralized locks or merge conflicts.

2. **Broadcasting & Snapshot Fallback (`code:update`)**:
   - Lightweight text snapshot dissemination with debounced persistence to Mongo/memory.
   - Ensures clients reconnecting or joining late receive the authoritative buffer immediately.

3. **Ephemeral Collaborator State**:
   - `cursor:update`: Line number and column indices emitted on editor cursor movement.
   - `room:presence`: Live connected user set with deterministic assigned color palettes.

---

## 3. Security & Code Execution Isolation Boundary

```
                     ┌───────────────────────────┐
                     │    Main Express API       │
                     │  (Handles Auth & Sockets) │
                     └─────────────┬─────────────┘
                                   │
              JSON Payload (code, language, stdin, timeout)
                                   │
                                   ▼
              ═══════════════════════════════════════════
                 ISOLATION BOUNDARY (Network Gap)
              ═══════════════════════════════════════════
                                   │
                                   ▼
                     ┌───────────────────────────┐
                     │ Isolated Execution Engine │
                     │   - Strict cgroups limits │
                     │   - Non-root user space   │
                     │   - Read-only rootfs      │
                     │   - Memory cap (256MB)    │
                     │   - CPU time cap (10s)    │
                     └───────────────────────────┘
```

### Key Invariants:
1. **Zero Host Execution**: User code is never executed directly inside the Node.js API process.
2. **Quota Enforcement**: Execution is bounded by wall-clock timeout (10s default), memory ceiling, and process quotas.
3. **Credential Sanitization**: The execution runner container possesses zero database or cloud credentials.

---

## 4. Scalability & High-Availability Considerations

- **Stateless API Tier**: API instances can scale horizontally behind an Nginx or cloud load balancer.
- **Socket.IO Redis Adapter**: When deploying multiple backend pods, `@socket.io/redis-adapter` distributes WebSocket events across all instances via Redis Pub/Sub.
- **MongoDB Atlas Sharding**: User and session metadata are partitioned by `roomId` and `userId` with B-tree compound indexes.

---

## 5. WebRTC Voice Communication & Speech Recognition Architecture

### 5.1 Real-Time Voice Signaling Protocol
Audio communication is mediated via peer-to-peer WebRTC connections with Socket.IO providing authenticated, room-scoped signaling. Socket.IO **never** carries raw media streams.

```
       Client Alice                              Server (Socket.IO)                            Client Bob
            │                                            │                                          │
            │─── voice:join (roomId) ───────────────────>│                                          │
            │                                            │─── voice:participant-joined (Alice) ────>│
            │                                            │<── voice:offer (SDP, to: Alice) ─────────│
            │<── voice:offer (SDP, from: Bob) ───────────│                                          │
            │─── voice:answer (SDP, to: Bob) ───────────>│                                          │
            │                                            │─── voice:answer (SDP, from: Alice) ─────>│
            │─── voice:ice-candidate (to: Bob) ─────────>│                                          │
            │                                            │─── voice:ice-candidate (from: Alice) ───>│
            │                                                                                       │
            │◄══════════════ Encrypted Direct P2P Audio Stream (SRTP) ═════════════════════════════►│
```

#### WebRTC Signaling Events
| Event | Direction | Description |
|---|---|---|
| `voice:join` | Client → Server | Announces participation in room voice session |
| `voice:participant-joined` | Server → Room | Notifies peers of newly connected voice user |
| `voice:participant-list` | Server → Client | Provides current active voice participants upon joining |
| `voice:offer` | Client ⇆ Server ⇆ Client | Routes peer SDP offer to targeted socket ID |
| `voice:answer` | Client ⇆ Server ⇆ Client | Routes peer SDP answer back to offer initiator |
| `voice:ice-candidate` | Client ⇆ Server ⇆ Client | Exchanges network ICE candidates for direct peer traversal |
| `voice:mute-state` | Client ⇆ Server ⇆ Room | Broadcasts microphone hardware mute status |
| `voice:speaking` | Client ⇆ Server ⇆ Room | Broadcasts real-time speaking activity from local audio analyzer |
| `voice:leave` | Client → Server | Tears down peer connections and releases microphone hardware |

### 5.2 Speaking Activity Detection (Web Audio API)
Each client continuously evaluates local audio input via an `AudioContext` and `AnalyserNode`:
- Fast Fourier Transform (FFT) size: 512
- Normalized volume calculation: root-mean-square of frequency bins.
- Debounced activation threshold (0.04) prevents rapid flickering when speaking stops.

### 5.3 Voice-to-Text & Audio Note Architecture
- **Web Speech API**: Uses browser-native `webkitSpeechRecognition` / `SpeechRecognition` with continuous listening and interim results.
- **Human-in-the-Loop Review**: Speech is transcribed in an editable draft bubble; the user can review or amend text before submitting. Transcriptions are never sent automatically without user confirmation.
- **Voice Notes**: Uses browser `MediaRecorder` API to record uncompressed Opus/WebM audio up to 60 seconds with an inline player preview before sending.

### 5.4 Multi-Party Topology & SFU Migration Path
- **Current MVP Topology (Full Mesh)**:
  - Each participant establishes $N - 1$ bidirectional peer connections.
  - Efficient and zero-infrastructure-cost for standard technical interviews and pair programming (2–4 users).
  - Practical ceiling: $\le 6$ users per room due to upstream client bandwidth ($N - 1$ outgoing streams).
- **Production SFU Migration Path (Selective Forwarding Unit)**:
  - For larger rooms ($\ge 8$ participants) or enterprise conferences, the signaling layer seamlessly translates to an SFU (e.g., LiveKit or mediasoup).
  - Each client publishes 1 upstream audio stream to the SFU, which duplicates and forwards downstream packets.
  - Client interface (`webrtc.service.ts`) abstracts peer connection management, permitting drop-in replacement with an SFU client SDK without impacting UI components or meeting logic.
