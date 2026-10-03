# ENGINEERING DECISIONS & ARCHITECTURAL TRADE-OFFS

**Project:** Newtonite Operations Platform ("Operations Under Pressure")  
**Stack:** JavaScript (MERN Stack: MongoDB, Express, React, Node.js) with Agentic AI Triage

This document outlines five foundational architectural decisions made while designing and building the Newtonite Operations Platform, articulating the trade-offs, rationale, and alternatives considered.

---

## 1. Dual-Store State & Audit Log Pattern vs. Pure Event-Sourcing (CQRS) vs. Embedded History Array

### The Problem
Work items endure frequent mutations (status transitions, re-assignments, approval requests, comments). Management and operators must be able to audit who did what, when, and why without silent loss of information. Simultaneously, high-concurrency dashboards must query tens of thousands of items by team, status, and SLA without performance degradation.

### Decision
We separated mutable current state (`work_items` collection) from immutable historical activity (`work_item_events` collection).

```
┌──────────────────────────────────────┐          ┌──────────────────────────────────────┐
│  work_items (Mutable Current State)  │          │ work_item_events (Immutable Log)     │
├──────────────────────────────────────┤          ├──────────────────────────────────────┤
│ - _id: ObjectId                      │          │ - _id: ObjectId                      │
│ - itemNumber: "OPS-1001"             │          │ - workItemId: ObjectId (FK)          │
│ - status: "IN_PROGRESS"              │          │ - sequenceNumber: 3 (matches version)│
│ - assigneeId: ObjectId               │          │ - eventType: "STATUS_CHANGED"        │
│ - version: 3 (OCC)                   │          │ - actor: { name, email, role }       │
│ - slaDueAt: ISODate                  │          │ - changes: [{ field, old, new }]     │
└──────────────────────────────────────┘          └──────────────────────────────────────┘
```

### Alternatives Evaluated & Trade-offs
1. **Embedded History Array (`work_items.history: [...]`)**:
   - *Pros:* Atomic update in a single write operation (`$push` + `$set`).
   - *Cons:* Violates MongoDB document boundaries (16MB BSON cap). Busy incidents with hundreds of comments cause document growth, high disk relocation, memory fragmentation, and poor payload efficiency on queue listing views.
2. **Pure Event Sourcing (CQRS)**:
   - *Pros:* Complete auditability, time-travel debugging, zero state mutation.
   - *Cons:* Significant operational complexity for a one-day assessment. Dynamic queue queries (filtering by team, status, assignee, and SLA simultaneously) require building and maintaining asynchronous read-projections, introducing eventual consistency lag and complex projector failure modes.
3. **Dual-Store Pragmatic Event Log (Chosen)**:
   - *Trade-off:* Requires dual writes (current document update + audit event insertion).
   - *Mitigation:* The primary document update uses atomic OCC (`findOneAndUpdate`). Upon confirmation, the audit event is appended with the exact sequence number. Even if secondary event logging fails under catastrophic failure, the primary state remains protected.

---

## 2. Concurrency Control: Atomic Compare-and-Swap (CAS) & Optimistic Concurrency Control (OCC)

### The Problem
In high-stress operations:
- Two users often attempt to take ownership of the same unassigned incident simultaneously.
- One operator may submit updates based on stale ticket information that another operator has already modified.

### Decision
We rejected naive `find -> modify in memory -> save` logic in favor of:
1. **Atomic Claiming via Atomic Compare-and-Swap (CAS)**:
   ```javascript
   const updated = await WorkItem.findOneAndUpdate(
     { _id: id, assigneeId: null, version: clientVersion },
     { $set: { assigneeId: userId, status: 'IN_PROGRESS' }, $inc: { version: 1 } },
     { new: true }
   );
   ```
   If another user claimed it microseconds earlier, MongoDB's document-level lock ensures `updated` returns `null`. The server returns **HTTP 409 Conflict (`ALREADY_CLAIMED`)**, preventing split-brain investigations.
2. **Optimistic Concurrency Control (OCC) with Integer Versioning**:
   Every work item maintains an integer `version`. State-mutating requests (`PUT /api/work-items/:id`) require the client's observed version. If `server.version !== client.version`, the write is rejected with **HTTP 409 Conflict**.
