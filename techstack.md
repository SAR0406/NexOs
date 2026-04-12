# techstack.md — NexOS Technical Stack

> **Version:** 1.0.0  
> **Philosophy:** Minimal dependencies. Maximum velocity. Every choice must justify its existence.  
> **Rule:** If two tools do the same job, cut one. Complexity is the enemy of shipping.

---

## Stack at a Glance

```
LAYER              TOOL                    WHY
─────────────────────────────────────────────────────────────────
Frontend           Next.js 14              Full-stack, App Router, streaming
Styling            Tailwind CSS + shadcn   Speed without design debt
Auth               Clerk                   OAuth, sessions, webhooks, zero config
Database           Supabase (Postgres)     Structured data + Realtime + Row Level Security
Vector Memory      pgvector (Supabase)     Semantic search built into Postgres
AI Reasoning       Claude Sonnet 4.6       Best reasoning-to-cost ratio
AI Classification  Claude Haiku 4.5        Fast + cheap for intent/sentiment tasks
Embeddings         OpenAI text-embed-3-sm  $0.02/1M tokens, best quality
Integrations       Composio                250+ OAuth connectors, no custom OAuth code
Background Jobs    Trigger.dev             Type-safe cron + event jobs for Next.js
Email Delivery     Resend + React Email    Best deliverability + React templates
Payments           Stripe Billing          Subscriptions, trials, metering, portal
Error Monitoring   Sentry                  Production error tracking
Product Analytics  PostHog                 Events, funnels, session replay, flags
Deployment         Vercel                  Zero-config Next.js deployment
DNS / CDN          Cloudflare              DDoS protection + edge caching
```

---

## 1. Frontend

### Next.js 14 (App Router)
```
Version: 14.x (latest)
Router: App Router (not Pages Router)
Rendering: Server Components by default; Client Components only when needed
Streaming: Use React Suspense + streaming for chat interface
```

**Key patterns:**
- Server Components for all data-fetching pages (dashboard, alerts, briefings)
- Client Components only for interactive UI (chat, action approval cards)
- Route Handlers (`/api/*`) for all backend logic
- Middleware for auth protection (Clerk)

**What NOT to do:**
- ❌ Don't use `getServerSideProps` — we're App Router only
- ❌ Don't put secrets in Client Components
- ❌ Don't use `useEffect` for data fetching — use Server Components

---

### Tailwind CSS + shadcn/ui
```
Tailwind: v3.x
shadcn/ui: Latest (copy-paste component library, not an npm package)
Fonts: Geist (from Vercel) or custom via next/font
```

**Component sourcing priority:**
1. shadcn/ui component → use as-is
2. shadcn/ui component → customize with Tailwind
3. Build from scratch with Tailwind only

**Design tokens (globals.css):**
```css
:root {
  --background: 0 0% 97%;         /* off-white paper */
  --foreground: 240 10% 4%;       /* near-black ink */
  --primary: 16 76% 48%;          /* NexOS accent orange */
  --primary-foreground: 0 0% 98%;
  --muted: 240 5% 64%;
  --border: 240 6% 90%;
  --radius: 0.375rem;
}
```

---

## 2. Authentication — Clerk

```
Package: @clerk/nextjs
Version: Latest
Mode: Hosted (not self-hosted)
Session strategy: JWT
```

**Setup:**
```ts
// middleware.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server'

const isPublicRoute = createRouteMatcher([
  '/', '/sign-in(.*)', '/sign-up(.*)', '/api/webhooks/(.*)'
])

export default clerkMiddleware((auth, req) => {
  if (!isPublicRoute(req)) auth().protect()
})
```

**User sync to Supabase:**
- Clerk webhook (`user.created`, `user.deleted`) → `/api/auth/webhook`
- Creates/deletes row in `users` table (mirroring Clerk user ID)
- Supabase RLS uses `auth.uid()` = Clerk user ID stored in JWT

**Key env vars:**
```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
CLERK_SECRET_KEY
CLERK_WEBHOOK_SECRET
```

---

## 3. Database — Supabase

### Postgres (Main DB)
```
Host: Supabase managed
Region: us-east-1 (or closest to majority of users)
Connection: Connection pooling via Supavisor (Transaction mode for API routes)
```

**Client setup:**
```ts
// lib/supabase/server.ts — for Server Components + Route Handlers
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  )
}

// lib/supabase/admin.ts — for background jobs (bypasses RLS)
import { createClient } from '@supabase/supabase-js'
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)
```

