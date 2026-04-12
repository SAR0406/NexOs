# flow.md — NexOS Project Blueprint & System Flow

> **Version:** 1.0.0  
> **Type:** Architecture & Data Flow Reference  
> **Audience:** AI coding agents, vibe coders, and all technical contributors

---

## 1. System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           NEXOS SYSTEM                                  │
│                                                                         │
│  ┌──────────┐    ┌──────────────┐    ┌─────────────────────────────┐   │
│  │  Client  │    │  Next.js App │    │     Background Services      │   │
│  │ Browser  │◄──►│  (Frontend + │◄──►│  Trigger.dev Agent Workers  │   │
│  │  / PWA   │    │   API Layer) │    │  (Alert Engine, Briefings)   │   │
│  └──────────┘    └──────┬───────┘    └──────────────┬──────────────┘   │
│                         │                            │                  │
│              ┌──────────▼────────────────────────────▼──────────┐      │
│              │              Supabase (Core Data Layer)           │      │
│              │  PostgreSQL + pgvector + Realtime + Auth          │      │
│              └───────────────────┬───────────────────────────────┘      │
│                                  │                                      │
│         ┌────────────────────────┼────────────────────┐                │
│         │                        │                    │                │
│  ┌──────▼──────┐   ┌─────────────▼───────┐   ┌───────▼───────┐        │
│  │ Claude API  │   │  Composio / MCP     │   │   Resend      │        │
│  │ (Sonnet +   │   │  Integration Hub    │   │  (Email       │        │
│  │  Haiku)     │   │  Gmail/Stripe/Notion│   │   Delivery)   │        │
│  └─────────────┘   └─────────────────────┘   └───────────────┘        │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. User Journey Flows

### 2.1 New User Onboarding Flow

```
User lands on nexos.ai
        │
        ▼
[Landing Page]
  CTA: "Start Free Trial"
        │
        ▼
[Clerk Auth] — Sign up with Google or Email
        │
        ▼
[Onboarding Interview] — AI-driven conversation
  ┌─────────────────────────────────┐
  │ NexOS: "Tell me about your      │
  │ business. What do you do?"      │
  │                                 │
  │ Extracts:                       │
  │ · Business type & niche         │
  │ · Revenue model & pricing       │
  │ · Number of active clients      │
  │ · Current tools in use          │
  │ · Biggest current challenge     │
  │ · Revenue range                 │
  └─────────────────────────────────┘
        │
        ▼
[Build Initial Business Memory]
  · Generate business_profile record
  · Create context_summary (500 words)
  · Initialize memory_chunks in pgvector
        │
        ▼
[Integration Connect Screen]
  · Connect Gmail (required)
  · Connect Stripe (optional but recommended)
  · Connect Notion (optional)
        │
        ▼
[Sync Pipeline Triggers]
  · Gmail: pull last 90 days → parse → chunk → embed → store
  · Stripe: pull all-time data → compute metrics → store
  · Notion: pull selected pages → chunk → embed → store
        │
        ▼
[Dashboard] — First view
  · "NexOS is learning your business. 
     Check back in 10 minutes for your first insights."
        │
        ▼ (after sync completes)
[Dashboard Live] + [First Daily Briefing scheduled]
```

---

### 2.2 Daily Briefing Generation Flow

```
[Trigger.dev Cron Job]
  Fires at: 6:00 AM user's local timezone
        │
        ▼
[Fetch User Context]
  · Load user's business_profile
  · Load latest revenue_snapshots
  · Load recent email_events (last 24h)
  · Run client health scoring query
        │
        ▼
[Alert Detection]
  For each user:
  ├── Check silent clients (last_contact_at > threshold)
  ├── Check MRR delta vs 7 days ago
  ├── Check failed Stripe payments
  ├── Check negative sentiment emails
  └── Check overdue follow-ups
        │
        ▼
[Priority Generation]
  · Claude Haiku: rank top 3 actions for today
    Prompt: "Given this business context + alerts, 
    what are the 3 most important things to do today?"
        │
        ▼
[Briefing Rendering]
  · Claude Sonnet: generate briefing body text
    System: Always ground in retrieved data.
    Never hallucinate metrics.
    Cite: "Based on your Stripe data..."
        │
        ▼
[Resend Email Delivery]
  · Transactional email → user's email
  · Subject: "Your Business Today — [Date]"
  · HTML template with briefing content
        │
        ▼
[In-App Notification]
  · Supabase Realtime → push notification to dashboard
  · Briefing stored in `daily_briefings` table
```

---

### 2.3 Alert Engine Flow

