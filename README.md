# ReachInbox Email Scheduler

Production-oriented full-stack application for scheduling and monitoring email campaigns. The backend uses Express, PostgreSQL, BullMQ/Redis, Ethereal SMTP, Elasticsearch, Google OAuth and Slack OAuth. The responsive dashboard uses React, TypeScript, Vite and Tailwind CSS and follows the supplied Figma flow.

## Architecture in simple words

- **PostgreSQL is the source of truth:** users, senders, campaigns and every recipient's final status live here.
- **BullMQ + Redis is the clock:** each recipient becomes a durable delayed job. No cron library is used.
- **The API and worker are separate:** API accepts requests; worker sends mail. Either can be scaled independently.
- **Redis Lua is the traffic controller:** one atomic script enforces the per-sender hourly limit and minimum send gap across all worker instances.
- **Elasticsearch is the search engine:** sent emails are indexed; API falls back to PostgreSQL if Elasticsearch is temporarily unavailable.

## Module structure

```text
prisma/schema.prisma           Database models
src/config                    Validated environment and logging
src/lib                       Shared DB, Redis, crypto, JWT and Elasticsearch clients
src/middleware                Authentication, errors and Bull Board protection
src/modules/auth              Real Google OAuth login
src/modules/senders           Multiple encrypted SMTP sender accounts
src/modules/emails            Campaign API, mailer, worker and rate limiter
src/modules/integrations      Slack OAuth and notifications
src/queues                    BullMQ queue and restart reconciliation
src/api.ts                    API process entry point
src/worker.ts                 Worker process entry point
frontend/src/context         Google session state
frontend/src/components      Reusable shell, table and UI components
frontend/src/pages           Login, dashboard and compose screens
frontend/src/lib/api.ts      Typed API request helper
```

## Local setup

Requirements: Node.js 20+, Docker Desktop and npm.

```bash
cp .env.example .env
docker compose up -d
npm install
npm --prefix frontend install
npm run db:generate
npm run db:migrate -- --name init
npm run dev
```

To run API, worker and frontend together:

```bash
npm run dev:all
```

API: `http://localhost:4000`  
Frontend: `http://localhost:3000`  
Health: `http://localhost:4000/health`  
BullMQ dashboard: `http://localhost:4000/admin/queues` (HTTP Basic credentials from `.env`)

`npm run dev` starts both processes. They can also run separately with `npm run dev:api` and `npm run dev:worker`.

### Frontend flow

1. Open `http://localhost:3000` and continue with Google.
2. The dashboard shows Scheduled, Sent and Failed emails with counts and search.
3. Choose **Compose**, select a sender, add recipients manually or upload a CSV/TXT list, then schedule the campaign.
4. Failed rows can be retried safely. Slack connection status is visible in the sidebar.

## External setup

### Google

Create a Google OAuth Web Client and register:

```text
http://localhost:4000/api/v1/auth/google/callback
```

Put its client ID and secret in `.env`. Login starts at `GET /api/v1/auth/google`.

### Ethereal and multiple senders

Create test credentials at Ethereal and put them in `.env`. The first Google login automatically creates or updates that user's default sender. Additional sender accounts can be added with `POST /api/v1/senders`. SMTP passwords are AES-256-GCM encrypted in PostgreSQL using `INTEGRATION_ENCRYPTION_KEY`.

### Slack

Create a Slack app, enable OAuth, add `chat:write` (and an incoming webhook if channel selection is desired), and register:

```text
http://localhost:4000/api/v1/integrations/slack/callback
```

Connect at `GET /api/v1/integrations/slack/connect`. The bot token is encrypted. If Slack is disconnected, rate-limit events simply skip notification. Reconnect takes effect immediately.

## Main APIs

All protected endpoints use the HTTP-only Google session cookie.

- `GET /api/v1/auth/me`
- `POST /api/v1/auth/logout`
- `GET|POST /api/v1/senders`
- `POST /api/v1/emails/campaigns`
- `GET /api/v1/emails?status=scheduled|sent|failed&page=1&limit=20&search=`
- `POST /api/v1/emails/:id/retry` (failed emails only)
- `GET /api/v1/search?q=`
- `GET /api/v1/integrations/slack/status`
- `POST /api/v1/integrations/slack/test`
- `DELETE /api/v1/integrations/slack/disconnect`

Example campaign body:

```json
{
  "senderId": "sender_cuid",
  "recipients": ["one@example.com", "two@example.com"],
  "subject": "Hello",
  "bodyHtml": "<p>Hello from ReachInbox</p>",
  "startTime": "2026-08-28T15:00:00.000Z",
  "delayMs": 2000,
  "hourlyLimit": 200
}
```

## Persistence and load behavior

- Redis uses AOF storage in Docker and PostgreSQL keeps permanent state.
- BullMQ job IDs equal database email IDs, making queue registration idempotent.
- API and worker startup reconcile every pending DB email into BullMQ. Re-adding an existing job ID is safe.
- With 1,000 emails at the same time, BullMQ buffers them and workers process only `WORKER_CONCURRENCY` jobs concurrently.
- The effective delay is `max(campaign delay, MIN_SEND_DELAY_MS)`.
- The effective hourly limit is `min(campaign limit, DEFAULT_MAX_EMAILS_PER_HOUR)`.
- At the limit, jobs move to the next UTC hour window; they are never dropped. A Redis notification key ensures Slack is notified once per sender/window.
- Failed SMTP calls retry using exponential BullMQ backoff and become `FAILED` after `JOB_ATTEMPTS`.

## Idempotency trade-off

The stable BullMQ job ID and atomic database claim prevent ordinary duplicate execution. Like any SMTP system, there is a tiny unavoidable uncertainty if SMTP accepts a message and the process dies before PostgreSQL records `SENT`, because SMTP has no idempotency key. A true exactly-once guarantee requires a provider that supports idempotency keys or delivery reconciliation. This limitation is documented rather than hidden.

## Checks

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run frontend:typecheck
npm run frontend:lint
npm run frontend:build
```

Run every check in sequence with `npm run check`.