### pgvector (Memory Layer)
```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Memory chunks table
CREATE TABLE memory_chunks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  embedding   VECTOR(1536),              -- OpenAI text-embedding-3-small
  source      TEXT NOT NULL,             -- 'gmail' | 'stripe' | 'notion' | 'onboarding'
  source_id   TEXT,                      -- External ID (gmail message ID, etc.)
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast similarity search
CREATE INDEX ON memory_chunks 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

**RAG retrieval function:**
```sql
CREATE OR REPLACE FUNCTION match_memory(
  query_embedding VECTOR(1536),
  match_user_id TEXT,
  match_count INT DEFAULT 8,
  match_threshold FLOAT DEFAULT 0.7
)
RETURNS TABLE (id UUID, content TEXT, source TEXT, similarity FLOAT)
LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT m.id, m.content, m.source,
         1 - (m.embedding <=> query_embedding) AS similarity
  FROM memory_chunks m
  WHERE m.user_id = match_user_id
    AND 1 - (m.embedding <=> query_embedding) > match_threshold
  ORDER BY m.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### Row Level Security
```sql
-- Enable RLS on all tables
ALTER TABLE business_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE memory_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
-- ... (all tables)

-- Policy pattern: users can only see their own data
CREATE POLICY "user_isolation" ON memory_chunks
  FOR ALL USING (user_id = auth.uid());
```

---

## 4. AI Layer — Claude API

### Model Selection Strategy
```
Task                          Model               Reason
─────────────────────────────────────────────────────────────
Onboarding interview          claude-sonnet-4-6   Nuanced conversation
Daily briefing generation     claude-sonnet-4-6   Quality output matters
Chat / strategy questions     claude-sonnet-4-6   Deep reasoning needed
Email drafting                claude-sonnet-4-6   Style matching + quality
Intent classification         claude-haiku-4-5    Fast + cheap (< 100ms)
Sentiment analysis            claude-haiku-4-5    Fast + cheap
Priority ranking (briefing)   claude-haiku-4-5    Structured output, fast
```

### Client Setup
```ts
// lib/claude/client.ts
import Anthropic from '@anthropic-ai/sdk'

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY!,
})

// Haiku (fast, cheap)
export const claudeHaiku = (messages: any[], system?: string) =>
  claude.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system,
    messages,
  })

// Sonnet (quality)
export const claudeSonnet = (messages: any[], system?: string) =>
  claude.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system,
    messages,
  })

// Sonnet streaming (for chat)
export const claudeSonnetStream = (messages: any[], system?: string) =>
  claude.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    system,
    messages,
  })
```

### System Prompt Architecture
```ts
// lib/claude/prompts/chat.ts
export function buildChatSystemPrompt(
  businessProfile: BusinessProfile,
  retrievedContext: MemoryChunk[]
): string {
  return `You are NexOS, the AI Chief of Staff for ${businessProfile.business_name}.

## About This Business
${businessProfile.context_summary}

## Retrieved Business Context
${retrievedContext.map(c => `[${c.source.toUpperCase()}]: ${c.content}`).join('\n\n')}

## Your Rules
- ALWAYS ground responses in the retrieved context above
- ALWAYS cite your source: "Based on your email from [date]..."
- NEVER fabricate metrics, names, or events
- When drafting actions (emails, etc.), match the user's writing style
- When uncertain, say so and ask for clarification
- Keep responses concise unless depth is explicitly needed

## Action Format
When the user requests an action, respond with a structured action proposal:
<action>
  <type>email_draft | notion_update | calendar_event</type>
  <payload>{ JSON payload }</payload>
  <reasoning>Why you're proposing this action</reasoning>
</action>`
}
```

### Cost Management
```ts
// Track token usage per user per month
// Enforce limits by tier:
const TOKEN_LIMITS = {
  starter: 50_000,     // ~10 queries/day
  solo: 500_000,       // unlimited feel
  cos: 2_000_000,      // heavy usage
  agency: 5_000_000,   // team usage
}

// Use Haiku aggressively for non-visible tasks
// Cache embeddings (never re-embed the same content)
// Cache briefing context (don't re-fetch static data on retry)
```

---

## 5. Memory & Embeddings

### OpenAI Embeddings
```ts
// lib/memory/embed.ts
import OpenAI from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! })

export async function embed(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',  // 1536 dimensions, cheapest + best
    input: text.slice(0, 8000),        // respect token limit
  })
  return response.data[0].embedding
}

// Batch embedding for sync operations
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts.map(t => t.slice(0, 8000)),
  })
  return response.data.map(d => d.embedding)
}
```