```
[Trigger.dev Job: alert_scanner]
  Runs: Every 15 minutes
        │
        ▼
[For Each Active User:]
        │
        ├──▶ [A-001: Silent Client Check]
        │     SELECT clients where last_email_date < NOW() - INTERVAL user_threshold
        │     If found AND no alert sent in last 48h → Fire alert
        │
        ├──▶ [A-002: MRR Drop Check]
        │     Compare this_week_mrr vs last_week_mrr
        │     If delta < -10% AND no alert in 48h → Fire alert
        │
        ├──▶ [A-003: Failed Payment Check]
        │     Poll Stripe webhook events table
        │     New `payment_intent.payment_failed` → Fire alert immediately
        │
        ├──▶ [A-004: Cancellation Check]
        │     Poll Stripe webhook events table
        │     New `customer.subscription.deleted` → Fire alert immediately
        │
        └──▶ [A-005: Sentiment Check]
              Latest email_events with sentiment = 'negative' AND unread
              If found AND no alert in 24h → Fire alert
        │
        ▼
[Alert Dispatch]
  INSERT into alerts table (user_id, type, payload, status='unread')
  → Supabase Realtime → push to dashboard
  → If severity = HIGH → also send email via Resend
        │
        ▼
[Alert Cooldown Update]
  UPDATE alert_cooldowns SET last_fired_at = NOW()
  WHERE user_id = X AND alert_type = Y
```

---

### 2.4 Chat & Action Execution Flow

```
User types: "Draft a follow-up to Acme Corp"
        │
        ▼
[API Route: POST /api/chat]
        │
        ▼
[Intent Classification]
  Claude Haiku (fast + cheap):
  Classify as: QUERY | ANALYSIS | ACTION | STRATEGY
  Result: ACTION (type: email_draft)
        │
        ▼
[Context Retrieval — RAG]
  1. Embed user message → pgvector similarity search
  2. Retrieve top-8 memory chunks relevant to "Acme Corp"
  3. Fetch recent email_events WHERE client = 'Acme Corp'
  4. Fetch client health record for Acme Corp
  5. Assemble context window
        │
        ▼
[Claude Sonnet — Generation]
  System prompt: "You are NexOS, [user]'s AI Chief of Staff.
  You have access to their business memory. 
  Ground all responses in retrieved context.
  When drafting emails, match the user's writing style 
  (learned from their sent emails).
  Never fabricate information."
  
  User message + retrieved context → Claude Sonnet
        │
        ▼
[Response: Action Proposal]
  {
    type: "email_draft",
    to: "sarah@acmecorp.com",
    subject: "Checking in on the Q2 project",
    body: "[drafted email in user's voice]",
    reasoning: "Acme Corp hasn't replied in 12 days. 
                Your last email was March 28. 
                They're marked medium-risk."
  }
        │
        ▼
[UI: Action Approval Card]
  ┌──────────────────────────────────┐
  │ 📧 Draft Ready: Acme Corp        │
  │ ─────────────────────────────── │
  │ [Preview email]                  │
  │                                  │
  │ [✏️ Edit]  [❌ Cancel]  [✅ Send] │
  └──────────────────────────────────┘
        │
   ┌────┴────┐
   │         │
[Send]    [Edit]
   │         │
   ▼         ▼
[Composio  [Open editor
Gmail API]  → re-approve]
   │
   ▼
[action_log INSERT]
  · action_type: 'email_sent'
  · payload: {to, subject, sent_at}
  · status: 'completed'
   │
   ▼
[Memory Update]
  · INSERT email_events (direction: 'sent', client: 'Acme Corp', ...)
  · UPDATE client health: last_contact_at = NOW()
  · Chunk + embed new email → memory_chunks
```

---

## 3. Database Schema Flow

