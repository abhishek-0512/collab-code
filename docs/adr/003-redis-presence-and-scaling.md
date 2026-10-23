# ADR 003: Redis for Multi-Instance Socket Coordination and Ephemeral State

## Status
Accepted

## Context
In a single-instance development setup, in-memory Maps efficiently manage user presence, room memberships, and socket routing.

However, when scaling horizontally across multiple container instances or Kubernetes pods:
- Client A connected to Server 1 cannot receive WebSocket messages broadcasted by Client B on Server 2.
- Session disconnects on one node would lead to stale presence records on another.

## Decision
We engineered an adaptable architecture:
1. **Local Development**: Built-in high-performance in-memory Map stores provide zero-dependency local execution out of the box.
2. **Production Multi-Instance**: When `REDIS_URL` is configured, Socket.IO seamlessly mounts the `@socket.io/redis-adapter` for inter-node Pub/Sub message propagation.
3. Ephemeral presence and rate limits use Redis keys with automatic TTL expiration to guarantee cleanup upon node crashes.

## Consequences
- **Positive**: Frictionless local developer setup requiring no running Docker daemon or Redis service.
- **Positive**: Direct upgrade path to horizontal cloud scale with zero code refactoring.