### Chunking Strategy
```ts
// lib/memory/chunk.ts
// Emails: chunk per email (don't split individual emails)
// Notion pages: chunk by heading (H1/H2 = new chunk)
// Long content: 512 token chunks with 50 token overlap
// Business profile: stored as single chunk + structured fields

export function chunkEmail(email: ParsedEmail): string {
  return `EMAIL | ${email.date} | ${email.direction} | ${email.from}
Subject: ${email.subject}
${email.bodySummary}` // Use Claude Haiku to summarize long emails
}

export function chunkRevenue(snapshot: RevenueSnapshot): string {
  return `REVENUE SNAPSHOT | ${snapshot.date}
MRR: $${snapshot.mrr} | ARR: $${snapshot.arr}
New MRR: $${snapshot.new_mrr} | Churned: $${snapshot.churned_mrr}
Active subscriptions: ${snapshot.active_subscriptions}`
}
```

---

## 6. Integrations — Composio

```ts
// lib/integrations/composio.ts
import { Composio } from '@composio/core'

const composio = new Composio({ apiKey: process.env.COMPOSIO_API_KEY! })

// Get OAuth URL for user to connect
export async function getGmailOAuthUrl(userId: string): Promise<string> {
  return composio.getAuthUrl({
    appName: 'gmail',
    userId,
    redirectUri: `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/gmail/callback`,
    scopes: ['gmail.readonly', 'gmail.send'],
  })
}

// Execute actions via Composio
export async function sendEmail(
  userId: string,
  to: string,
  subject: string,
  body: string
) {
  return composio.executeAction({
    actionName: 'GMAIL_SEND_EMAIL',
    userId,
    params: { to, subject, body },
  })
}

// Fetch emails
export async function fetchEmails(userId: string, maxResults = 100) {
  return composio.executeAction({
    actionName: 'GMAIL_FETCH_EMAILS',
    userId,
    params: { maxResults, includeSpamTrash: false },
  })
}
```

**Composio actions used at MVP:**
```
Gmail:  GMAIL_FETCH_EMAILS, GMAIL_SEND_EMAIL, GMAIL_GET_MESSAGE
Stripe: (Direct Stripe SDK — more reliable for financial data)
Notion: NOTION_GET_PAGE, NOTION_CREATE_PAGE, NOTION_UPDATE_PAGE,
        NOTION_QUERY_DATABASE
```

---

## 7. Background Jobs — Trigger.dev

```ts
// trigger/alert-scanner.ts
import { schedules } from '@trigger.dev/sdk/v3'
import { supabaseAdmin } from '../lib/supabase/admin'
import { evaluateAlerts } from '../lib/alerts/engine'

export const alertScanner = schedules.task({
  id: 'alert-scanner',
  cron: '*/15 * * * *',  // Every 15 minutes
  maxDuration: 300,        // 5 minute timeout
  run: async () => {
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id')
      .eq('status', 'active')

    // Process users in batches of 50
    const batches = chunk(users, 50)
    for (const batch of batches) {
      await Promise.allSettled(batch.map(u => evaluateAlerts(u.id)))
    }
  },
})

// trigger/daily-briefing.ts
export const dailyBriefing = schedules.task({
  id: 'daily-briefing',
  cron: '0 6 * * *',     // 6 AM UTC — then adjust per user timezone
  maxDuration: 600,
  run: async () => {
    // Fetch all active users with their timezone
    // Filter: user's local time should be between 7:00–7:15 AM
    // Generate and send briefing for matching users
  },
})

// trigger/gmail-sync.ts
export const gmailSync = task({
  id: 'gmail-sync',
  queue: { concurrencyLimit: 10 },  // Max 10 parallel Gmail syncs
  run: async (payload: { userId: string; fullSync: boolean }) => {
    // Pull emails → parse → embed → store → update client health
  },
})
```

---

## 8. Email — Resend + React Email

```tsx
// emails/DailyBriefing.tsx
import { Html, Head, Body, Container, Text, Section } from '@react-email/components'

interface BriefingEmailProps {
  businessName: string
  date: string
  mrr: number
  mrrDelta: number
  alerts: Alert[]
  priorities: string[]
  insight: string
}

export default function DailyBriefingEmail({
  businessName, date, mrr, mrrDelta, alerts, priorities, insight
}: BriefingEmailProps) {
  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: 'Georgia, serif', background: '#f5f2ec' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '40px 20px' }}>
          <Text style={{ fontSize: '11px', color: '#888', letterSpacing: '2px' }}>
            NEXOS · YOUR BUSINESS TODAY · {date}
          </Text>
          {/* Revenue section */}
          {/* Client pulse section */}
          {/* Priorities section */}
          {/* Insight section */}
          {/* Reply CTA */}
        </Container>
      </Body>
    </Html>
  )
}

// Sending:
import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)

await resend.emails.send({
  from: 'NexOS <nexos@nexos.ai>',
  to: user.email,
  subject: `Your Business Today — ${date}`,
  react: DailyBriefingEmail({ ...briefingData }),
})
```