```
users (Clerk-managed)
  │
  ├─── business_profiles (1:1)
  │      id, user_id, business_name, niche, description,
  │      revenue_model, client_count, tools_used, 
  │      context_summary, created_at, updated_at
  │
  ├─── integrations (1:many)
  │      id, user_id, provider (gmail|stripe|notion),
  │      access_token, refresh_token, status, 
  │      last_synced_at, error_message
  │
  ├─── memory_chunks (1:many) [pgvector]
  │      id, user_id, content, embedding (vector 1536),
  │      source (email|stripe|notion|onboarding),
  │      source_id, created_at, metadata (jsonb)
  │
  ├─── email_events (1:many)
  │      id, user_id, gmail_message_id, 
  │      direction (sent|received), from_email, to_email,
  │      subject, body_summary, client_name,
  │      sentiment (positive|neutral|negative),
  │      received_at, processed_at
  │
  ├─── revenue_snapshots (1:many)
  │      id, user_id, snapshot_date, mrr, arr,
  │      new_mrr, churned_mrr, active_subscriptions,
  │      failed_payments_count, created_at
  │
  ├─── clients (1:many) [derived from email + Stripe]
  │      id, user_id, name, email, company,
  │      status (active|at_risk|churned|prospect),
  │      health_score (0–100), last_contact_at,
  │      total_revenue, tags (text[]), notes, created_at
  │
  ├─── alerts (1:many)
  │      id, user_id, alert_type, severity,
  │      title, body, payload (jsonb),
  │      status (unread|read|dismissed|actioned),
  │      created_at, read_at
  │
  ├─── alert_cooldowns (1:many)
  │      id, user_id, alert_type, last_fired_at
  │
  ├─── action_log (1:many)
  │      id, user_id, action_type, payload (jsonb),
  │      status (pending|approved|rejected|completed|failed),
  │      approved_at, executed_at, result (jsonb)
  │
  ├─── daily_briefings (1:many)
  │      id, user_id, briefing_date, content (jsonb),
  │      email_delivered_at, opened_at, created_at
  │
  └─── chat_sessions (1:many)
         id, user_id, messages (jsonb[]), 
         created_at, updated_at
```

---

## 4. API Routes Map

### Authentication
```
POST /api/auth/webhook          — Clerk webhook (user created/deleted)
```

### Onboarding
```
POST /api/onboarding/chat       — Onboarding interview messages
POST /api/onboarding/complete   — Finalize profile, trigger initial sync
```

### Integrations
```
GET  /api/integrations          — List all integrations + status
POST /api/integrations/gmail/connect     — Initiate Gmail OAuth
GET  /api/integrations/gmail/callback    — Gmail OAuth callback
POST /api/integrations/gmail/disconnect  — Revoke + delete tokens
POST /api/integrations/stripe/connect    — Stripe OAuth
GET  /api/integrations/stripe/callback   — Stripe callback
POST /api/integrations/stripe/webhook    — Stripe real-time events
POST /api/integrations/notion/connect    — Notion OAuth
GET  /api/integrations/notion/callback   — Notion callback
POST /api/integrations/sync/:provider    — Manual re-sync trigger
```

### Chat
```
POST /api/chat                  — Main chat endpoint (streaming SSE)
GET  /api/chat/sessions         — List chat history
DELETE /api/chat/sessions/:id   — Delete session
```

### Actions
```
GET  /api/actions               — List pending + completed actions
POST /api/actions/:id/approve   — Approve action → execute
POST /api/actions/:id/reject    — Reject action
POST /api/actions/:id/edit      — Edit then queue for re-approval
```

### Alerts
```
GET  /api/alerts                — List alerts (paginated)
POST /api/alerts/:id/read       — Mark as read
POST /api/alerts/:id/dismiss    — Dismiss alert
```

### Dashboard
```
GET  /api/dashboard/summary     — Health score, KPIs, active alerts count
GET  /api/dashboard/revenue     — Revenue chart data (time-series)
GET  /api/dashboard/clients     — Client health list
GET  /api/briefings             — List daily briefings
GET  /api/briefings/latest      — Latest briefing content
```

### Settings
```
GET  /api/settings/alerts       — User alert preferences
PUT  /api/settings/alerts       — Update thresholds and muted types
GET  /api/settings/business     — Business profile
PUT  /api/settings/business     — Update business profile
```

### Billing
```
POST /api/billing/create-checkout   — Stripe Checkout session
POST /api/billing/portal            — Stripe Customer Portal
GET  /api/billing/subscription      — Current subscription status
POST /api/billing/webhook           — Stripe billing webhooks
```

---

## 5. Environment Variables

