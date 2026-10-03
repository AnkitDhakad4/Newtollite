# Newtonite Operations Platform ("Operations Under Pressure")

> A high-concurrency operations management platform built with the **MERN stack (JavaScript)** and featuring **Autonomous Agentic AI Triage**, **Optimistic Concurrency Control (OCC)**, **Atomic Claims**, and **Global Idempotency**.

---

## Architecture Overview

```
                                  ┌────────────────────────┐
                                  │   React 18 + Vite UI   │
                                  │ (Actor Switcher, OCC)  │
                                  └───────────┬────────────┘
                                              │ HTTP + Idempotency-Key
                                              ▼
                                  ┌────────────────────────┐
                                  │  Express API (Node.js) │
                                  │ - OCC / CAS Middleware │
                                  │ - Workflow State Rules │
                                  │ - Team RBAC Auth       │
                                  └─────┬────────────┬─────┘
                                        │            │
            ┌───────────────────────────┘            └───────────────────────────┐
            ▼                                                                    ▼
 ┌───────────────────────┐                                            ┌──────────────────────┐
 │   MongoDB Collections │                                            │ Resilient Async Queue│
 │ - work_items (OCC)    │                                            │ (Retry + Backoff)    │
 │ - work_item_events    │                                            └──────────┬───────────┘
 │ - idempotency_keys    │                                                       │
 └───────────────────────┘                                                       ▼
                                                                      ┌──────────────────────┐
                                                                      │ Agentic AI OpsCopilot│
                                                                      │ - Root Cause Hypoth. │
                                                                      │ - Duplicate Detector │
                                                                      │ - Suggested Next Step│
                                                                      └──────────────────────┘
```

---

## Key Features

1. **Dual-Store History & Audit Trail**:
   - Current state resides in `work_items` with integer `version` field.
   - Every mutation, comment, assignment, and approval is logged to `work_item_events` with sequence numbers and field diffs.
2. **Atomic Race-Condition Handling**:
   - Two users claiming the same ticket simultaneously: MongoDB atomic Compare-And-Swap (`findOneAndUpdate`) guarantees **exactly one succeeds (HTTP 200)** while the second is rejected with **HTTP 409 Conflict (`ALREADY_CLAIMED`)**.
3. **Optimistic Concurrency Control (OCC)**:
   - Prevents stale overwrites when multiple operators edit the same request.
   - When a conflict occurs, the frontend displays an intuitive **Conflict Resolution Modal** with side-by-side server state.
4. **Accidental Duplicate Request Prevention (Idempotency)**:
   - Mutating endpoints accept an `Idempotency-Key` header (UUID).
   - Retried requests receive the cached response immediately (`X-Cache-Lookup: IDEMPOTENT_HIT`) without duplicate database mutations or duplicated events.
5. **Workflow State Machine & Approval Gates**:
   - Rigid state machine transitions (`NEW -> TRIAGED -> IN_PROGRESS -> PENDING_APPROVAL -> RESOLVED -> CLOSED`).
   - Work items requiring approval cannot be resolved without a Team Lead or Admin's sign-off.
6. **Agentic AI OpsCopilot (Asynchronous Worker)**:
   - Evaluates incoming requests in the background.
   - Generates root-cause hypotheses, assesses priority, and advises on immediate next steps.
   - Proactively detects duplicate or overlapping operational tickets across teams.
   - Pluggable: Uses Google Gemini 2.5 Flash via `@google/genai` when `GEMINI_API_KEY` is provided, with seamless fallback to intelligent operational heuristics when offline.
7. **Operator Cockpit (Attention Feed)**:
   - Surfaces imminent SLA breach risks (< 4 hours), unassigned critical work, and pending approval gates without requiring operators to search manually.
8. **Simulated Actor Switcher**:
   - Built-in UI dropdown allowing instant simulation of Alice (FinOps Lead), Bob (SRE Operator), Carol (Compliance Lead), and David (Junior Operator) to test concurrent permissions in real time.

---

## Quickstart Instructions

### 1. Prerequisites
- **Node.js** v18+ (tested on Node v20/v22)
- **Zero Database Setup Required**: The backend automatically spins up an in-memory MongoDB instance (`mongodb-memory-server`) if no external `MONGODB_URI` is provided!

### 2. Installation
Run the root installation command:
```bash
# In the project root:
npm run install:all
```
*(Or navigate to `server` and `client` individually and run `npm install`)*

### 3. Launching Development Servers
Run both backend and frontend concurrently:
```bash
npm run dev
```
- **Backend API:** `http://localhost:5000`
- **Frontend Cockpit:** `http://localhost:5173`

*(Alternatively, run `npm run dev:server` in one terminal and `npm run dev:client` in another)*

### 4. Running Automated Tests
Run the comprehensive test suite covering race conditions, OCC, idempotency, and workflow rules:
```bash
npm run test
```

---

## Environment Variables (Optional)

In `server/.env`:
```env
PORT=5000
NODE_ENV=development
# Optional: Connect to external MongoDB (defaults to in-memory MongoDB if omitted)
# MONGODB_URI=mongodb://localhost:27017/newtonite

# Optional: Enable live Gemini API triage (defaults to intelligent heuristics if omitted)
# GEMINI_API_KEY=your_gemini_api_key_here
```

---

## Critical Behaviors Demonstrated

| Hazard / Scenario | Architectural Solution | Status Code |
| :--- | :--- | :--- |
| Two users claim the same item simultaneously | Atomic CAS (`findOneAndUpdate` on `{ assigneeId: null, version }`) | `200 OK` (Winner)<br>`409 Conflict` (Loser) |
| User edits ticket based on stale view | OCC version match (`{ version: clientVersion }`) + Conflict Modal | `409 Conflict` with server diff |
| Network retry / repeated button clicks | Global Idempotency Middleware (`Idempotency-Key` + TTL) | `200/201` with cached response |
| Illegal workflow jump (e.g. `NEW` to `RESOLVED`) | Workflow State Machine Guard | `422 Unprocessable Entity` |
| Resolving without required approval | Dual-Authorization Gate Verification | `422 Unprocessable Entity` |
| Operator approval by unauthorized user | Resource-level RBAC check (`requireTeamRole`) | `403 Forbidden` |

---

## Known Limitations & Production Roadmap

1. **In-Process Resilient Queue**: The task queue runs in the Node.js process memory. In a distributed multi-node deployment, this would be backed by Redis / BullMQ or AWS SQS.
2. **Optimistic Locking Contention**: If an incident experiences dozens of simultaneous updates per second, OCC will result in frequent 409s. In such extreme write-contention scenarios, CRDTs or operational transforms for rich text would be introduced.
3. **WebSockets / Server-Sent Events (SSE)**: The current UI utilizes 6-second polling and event-driven optimistic updates. For sub-second multi-operator collaboration, an SSE stream would push server invalidations directly to clients.