---

## 9. Payments — Stripe

### Billing Architecture
```ts
// Products created in Stripe Dashboard:
// - NexOS Solo ($49/mo) → price_solo_monthly
// - NexOS Chief of Staff ($149/mo) → price_cos_monthly
// - NexOS Agency ($299/mo) → price_agency_monthly

// lib/stripe.ts
import Stripe from 'stripe'
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

// Create checkout session
export async function createCheckout(
  userId: string,
  priceId: string,
  email: string
) {
  return stripe.checkout.sessions.create({
    customer_email: email,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${APP_URL}/dashboard?upgraded=true`,
    cancel_url: `${APP_URL}/settings/billing`,
    metadata: { userId },
    subscription_data: {
      trial_period_days: 14,   // 14-day free trial
      metadata: { userId },
    },
  })
}
```

### Webhooks to handle:
```
checkout.session.completed      → provision subscription in DB
customer.subscription.updated   → update tier in DB
customer.subscription.deleted   → downgrade to free tier
invoice.payment_failed          → send alert email
invoice.payment_succeeded       → update billing status
```

---

## 10. Observability

### Sentry (Errors)
```ts
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs'
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,    // 10% of transactions
  environment: process.env.NODE_ENV,
})

// Capture errors with user context:
Sentry.setUser({ id: userId })
Sentry.captureException(error, { extra: { context } })
```

### PostHog (Product Analytics)
```ts
// Track these events:
posthog.capture('onboarding_completed', { integrations_connected: 3 })
posthog.capture('briefing_opened', { source: 'email' })
posthog.capture('alert_actioned', { alert_type: 'silent_client' })
posthog.capture('action_approved', { action_type: 'email_draft' })
posthog.capture('action_rejected', { action_type: 'email_draft' })
posthog.capture('chat_query', { intent: 'strategy', response_time_ms: 2400 })
posthog.capture('upgrade_clicked', { from_tier: 'free', to_tier: 'cos' })
```

---

## 11. Local Development Setup

```bash
# Clone and install
git clone https://github.com/yourname/nexos
cd nexos
npm install

# Copy env file
cp .env.example .env.local
# Fill in all env vars

# Start Supabase locally
npx supabase start
npx supabase db push    # Apply migrations

# Start Trigger.dev dev server
npx trigger dev

# Start Next.js
npm run dev

# App runs at http://localhost:3000
# Supabase Studio at http://localhost:54323
# Trigger.dev at http://localhost:3040
```

---

## 12. Deployment

### Vercel (Frontend + API)
```bash
npm i -g vercel
vercel --prod

# Environment variables: Set all .env vars in Vercel dashboard
# Edge Runtime: NOT used (need Node.js for Supabase + Anthropic SDK)
# Build command: next build
# Output: .next
```

### Supabase (Database)
```bash
# Push schema to production
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push

# Enable pgvector on production
# Dashboard → Database → Extensions → vector → Enable
```

### Trigger.dev (Background Jobs)
```bash
npx trigger deploy
# Jobs auto-register to Trigger cloud
```

---

## 13. Performance Targets

| Metric | Target | How |
|---|---|---|
| Dashboard load | < 1.5s | Server components, no waterfalls |
| Chat first token | < 1.5s | Streaming, Haiku for classification |
| RAG retrieval | < 800ms | HNSW index, limit to 8 chunks |
| Alert fire | < 15 min | 15-minute cron, batch processing |
| Briefing delivery | < 5 min window | Pre-generate at 5:55 AM, send at 6 AM |
| API routes | < 200ms (non-AI) | Edge-close DB, connection pooling |

---

## 14. Security Checklist

- [ ] All API routes validate Clerk session before processing
- [ ] Supabase RLS enabled on all tables — no table is accessible without auth
- [ ] OAuth tokens encrypted at rest (Supabase handles this)
- [ ] Stripe webhook signatures verified with `stripe.webhooks.constructEvent`
- [ ] Clerk webhook signatures verified with `svix`
- [ ] No secrets in client-side code (all `process.env.XYZ` without `NEXT_PUBLIC_`)
- [ ] Integration scopes are minimal (read-only by default, write only when needed)
- [ ] Rate limiting on chat endpoint (Upstash Redis + @upstash/ratelimit)
- [ ] Content Security Policy headers via next.config.ts
- [ ] Input sanitization on all user-submitted content before DB insert