```env
# App
NEXT_PUBLIC_APP_URL=https://nexos.ai
NODE_ENV=production

# Clerk (Auth)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...
CLERK_WEBHOOK_SECRET=whsec_...

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...

# Claude / Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Composio (Integrations)
COMPOSIO_API_KEY=...

# Google (Gmail OAuth)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=https://nexos.ai/api/integrations/gmail/callback

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_SOLO=price_...
STRIPE_PRICE_COS=price_...
STRIPE_PRICE_AGENCY=price_...

# Resend (Email)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=nexos@nexos.ai

# Trigger.dev (Background Jobs)
TRIGGER_API_KEY=tr_...

# OpenAI (Embeddings — text-embedding-3-small)
OPENAI_API_KEY=sk-...

# Sentry (Error Monitoring)
SENTRY_DSN=https://...@sentry.io/...

# PostHog (Analytics)
NEXT_PUBLIC_POSTHOG_KEY=phc_...
NEXT_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

---

## 6. File Structure

```
nexos/
├── app/                          # Next.js 14 App Router
│   ├── (auth)/
│   │   ├── sign-in/page.tsx
│   │   └── sign-up/page.tsx
│   ├── (app)/
│   │   ├── layout.tsx            # App shell (sidebar + header)
│   │   ├── dashboard/page.tsx
│   │   ├── chat/page.tsx
│   │   ├── alerts/page.tsx
│   │   ├── clients/page.tsx
│   │   ├── briefings/page.tsx
│   │   └── settings/
│   │       ├── page.tsx
│   │       ├── integrations/page.tsx
│   │       ├── alerts/page.tsx
│   │       └── billing/page.tsx
│   ├── onboarding/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── api/                      # API Routes
│   │   ├── auth/webhook/route.ts
│   │   ├── chat/route.ts
│   │   ├── integrations/
│   │   │   ├── gmail/
│   │   │   ├── stripe/
│   │   │   └── notion/
│   │   ├── actions/
│   │   ├── alerts/
│   │   ├── dashboard/
│   │   └── billing/
│   ├── layout.tsx                # Root layout
│   └── page.tsx                  # Landing page
│
├── components/
│   ├── ui/                       # shadcn/ui components
│   ├── dashboard/
│   │   ├── HealthScore.tsx
│   │   ├── MetricsBar.tsx
│   │   ├── AlertList.tsx
│   │   ├── PendingActions.tsx
│   │   └── RevenueChart.tsx
│   ├── chat/
│   │   ├── ChatInterface.tsx
│   │   ├── MessageBubble.tsx
│   │   └── ActionApprovalCard.tsx
│   ├── onboarding/
│   │   ├── InterviewChat.tsx
│   │   └── IntegrationConnect.tsx
│   └── shared/
│       ├── Sidebar.tsx
│       ├── Header.tsx
│       └── AlertBadge.tsx
│
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # Server client
│   │   └── admin.ts              # Service role client
│   ├── claude/
│   │   ├── client.ts             # Anthropic SDK setup
│   │   ├── prompts/              # All system prompts
│   │   │   ├── onboarding.ts
│   │   │   ├── briefing.ts
│   │   │   ├── chat.ts
│   │   │   └── action-draft.ts
│   │   └── tools/                # Tool definitions for Claude
│   │       ├── gmail.ts
│   │       ├── notion.ts
│   │       └── stripe.ts
│   ├── memory/
│   │   ├── embed.ts              # OpenAI embedding generation
│   │   ├── retrieve.ts           # pgvector RAG retrieval
│   │   └── update.ts             # Memory chunk management
│   ├── integrations/
│   │   ├── gmail.ts
│   │   ├── stripe.ts
│   │   └── notion.ts
│   ├── alerts/
│   │   ├── engine.ts             # Alert evaluation logic
│   │   └── dispatch.ts           # Alert delivery
│   └── utils/
│       ├── sentiment.ts
│       ├── client-health.ts
│       └── business-score.ts
│
├── trigger/                      # Trigger.dev jobs
│   ├── alert-scanner.ts
│   ├── daily-briefing.ts
│   ├── gmail-sync.ts
│   └── stripe-sync.ts
│
├── supabase/
│   └── migrations/               # SQL migration files
│       ├── 001_initial_schema.sql
│       ├── 002_pgvector.sql
│       └── 003_rls_policies.sql
│
├── emails/                       # React Email templates
│   ├── DailyBriefing.tsx
│   ├── AlertEmail.tsx
│   └── WelcomeEmail.tsx
│
├── middleware.ts                  # Clerk auth middleware
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## 7. Key Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| **Framework** | Next.js 14 App Router | Full-stack, server components, streaming, API routes all in one |
| **Database** | Supabase (Postgres + pgvector) | Best combo of structured DB + vector memory + auth + realtime |
| **Auth** | Clerk | Best DX for Next.js; handles OAuth, sessions, webhooks out of box |
| **AI Model** | Claude Sonnet (reasoning) + Haiku (classification) | Cost-optimized; Haiku for cheap tasks, Sonnet for quality outputs |
| **Embeddings** | OpenAI text-embedding-3-small | Cheapest + best quality; $0.02/1M tokens |
| **Integration Hub** | Composio | Prevents writing 3–10 individual OAuth integrations; 250+ tools |
| **Background Jobs** | Trigger.dev | Type-safe, observability built-in, best DX for Next.js |
| **Email** | Resend | Best DX + deliverability; React Email templates |
| **Payments** | Stripe Billing | Industry standard; handles subscriptions, trials, metering |
| **Error Monitoring** | Sentry | Standard; catches and groups production errors |
| **Analytics** | PostHog | Product analytics + session replay + feature flags in one |
