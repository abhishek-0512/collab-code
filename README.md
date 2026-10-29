# Collab Code — Real-Time Collaborative Coding Workspace

[![CI](https://github.com/abhishekkr9/collab-code/actions/workflows/ci.yml/badge.svg)](https://github.com/abhishekkr9/collab-code/actions)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](https://opensource.org/licenses/ISC)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Node](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Express](https://img.shields.io/badge/Express-5.2+-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.8+-010101?logo=socketdotio&logoColor=white)](https://socket.io/)
[![Tailwind](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

**Collab Code** is a production-minded real-time collaborative coding platform designed for technical interviews, pair programming, and peer learning. It combines a live-synchronized Monaco editor, conflict-free document convergence via Yjs CRDTs, sandboxed polyglot code execution, room-based discussion chat, and algorithmic challenge practice.

---

## Architecture Diagram

```
 ┌────────────────────────────────────────────────────────┐
 │                   Web Browsers (Clients)               │
 │       React 19 • Monaco Editor • Yjs CRDT • Socket.IO  │
 └───────────────────────────┬────────────────────────────┘
                             │
                  HTTPS (REST) / WSS (Sockets)
                             │
                             ▼
 ┌────────────────────────────────────────────────────────┐
 │               Nginx Reverse Proxy / Load Balancer       │
 └─────────────┬────────────────────────────┬─────────────┘
               │                            │
   REST API    │                            │ WebSocket Transport
               ▼                            ▼
 ┌────────────────────────────────────────────────────────┐
 │              Collab Code Backend Cluster               │
 │           Express 5 • TypeScript • Socket.IO           │
 └──────┬────────────────────┬─────────────────────┬──────┘
        │                    │                     │
        ▼                    ▼                     ▼
 ┌─────────────┐      ┌─────────────┐       ┌──────────────────────┐
 │   MongoDB   │      │    Redis    │       │  Isolated Execution  │
 │    Atlas    │      │ Pub/Sub &   │       │   Sandbox Boundary   │
 │ Persistence │      │ Rate Limits │       │   (Memory/CPU Caps)  │
 └─────────────┘      └─────────────┘       └──────────────────────┘
```

---

## Key Features

### Real-Time Collaborative Workspace
- **Conflict-Free Synchronization**: Powered by Yjs CRDT and Monaco bindings for concurrent, loss-free multi-user editing.
- **Collaborator Presence**: Live connected user indicators, personalized color assignments, and remote cursor tracking.
- **Room Discussion Chat**: Embedded conversation thread alongside the editor with timestamped messages.
- **Live WebRTC Voice Chat**: Multi-party encrypted voice rooms with mute controls, speaking indicators via Web Audio API analysis, and participant counts.
- **Voice-to-Text Transcription**: Real-time microphone dictation via Web Speech API with an editable draft bubble and explicit user confirmation.
- **Audio Voice Notes**: Push-to-record voice notes (up to 60s) with waveform playback previews and inline chat listening.
- **Voice-Only Lounge Mode**: Dedicated audio discussion lounge for brainstorming without code distractions.
- **One-Click Invitations**: Shareable 8-character uppercase room codes and direct links.

### Polyglot Sandboxed Code Execution
- **Isolated Execution Boundary**: Arbitrary code is executed in isolated containers under strict resource limits (256MB memory cap, 10s CPU timeout, non-root process space).
- **Supported Runtimes**: JavaScript (Node 18), TypeScript 5, Python 3.10, Java 15, C++ (GCC 10), Go 1.16, and Rust 1.50.
- **Rich Diagnostic Reporting**: Standard output, standard error, exit codes, execution wall-clock time, and compiler diagnostics.

### Problem Practice Catalog
- Built-in LeetCode-style algorithmic challenges (Two Sum, Valid Parentheses, Reverse Linked List, Maximum Subarray, Climbing Stairs).
- **Custom Problem Creation**: Add any custom or LeetCode challenge dynamically with sample cases and custom starter code; persisted for collaborative solving.
- Full problem descriptions, constraints, examples, and test cases.

### Security & Enterprise Architecture
- **JWT Authentication**: Token-based authentication with bcrypt password hashing (10 salt rounds).
- **Zod Request Validation**: Centralized schema validation middleware rejecting invalid payloads before hitting business logic.
- **Graceful Fallbacks**: In-memory stores provide instant local development when MongoDB or Redis are not configured.

---

## Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 6, Tailwind CSS v4, Monaco Editor (`@monaco-editor/react`), Zustand 5, Lucide React |
| **Collaborative Engine** | Yjs, `y-monaco`, `y-protocols`, Socket.IO Client 4.8 |
| **Real-Time Voice & Audio** | WebRTC (Mesh), Web Audio API (Speaking Detection), Web Speech API (STT), MediaRecorder API |
| **Backend** | Node.js 20+, Express 5, TypeScript 5.7, Socket.IO 4.8 |
| **Database & Cache** | MongoDB Atlas, Mongoose 8, Redis 7 (optional Pub/Sub adapter) |
| **Validation & Auth** | Zod, JSON Web Tokens (`jsonwebtoken`), bcryptjs |
| **Execution Sandbox** | Isolated Piston Engine / Judge0 API Boundary |
| **DevOps & CI/CD** | Docker, Docker Compose, Nginx, GitHub Actions |

---

## Project Structure

```
collab-code/
├── client/                     # Vite + React Frontend
│   ├── src/
│   │   ├── app/                # App router, ProtectedRoute guards
│   │   ├── components/
│   │   │   ├── layout/         # AppShell, AuthLayout
│   │   │   └── ui/             # Button, Input, Modal, Badge, Tooltip
│   │   ├── pages/              # Landing, Login, Register, Dashboard, Room, Profile
│   │   ├── services/           # API client, Auth, Room, Execution, Socket services
│   │   ├── stores/             # Zustand auth and room presence stores
│   │   └── types/              # Frontend TypeScript definitions
│   ├── Dockerfile              # Multi-stage production Nginx container
│   └── package.json
├── server/                     # Node.js + Express Backend
│   ├── src/
│   │   ├── config/             # Environment, Database connection
│   │   ├── controllers/        # Thin route controllers (Auth, Room, Problem, Execution)
│   │   ├── middleware/         # Auth, Validate, RequestLogger, ErrorHandler
│   │   ├── models/             # Mongoose schemas (User, Room, Message, Problem, Submission)
│   │   ├── routes/             # REST route declarations
│   │   ├── services/           # Core domain logic & execution sandbox boundary
│   │   ├── sockets/            # Socket.IO room lifecycle & Yjs event handlers
│   │   ├── utils/              # JWT, ID generators, API response helpers
│   │   ├── validators/         # Zod schemas (Auth, Room)
│   │   ├── app.ts              # Express application configuration
│   │   └── server.ts           # HTTP & Socket.IO server bootstrap
│   ├── tests/                  # Integration test suites (Auth, Rooms, Sockets, Sandbox)
│   ├── Dockerfile              # Multi-stage Node.js container
│   └── package.json
├── shared/
│   └── types/                  # Cross-tier shared domain types
├── docs/
│   ├── adr/                    # Architecture Decision Records
│   └── architecture/           # System design specifications
├── .github/workflows/          # GitHub Actions CI workflow
├── docker-compose.yml          # Multi-container local orchestration
├── .env.example                # Safe environment variable template
└── README.md
```

---

## Local Development Setup

### Prerequisites
- **Node.js**: v18.0.0 or higher (v20+ recommended)
- **npm**: v9.0.0 or higher
- **Git**

### 1. Clone & Configure Environment

```bash
git clone https://github.com/abhishekkr9/collab-code.git
cd collab-code

# Copy environment variable template
cp .env.example server/.env
```

The server runs out-of-the-box with in-memory fallback stores if `MONGODB_URI` is left blank. To connect MongoDB Atlas, provide your URI:
```env
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/collab-code?retryWrites=true&w=majority
```

### 2. Install Dependencies

```bash
# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 3. Run the Development Servers

In terminal 1 (Backend):
```bash
cd server
npm run dev
# Server listens at http://localhost:5001
```

In terminal 2 (Frontend):
```bash
cd client
npm run dev
# Client available at http://localhost:5173
```

---

## Running Tests & Typechecks

The backend includes a comprehensive automated test suite covering authentication, authorization, room lifecycle, sandboxed execution, and multi-client socket communication:

```bash
# Run server test suite
cd server
npm test

# Typecheck server
npm run typecheck

# Build server for production
npm run build

# Typecheck frontend
cd ../client
npm run typecheck

# Build frontend production bundle
npm run build
```

---

## API Reference

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Register a new account (`username`, `email`, `password`)
- `POST /api/auth/login` — Authenticate and receive a JWT token (`email`, `password`)
- `GET /api/auth/me` — Retrieve authenticated user profile (Requires `Bearer <token>`)

### Rooms (`/api/rooms`)
- `POST /api/rooms` — Create a new coding room (`name`, `description`, `language`, `isPrivate`)
- `POST /api/rooms/join` — Join room by 8-character invite code (`inviteCode`)
- `GET /api/rooms` — Fetch user's active and recent rooms
- `GET /api/rooms/:roomId` — Fetch room metadata and document content
- `DELETE /api/rooms/:roomId` — Delete room (Owner only)

### Sandboxed Code Execution (`/api/execution`)
- `POST /api/execution/run` — Run code in isolated runtime (`code`, `language`, `stdin`)
- `POST /api/execution/submit` — Submit solution against problem test suite (`code`, `language`, `roomId`, `problemId`)
- `POST /api/execution/test` — Run visible tests only

### Problems (`/api/problems`)
- `GET /api/problems` — List practice problems (Optional query: `?difficulty=easy`)
- `GET /api/problems/:slug` — Retrieve problem details, examples, and starter code
- `GET /api/problems/audit` — Report judge-data and harness compatibility for every saved problem

Production execution uses Judge0 by default. Configure `EXECUTION_PROVIDER=judge0`, `JUDGE0_URL`, and (when required by the deployment) `JUDGE0_API_KEY` on the server only. Provider outages return `Judge Error`; they are never converted into Accepted or Wrong Answer. The local runner is available only for explicit development/test configuration (`EXECUTION_PROVIDER=local`) and is not a production sandbox.

---

## Real-Time Socket Events

| Event Name | Direction | Payload | Description |
|---|---|---|---|
| `room:join` | Client → Server | `{ roomId, username }` | Join room session and request presence |
| `room:joined` | Server → Client | `{ roomId, user, users }` | Confirm join and return active participant list |
| `room:user-joined` | Server → Room | `{ user, users }` | Notify members of new participant |
| `room:user-left` | Server → Room | `{ socketId, users }` | Notify members when collaborator disconnects |
| `room:message` | Bidirectional | `{ roomId, message }` | Transmit in-room chat message |
| `code:update` | Bidirectional | `{ roomId, code, language }` | Synchronize code buffer with collaborators |
| `cursor:update` | Bidirectional | `{ roomId, cursor }` | Broadcast collaborator cursor line & column |
| `language:change` | Bidirectional | `{ roomId, language }` | Synchronize selected language across room |
| `yjs:update` | Bidirectional | `{ roomId, update: Uint8Array }` | Binary CRDT delta synchronization |

---

## Cloud & PaaS Deployment

Deploy Collab-Code easily to cloud providers:
- **Render (1-Click Blueprint)**: Uses the bundled [`render.yaml`](./render.yaml) to automatically deploy the Node.js backend Web Service and React Static Site.
- **Render Server + Vercel Client**: Host the persistent WebSocket backend on Render and the frontend SPA on Vercel with automated continuous deployment.
- **Database**: Connect free-tier MongoDB Atlas (`MONGODB_URI`) and Upstash Redis (`REDIS_URL`).

👉 Read the full step-by-step [Cloud Deployment Guide](./docs/DEPLOYMENT_GUIDE.md).

---

## Docker Deployment

To launch the full production stack including Client, Server, MongoDB, and Redis:

```bash
docker-compose up --build -d
```

- **Frontend Application**: `http://localhost:3000`
- **Backend API**: `http://localhost:5001`
- **MongoDB**: `localhost:27017`
- **Redis**: `localhost:6379`

To tear down:
```bash
docker-compose down -v
```

---

## Architecture Decision Records (ADRs)

- [ADR 001: Collaborative Editing via CRDT (Yjs)](docs/adr/001-collaborative-editing-crdt.md)
- [ADR 002: Isolated Code Execution Sandbox Boundary](docs/adr/002-isolated-code-execution-sandbox.md)
- [ADR 003: Redis Presence & Multi-Instance Horizontal Scaling](docs/adr/003-redis-presence-and-scaling.md)

---

## Known Limitations & Production Roadmap

1. **Monaco Mobile View**: Monaco Editor is optimized for desktop viewports; mobile interactions use touch-friendly scrolling fallback.
2. **Horizontal WebRTC Voice/Video**: Future iterations can integrate LiveKit or WebRTC mesh for peer voice channels.
3. **AST-based Autocomplete**: Future work can incorporate Language Server Protocol (LSP) over WebSockets for full IntelliSense.

---

## License

ISC License. Built by Abhishek Kumar.
