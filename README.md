# ReachInbox Full-stack Email Job Scheduler

A production-oriented email scheduling service and responsive dashboard built for the ReachInbox hiring assignment. It accepts campaigns, stores them in PostgreSQL, schedules one persistent BullMQ job per recipient, sends through Ethereal SMTP, indexes email records in Elasticsearch, and notifies Slack when a sender reaches its hourly limit.

## Tech stack

| Area | Technology |
| --- | --- |
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, React Router |
| API | Node.js, TypeScript, Express, Zod |
| Database | PostgreSQL 16, Prisma ORM |
| Queue | BullMQ with Redis 7 |
| Email | Nodemailer with Ethereal SMTP |
| Search | Elasticsearch 8 with PostgreSQL fallback |
| Authentication | Google OAuth, signed JWT in an HTTP-only cookie |
| Notifications | Slack OAuth and Slack Web API |
| Infrastructure | Docker Compose |

## Features implemented

### Backend

- [x] Email campaign scheduling API with request validation
- [x] One delayed BullMQ job per recipient; no cron jobs
- [x] PostgreSQL persistence for users, senders, campaigns and delivery status
- [x] Restart reconciliation that restores missing pending queue jobs
- [x] Stable job IDs and database status checks for idempotent processing
- [x] Multiple SMTP sender accounts with encrypted passwords
- [x] Configurable worker concurrency
- [x] Configurable minimum delay between sends
- [x] Per-sender, per-UTC-hour distributed rate limiting
- [x] Atomic Redis Lua script safe across multiple workers and instances
- [x] Rate-limited jobs rescheduled to the next hour instead of dropped
- [x] Exponential retry backoff and final failed state
- [x] Safe manual retry endpoint for failed email records
- [x] Elasticsearch indexing and search with PostgreSQL fallback
- [x] Real Slack OAuth connection, disconnect/reconnect and rate-limit alerts
- [x] Authenticated live BullMQ dashboard
- [x] Health endpoint, structured logs, CORS, Helmet and API rate limiting

### Frontend

- [x] Real Google OAuth login and logout
- [x] Protected routes and persistent cookie-based session
- [x] User name, email and avatar
- [x] Scheduled, Sent and Failed email sections with live counts
- [x] Search, loading, empty and error states
- [x] Compose screen with sender selection
- [x] Manual recipients and CSV/TXT recipient upload
- [x] Unique address detection and recipient count
- [x] Subject, body, start time, per-email delay and hourly limit
- [x] Failed-email retry and Ethereal preview links
- [x] Slack connection status
- [x] Responsive desktop and mobile layout based on the supplied Figma

## Architecture

```text
React dashboard (localhost:3000)
              |
              | HTTP + secure session cookie
              v
Express API (localhost:4000)
     |             |                 |
     |             |                 +--> Slack OAuth / notifications
     |             +--> BullMQ delayed jobs --> Redis
     v                                      |
PostgreSQL                                  v
(source of truth)                    Background worker
                                             |
                                  rate-limit slot in Redis
                                             |
                                             v
                                      Ethereal SMTP
                                             |
                               PostgreSQL status + Elasticsearch index
```

The API and worker are separate processes. The API remains responsive while the worker performs SMTP delivery, and either process can be scaled independently.

## How scheduling works

1. The authenticated user submits a sender, recipient list, subject, HTML body, start time, delay and hourly limit.
2. Zod validates the request, and the API verifies that the selected active sender belongs to that user.
3. A PostgreSQL transaction creates one `Campaign` and one `ScheduledEmail` record per unique recipient.
4. Recipient `n` is initially scheduled at `startTime + (n * delayMs)`.
5. Each database email ID becomes the BullMQ `jobId`. BullMQ stores the job as a Redis-backed delayed job.
6. At the due time, the worker claims a rate-limit slot, marks the record `PROCESSING`, decrypts the SMTP password and sends through Nodemailer.
7. Success changes the record to `SENT`, stores the provider ID and Ethereal preview URL, and indexes it in Elasticsearch.
8. SMTP errors use BullMQ exponential retry backoff. After the configured attempts are exhausted, the record becomes `FAILED` with the error and timestamp.

## Persistence and restart recovery

PostgreSQL is the permanent source of truth. Redis also uses append-only persistence through Docker, but correctness does not depend only on Redis.

Both the API and worker run a startup reconciliation:

1. Read all `SCHEDULED` and `PROCESSING` records from PostgreSQL in batches.
2. Re-add each record to BullMQ with its database ID as the stable `jobId`.
3. BullMQ ignores an already-existing job ID, so reconciliation is idempotent.
4. A past-due job receives zero delay and is processed as soon as the worker is available.

The worker also skips records already marked `SENT`. Therefore future jobs survive process restarts without restarting the campaign or normally sending an already-completed record twice.

## Rate limiting, delay and concurrency

The effective delivery policy uses the stricter system and campaign values:

```text
effective delay        = max(campaign delay, MIN_SEND_DELAY_MS)
effective hourly limit = min(campaign limit, DEFAULT_MAX_EMAILS_PER_HOUR)
```

