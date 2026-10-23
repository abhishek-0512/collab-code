# ADR 002: Isolated Code Execution Sandbox Boundary

## Status
Accepted

## Context
Collab Code allows users to run arbitrary untrusted code in 7 languages (JavaScript, TypeScript, Python, C++, Java, Go, Rust).

Executing untrusted code directly on the host using `child_process.exec()` or inside the Node.js process using `eval()` or `vm` modules introduces catastrophic vulnerabilities:
- Fork bombs and CPU exhaustion.
- Host filesystem tampering and environment variable credential theft.
- Network port scanning and malicious outbound bot activity.

## Decision
We implemented a strict **Service Isolation Boundary**:
1. Untrusted user code is **never** executed inside the main Node.js API process.
2. The execution service dispatches workloads across an isolated sandbox API (Piston or Judge0 container) operating under:
   - Linux cgroups memory caps (256MB).
   - CPU quota limits and wall-clock execution limits (10s default).
   - Dropped capabilities (`CAP_NET_RAW`, `CAP_SYS_ADMIN`).
   - Read-only root filesystem with isolated ephemeral `/tmp`.
3. If the remote isolated runner is unreachable, the API returns a graceful `unavailable` status rather than falling back to dangerous host execution.

## Consequences
- **Positive**: Complete defense against host compromise, data exfiltration, and resource starvation.
- **Positive**: Broad polyglot runtime support out of the box.
- **Trade-off**: Network latency overhead (typically 100-800ms) for execution requests over local process invocation.
