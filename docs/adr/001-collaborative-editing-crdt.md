# ADR 001: Collaborative Editing via CRDT (Yjs) over Full Buffer Broadcasting

## Status
Accepted

## Context
A real-time collaborative coding workspace requires multiple users to edit the same file simultaneously without lost updates, cursor jumps, or race conditions.

Naive solutions broadcast the complete text buffer on every keystroke (`code:update`). Under high network latency or simultaneous typing, this causes the last write to overwrite concurrent edits, resulting in severe character loss.

Operational Transformation (OT) requires a central server to order and transform every operation, creating a stateful single point of failure.

## Decision
We adopted **Yjs** as the collaborative editing protocol integrated with Monaco Editor via `y-monaco` and backed by a dual-channel WebSocket transport.

1. Keystrokes are converted to compact binary CRDT updates (`Uint8Array`) using Lamport timestamps and unique client IDs.
2. Updates commute deterministically: applying them in any order produces identical document states across all clients.
3. A fallback snapshot protocol preserves full text buffers in MongoDB for persistence across server restarts.

## Consequences
- **Positive**: Zero merge conflicts, offline editing tolerance, deterministic convergence.
- **Positive**: Low bandwidth consumption compared to transmitting whole files per keystroke.
- **Trade-off**: Requires serialization handling between binary CRDT packets and socket JSON streams.