- Worker concurrency is controlled by `WORKER_CONCURRENCY` (default `5`).
- A Redis Lua script atomically checks the sender's hourly count and last-send timestamp.
- Atomic execution prevents parallel worker instances from exceeding a sender's limits.
- If only the minimum gap is blocked, the job is delayed until that gap is available.
- If the hourly limit is reached, the job moves to the next UTC-hour boundary; it is not failed or dropped.
- A Redis notification key permits one Slack rate-limit alert per sender/hour window.
- If Slack is disconnected or sending the alert fails, email processing continues safely.

For 1,000+ emails scheduled at roughly the same time, BullMQ buffers all jobs while workers consume only up to the configured concurrency. The shared Redis limiter controls the true send rate across every worker instance.

## Prerequisites

- Node.js 20 or newer
- npm
- Docker Desktop (or separately running PostgreSQL, Redis and Elasticsearch)
- Google OAuth web client
- Ethereal test account
- Slack app for the rate-limit notification demo

## Local setup

### 1. Install dependencies

```bash
npm install
npm --prefix frontend install
```

### 2. Create the environment file

macOS/Linux:

```bash
cp .env.example .env
```

Windows PowerShell:

```powershell
Copy-Item .env.example .env
```

Replace every placeholder in `.env`. Never commit `.env` or real credentials.

### 3. Start infrastructure

```bash
docker compose up -d
docker compose ps
```

Docker starts:

- PostgreSQL on `5432`
- Redis on `6379` with append-only persistence
- Elasticsearch on `9200`

### 4. Generate Prisma Client and apply migrations

```bash
npm run db:generate
npm run db:deploy
```

### 5. Run backend and worker

```bash
npm run dev
```

This starts:

- Express API with `npm run dev:api`
- BullMQ worker with `npm run dev:worker`

### 6. Run the frontend

In another terminal:

```bash
npm run dev:frontend
```

Alternatively, start the API, worker and frontend together:

```bash
npm run dev:all
```

Open `http://localhost:3000`.

## Environment variables

The complete template is in `.env.example`.

| Variable | Purpose |
| --- | --- |
| `API_PORT`, `API_BASE_URL` | Express port and public backend URL |
| `FRONTEND_URL` | Allowed CORS origin and OAuth redirect target |
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL`, `QUEUE_PREFIX` | Redis connection and BullMQ key prefix |
| `ELASTICSEARCH_URL`, `ELASTICSEARCH_ENABLED` | Search connection and feature switch |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Session-token signing and expiry |
| `INTEGRATION_ENCRYPTION_KEY` | Encrypts SMTP passwords and Slack access tokens at rest |
| `COOKIE_SECURE` | Set `true` behind production HTTPS |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Google OAuth web-client configuration |
| `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`, `SLACK_REDIRECT_URI` | Slack OAuth configuration |
| `SLACK_SCOPES`, `SLACK_DEFAULT_CHANNEL_ID` | Requested scopes and optional default channel |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | Ethereal SMTP connection |
| `SMTP_USER`, `SMTP_PASS` | Ethereal account credentials |
| `SMTP_FROM_EMAIL`, `SMTP_FROM_NAME` | Default sender identity |
| `WORKER_CONCURRENCY` | Maximum jobs concurrently processed by one worker |
| `MIN_SEND_DELAY_MS` | System-wide minimum time between sends per sender |
| `DEFAULT_MAX_EMAILS_PER_HOUR` | System-wide maximum emails per sender/hour |
| `JOB_ATTEMPTS`, `JOB_BACKOFF_MS` | Retry count and exponential backoff base |
| `BULL_BOARD_USERNAME`, `BULL_BOARD_PASSWORD` | Queue-dashboard Basic Auth |
| `LOG_LEVEL` | Application log verbosity |

Use independent random values of at least 32 characters for `JWT_SECRET` and `INTEGRATION_ENCRYPTION_KEY`.

## Ethereal Email setup

1. Visit `https://ethereal.email/create`.
2. Create a disposable test account.
3. Copy the generated email address/username and password.
4. Configure `.env`:

```env
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=generated-ethereal-username
SMTP_PASS=generated-ethereal-password
SMTP_FROM_EMAIL=generated-ethereal-email
SMTP_FROM_NAME=ReachInbox Demo
```

5. Restart the API and worker, then sign in with Google again so the default sender is created or updated.
6. Schedule an email from the frontend. After it sends, open **Sent → Preview**.

Ethereal captures mail for testing and does not deliver it to a real Gmail inbox. A `SENT` status here means Ethereal SMTP accepted the message.

## Google OAuth setup

1. Create a project in Google Cloud Console.
2. Configure the Google Auth Platform consent screen and add your account as a test user.
3. Create an OAuth client of type **Web application**.
4. Add this authorized redirect URI exactly:

```text
http://localhost:4000/api/v1/auth/google/callback
```

5. Copy the client ID and secret into `.env`.