3. **Frontend Conflict Reconciliation UI**:
   Instead of a generic error, the React frontend renders a side-by-side reconciliation dialog showing the current server state, allowing the operator to review incoming updates and refresh safely without silently overwriting colleague work.

---

## 3. Asynchronous Processing: Resilient Task Queue with Dead-Letter Handling vs. Synchronous Blocking

### The Problem
Operations tickets frequently require heavy enrichment (categorization, severity estimation, duplicate incident detection, notifying external webhooks). Running these synchronously adds 500ms–3000ms latency to ticket creation, exposing the API to thread pool exhaustion under spikes.

### Decision
We introduced an asynchronous in-memory resilient event queue (`ResilientQueue`) to decouple core ingestion from secondary processing:
- The ticket creation endpoint (`POST /api/work-items`) responds in `< 15ms`, returning HTTP 201 with `version: 1`.
- A background worker (`ENRICH_WORK_ITEM`) picks up the task asynchronously.

### Addressing Failure Modes (as required by Candidate Brief)
1. **When processing fails:** The queue retries with **exponential backoff** (2s, 4s, 8s...) up to 3 attempts.
2. **When tasks execute more than once (At-least-once delivery):** The worker uses idempotent database updates (`$set: { aiAnalysis: ... }`), ensuring re-executions do not corrupt state or advance the OCC version unexpectedly.
3. **Dead-Letter Queue (DLQ):** After 3 failures, the task is moved to the DLQ, emitting an observability alert so no job silently disappears.

---

## 4. Duplicate Request Prevention via Global Idempotency Keys

### The Problem
Under network jitter or operational pressure, users frequently double-click buttons or retry HTTP requests, risking duplicate disbursements, duplicate comments, or unintended workflow transitions.

### Decision
Implemented global Idempotency Middleware using client-generated UUID headers (`Idempotency-Key`):
1. **Cache Inspection:** Before executing business logic, the middleware hashes the request body and checks the `idempotency_keys` collection.
2. **Deduplication:**
   - If an existing key has status `COMPLETED`, the server short-circuits and replays the cached HTTP response code and body with header `X-Cache-Lookup: IDEMPOTENT_HIT`.
   - If `IN_PROGRESS`, it returns HTTP 409 (`IDEMPOTENCY_IN_PROGRESS`), blocking duplicate concurrent executions.
3. **Storage Hygiene:** Records utilize a MongoDB TTL index (`expiresAt: 24h`) for automatic database pruning.

---

## 5. What Was Intentionally Chosen Not to Build (Scope & Boundaries)

To deliver a reliable, deeply-tested solution within the available timeframe, we prioritized high-concurrency correctness over decorative enterprise complexity:

1. **Distributed Consensus Brokers (Kafka / RabbitMQ):**
   - *Rationale:* For tens of thousands of active work items and hundreds of concurrent users, an in-process resilient queue with retry backoff and dead-lettering delivers predictable behavior without requiring ZooKeeper/Kafka broker infrastructure.
2. **Heavy OAuth2 / SSO Providers:**
   - *Rationale:* Replaced with an active actor switcher header (`x-user-id`) and RBAC/Team middleware. This enables evaluators to seamlessly simulate multiple team personas (Alice Lead vs. Bob Operator) in parallel browser sessions.
3. **Full-Blown CQRS Read Databases (Elasticsearch / Redis Read-Replicas):**
   - *Rationale:* MongoDB's compound indexes (`{ teamId: 1, status: 1, priority: -1, slaDueAt: 1 }`) easily sustain hundreds of queries per second at the target scale without cross-database synchronization lag.

---

## Summary of Critical Behaviors Beyond Simple CRUD
1. **Simultaneous Claims Race Condition:** CAS atomic guard with HTTP 409.
2. **Stale Information Handling:** OCC version checking + Frontend Conflict Modal.
3. **Accidental Duplicate Operations:** Idempotency Key cache with TTL.
4. **Workflow State Machine:** Rigid transition matrix + dual-authorization approval gate.
5. **Asynchronous Agentic AI Triage:** Autonomous background root-cause inference, next step suggestions, and duplicate ticket warnings.