Login begins at `GET /api/v1/auth/google`. The callback stores a signed JWT in an HTTP-only cookie and redirects to the frontend dashboard.

## Slack setup

1. Create a Slack app for your test workspace.
2. Add the bot scope `chat:write`; enable incoming webhooks if OAuth channel selection is required.
3. Add this OAuth redirect URL exactly:

```text
http://localhost:4000/api/v1/integrations/slack/callback
```

4. Put the Slack client ID and secret in `.env`.
5. Click **Connect Slack** in the dashboard, select a channel and allow access.
6. Ensure the bot is a member of the selected channel.

Disconnecting Slack does not stop email processing. Reconnecting takes effect immediately without a redeploy.

## Application URLs

| Service | URL |
| --- | --- |
| Frontend | `http://localhost:3000` |
| API health | `http://localhost:4000/health` |
| BullMQ dashboard | `http://localhost:4000/admin/queues` |
| Prisma Studio | `http://localhost:5555` after `npm run db:studio` |
| Elasticsearch | `http://localhost:9200` |

## Main API endpoints

All application endpoints except OAuth initiation/callback require the HTTP-only session cookie.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/v1/auth/google` | Start Google OAuth |
| `GET` | `/api/v1/auth/me` | Read current user |
| `POST` | `/api/v1/auth/logout` | Clear session |
| `GET`, `POST` | `/api/v1/senders` | List or create sender accounts |
| `PATCH` | `/api/v1/senders/:id/default` | Make an active sender default |
| `PATCH` | `/api/v1/senders/:id/deactivate` | Deactivate a sender |
| `POST` | `/api/v1/emails/campaigns` | Schedule a campaign |
| `GET` | `/api/v1/emails?status=scheduled\|sent\|failed` | Paginated email list |
| `POST` | `/api/v1/emails/:id/retry` | Retry a failed email |
| `GET` | `/api/v1/search?q=` | Elasticsearch-backed search |
| `GET` | `/api/v1/integrations/slack/connect` | Start Slack OAuth |
| `GET` | `/api/v1/integrations/slack/status` | Read Slack connection |
| `POST` | `/api/v1/integrations/slack/test` | Send a test Slack notification |
| `DELETE` | `/api/v1/integrations/slack/disconnect` | Disconnect Slack |

Example campaign request:

```json
{
  "senderId": "sender_cuid",
  "recipients": ["one@example.com", "two@example.com"],
  "subject": "Scheduled hello",
  "bodyHtml": "<p>Hello from ReachInbox</p>",
  "startTime": "2026-08-28T15:00:00.000Z",
  "delayMs": 2000,
  "hourlyLimit": 200
}
```

## Project structure

```text
frontend/
  src/components/             Reusable shell, tables and UI states
  src/context/                Authentication state
  src/lib/                    API client
  src/pages/                  Login, dashboard and compose pages
prisma/
  migrations/                 Versioned PostgreSQL migrations
  schema.prisma               Relational data model
src/
  config/                     Validated environment and logging
  lib/                        Prisma, Redis, crypto, JWT and Elasticsearch
  middleware/                 Authentication, errors and dashboard protection
  modules/auth/               Google OAuth
  modules/senders/            Multiple encrypted SMTP senders
  modules/emails/             APIs, scheduling policy, rate limiter and worker
  modules/integrations/       Slack OAuth and notifications
  queues/                     BullMQ queue and startup reconciliation
  api.ts                      API process entry point
  worker.ts                   Worker process entry point
tests/                        Scheduling-policy unit tests
```

## Quality checks

Run all checks:

```bash
npm run check
```

Or run them individually:

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run frontend:typecheck
npm run frontend:lint
npm run frontend:build
```

## Assumptions and trade-offs

- Hourly windows use UTC boundaries so every worker calculates the same window.
- Rate limiting is per sender, which is stricter and more useful than a single-process in-memory counter.
- Elasticsearch is used for indexing/search, but list APIs retain a PostgreSQL fallback so a search outage does not break the dashboard.
- Ethereal is intentionally used for safe testing and does not deliver to real inboxes.
- Job IDs and database claims prevent normal duplicate processing. SMTP itself has no idempotency key: if SMTP accepts a message and the process dies before the `SENT` database update, delivery becomes uncertain. True exactly-once delivery requires a provider with idempotency keys or delivery webhooks/reconciliation.
- BullMQ completed jobs are retained for 24 hours (up to 10,000), failed jobs for seven days (up to 10,000); PostgreSQL keeps the permanent history.
- The supplied Figma did not include sender-management settings, so the frontend selects existing senders while the backend exposes APIs for creating/defaulting/deactivating additional accounts.

## Security notes

- SMTP passwords and Slack access tokens use AES-256-GCM encryption at rest.
- Session JWTs are stored in HTTP-only cookies.
- OAuth state is signed and time-limited.
- API input is validated with Zod.
- Bull Board uses HTTP Basic authentication.
- `.env` is gitignored. Do not commit or share real credentials.
