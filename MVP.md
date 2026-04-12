# MVP.md — NexOS Minimum Viable Product Specification

> **Version:** 1.0.0  
> **Sprint Target:** 12 Weeks (3 Months)  
> **Goal:** Paying users. Real revenue. Validated core loop.  
> **Guiding Principle:** Ship the smallest version that makes someone say *"I can't run my business without this."*

---

## 🎯 MVP Definition

The MVP is NOT a demo. It is NOT a prototype.  
The MVP is a **fully production-ready, paying-customer-ready product** that executes one complete loop perfectly:

```
Business connects → NexOS learns → NexOS watches → NexOS alerts → User acts
```

Everything outside this loop is cut for v1.0.

---

## ✅ MVP Scope — What's IN

### Core Systems

#### System 1: Business Memory Engine
The foundational layer everything else depends on.

**What it does:**
- Runs the AI onboarding interview (15–20 questions) on signup
- Extracts and stores business profile: niche, clients, goals, pricing, tools, current challenges
- Syncs connected integrations and vectorizes all content into Supabase pgvector
- Maintains a `business_context` document that updates automatically as new data arrives
- Every AI query runs RAG (retrieval-augmented generation) against this memory

**What it produces:**
- `business_profile` table (structured fields)
- `memory_chunks` table (vector embeddings for semantic search)
- `context_summary` — a 500-word living description of the business, auto-updated weekly

**Acceptance Criteria:**
- [ ] New user completes onboarding in <10 minutes
- [ ] After onboarding, NexOS can answer "What does my business do?" with 90%+ accuracy
- [ ] Memory updates automatically when new emails/data arrive
- [ ] Semantic search returns relevant chunks in <800ms

---

#### System 2: Integration Layer (3 at Launch)
Only the three integrations that matter most for solopreneurs.

**Gmail (Read + Write)**
- OAuth 2.0 connection via Google API
- Pull: Last 90 days of emails on connect; then real-time via Gmail push notifications
- Parse: Extract client names, deal amounts, project names, sentiment signals
- Write: Send emails with explicit user approval (never autonomous send without approval)
- Store: `email_events` table with extracted entities

**Stripe (Read Only)**
- OAuth connection via Stripe Connect
- Pull: All charges, subscriptions, refunds, customers from the last 12 months
- Monitor: Real-time webhooks for new charges, failed payments, cancellations
- Compute: MRR, ARR, churn rate, new MRR, net MRR expansion — updated daily
- Store: `revenue_snapshots` table; `revenue_metrics` materialized view

**Notion (Read + Write)**
- OAuth via Notion API
- Pull: Workspace structure, pages, databases (with user-selected scope)
- Read: Client lists, project trackers, SOPs, meeting notes
- Write: Create/update pages with explicit user approval
- Store: `notion_pages` table with semantic embeddings

**Acceptance Criteria:**
- [ ] Gmail connects in <2 minutes via OAuth
- [ ] Stripe connects in <2 minutes via OAuth
- [ ] Notion connects in <3 minutes via OAuth
- [ ] All three integrations display live status on dashboard
- [ ] Disconnection and reconnection works cleanly
- [ ] Failed integration shows clear error + retry option

---

#### System 3: Daily Briefing Engine
The "daily newspaper" for your business — delivered every morning at 7 AM user local time.

**Content Structure:**
```
📊 Your Business Today — [Date]
━━━━━━━━━━━━━━━━━━━━━━━━
💰 Revenue
  MRR: $X,XXX (+X% vs last week)
  New revenue this week: $X,XXX
  Churn risk: X clients flagged

👥 Client Pulse
  ⚠️  [Client A] — 14 days since last contact
  ✅  [Client B] — Invoice paid yesterday
  🔴  [Client C] — Email sentiment declining

🎯 Today's Top 3 Priorities
  1. Follow up with [Client A] — at-risk
  2. Proposal due for [Prospect B] — 2 days
  3. Review [Project C] — milestone this week

💡 NexOS Insight
  [1-paragraph strategic insight based on business data]
━━━━━━━━━━━━━━━━━━━━━━━━
Reply to this email to talk to NexOS →
```

**Delivery:** Transactional email via Resend  
**Personalization:** Every briefing is 100% generated from that user's real data  
**Fallback:** If integrations have no new data, briefing still generates from memory

**Acceptance Criteria:**
- [ ] Briefing delivers at correct local time ±5 minutes
- [ ] All figures in briefing match actual source data (verified against Stripe)
- [ ] Client pulse accurately identifies silent clients (>X days threshold, user-configurable)
- [ ] Top 3 priorities are contextually relevant (not generic advice)
- [ ] Briefing renders correctly in Gmail, Outlook, Apple Mail

---

#### System 4: Alert Engine
Proactive, event-driven alerts that push to the user without being asked.

**Alert Types at MVP:**

| Alert ID | Trigger | Channel | Urgency |
|---|---|---|---|
| A-001 | Client silent for >7 days (configurable) | Email + In-app | 🟠 Medium |
| A-002 | MRR drops >10% week-over-week | Email + In-app | 🔴 High |
| A-003 | Stripe payment failed (client) | Email + In-app | 🔴 High |
| A-004 | New Stripe subscription cancelled | Email + In-app | 🔴 High |
| A-005 | Email from client with negative sentiment detected | In-app | 🟠 Medium |
| A-006 | Proposal/follow-up overdue (>48h no reply) | Email | 🟠 Medium |
| A-007 | Weekly business health score change (>15% swing) | Email | 🟡 Low |

**Architecture:**
- Trigger.dev background jobs run alert checks every 15 minutes
- Each alert has a cooldown period (no spam — same alert max once per 48h)
- Users can configure thresholds and mute specific alert types in settings

**Acceptance Criteria:**
- [ ] Alert fires within 15 minutes of trigger condition being met
- [ ] Alert never fires twice for the same event within cooldown window
- [ ] User can click alert → taken directly to relevant context in app
- [ ] Alert settings page allows threshold customization per alert type

---

#### System 5: NexOS Chat Interface
The conversational layer for on-demand intelligence and task approval.

**What it does:**
- Chat UI grounded entirely in the user's business memory (RAG)
- Every response cites the source ("Based on your email from [Client] on March 14...")
- Handles four intent types:
  1. **Query:** "What happened with Client X last week?"
  2. **Analysis:** "Why did my revenue drop in March?"
  3. **Action Request:** "Draft a follow-up email to Client Y"
  4. **Strategy:** "What should I focus on this week?"

**Action Approval Flow:**
```
NexOS suggests action → Shows draft/plan → User reviews → 
[Approve] → NexOS executes → Logs outcome → Updates memory
[Edit] → User modifies → Approve → Execute
[Reject] → Action cancelled → NexOS notes preference
```

**Acceptance Criteria:**
- [ ] Chat responses reference actual user data (not generic)
- [ ] Response latency <3 seconds for queries, <6 seconds for analysis
- [ ] Action drafts (emails) are editable before approval
- [ ] All executed actions are logged in `action_log` table
- [ ] User can see full history of NexOS actions taken on their behalf

---

#### System 6: Dashboard
The home base — a single-screen view of business health.

**Components:**
```
┌─────────────────────────────────────────────────────┐
│  NEXOS                           [Business Name]    │
├──────────┬──────────────────────────────────────────┤
│          │  Business Health Score: 74/100 ↑         │
│ SIDEBAR  │                                          │
│          │  ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ · Home   │  │  MRR     │ │ Clients  │ │ Pipeline │  │
│ · Chat   │  │  $X,XXX  │ │  12 / 2⚠ │ │  $XX,XXX │  │
│ · Alerts │  └──────────┘ └──────────┘ └──────────┘  │
│ · Memory │                                          │
│ · Tasks  │  Active Alerts (3)                       │
│ · Settings│  🔴 [Client A] silent 14 days — Follow up │
│           │  🟠 MRR down 8% — Review churn          │
│           │  🟡 Proposal to [X] needs reply         │
│           │                                          │
│           │  Pending Actions (2)                     │
│           │  ✉️  Draft ready: Follow-up to [Client A] │
│           │  📝 Note update: [Project B] summary     │
│           │                                          │
│           │  [Chat with NexOS →]                    │
└──────────┴──────────────────────────────────────────┘
```

**Acceptance Criteria:**
- [ ] Dashboard loads in <1.5 seconds
- [ ] Business Health Score updates daily (algorithm: weighted avg of MRR trend, client health, pipeline health)
- [ ] Clicking any alert shows detail + one-tap action options
- [ ] Pending actions visible and executable from dashboard

---

## ❌ MVP Scope — What's OUT

These are deliberately excluded to ship faster. Document them so you don't get distracted:

| Feature | Why Cut | When to Add |
|---|---|---|
| Mobile app | Web PWA is sufficient for MVP | Month 6+ |
| Voice briefing | Nice-to-have, complex | Month 5+ |
| HubSpot/Salesforce integration | Adds 3+ weeks | Month 4 |
| Playbook Marketplace | Needs user base first | Month 6+ |
| White-label | Agency tier but basic for now | Month 5+ |
| Team collaboration features | Solo-first | Month 4+ |
| Custom AI persona | Personalization sprint | Month 5+ |
| QuickBooks / Xero | Finance sprint | Month 5+ |
| Slack integration | Communications sprint | Month 4+ |

---

## 🗓️ 12-Week Build Sprint

### PHASE 1: Foundation (Weeks 1–3)
**Goal:** Working auth, database, memory engine, and 1 integration.

| Week | Deliverable |
|---|---|
| Week 1 | Project scaffold (Next.js + Supabase + Clerk), schema setup, basic auth flow |
| Week 2 | Onboarding interview UI, business profile storage, basic memory chunking |
| Week 3 | Gmail OAuth + sync pipeline, email parsing with Claude, memory integration |

**Exit Criteria:** User can sign up, complete onboarding, connect Gmail, and ask NexOS one question that uses their email data.

---

### PHASE 2: Core Intelligence (Weeks 4–7)
**Goal:** Daily briefing live, Stripe connected, alert engine running.

| Week | Deliverable |
|---|---|
| Week 4 | Stripe OAuth + revenue metrics pipeline, `revenue_snapshots` data layer |
| Week 5 | Alert engine (Trigger.dev jobs), 4 core alert types live, in-app notification center |
| Week 6 | Daily briefing pipeline (generation + Resend email delivery + scheduling) |
| Week 7 | Notion integration, RAG pipeline optimization, chat interface v1 |

**Exit Criteria:** User receives real daily briefing every morning. Three alert types fire correctly. Chat answers questions using real data.

---

### PHASE 3: Execution & Polish (Weeks 8–12)
**Goal:** Autonomous execution, dashboard, billing, and public launch-ready.

| Week | Deliverable |
|---|---|
| Week 8 | Action approval flow (email draft → approve → send), action log |
| Week 9 | Dashboard UI (health score, alerts, pending actions, metrics cards) |
| Week 10 | Stripe Billing integration, all 4 pricing tiers live, upgrade/downgrade flows |
| Week 11 | Bug bash, performance optimization, error handling, empty states |
| Week 12 | Soft launch to waitlist (50 users), feedback sprint, production hardening |

**Exit Criteria:** 10 paying users. All P0 features work without manual intervention. Zero critical bugs in 48-hour soak test.

---

## 🧪 Testing Requirements

| Test Type | Coverage Target | Tool |
|---|---|---|
| Unit tests (utilities, parsers) | 80%+ | Vitest |
| Integration tests (API routes) | Core paths 100% | Playwright |
| E2E tests | Happy path per feature | Playwright |
| Load test | 500 concurrent users | k6 |
| Security | OWASP Top 10 | Manual review |

---

## 🚀 Launch Checklist

### Pre-Launch (Week 11)
- [ ] Privacy Policy and Terms of Service pages live
- [ ] Data deletion request flow implemented
- [ ] All OAuth scopes documented and minimal (principle of least privilege)
- [ ] Stripe billing tested end-to-end (subscribe, upgrade, downgrade, cancel)
- [ ] Error monitoring live (Sentry)
- [ ] Uptime monitoring live (BetterUptime)
- [ ] Backup strategy documented and tested

### Launch Day (Week 12)
- [ ] ProductHunt submission scheduled (Tuesday 12:01 AM PT)
- [ ] Landing page live with waitlist-to-paid conversion funnel
- [ ] Onboarding email sequence live (Resend + 5-email sequence)
- [ ] Support channel live (Crisp or Intercom on free tier)
- [ ] Founding member pricing active ($49/mo lifetime for first 100)
- [ ] Analytics live (PostHog for product analytics)

### Post-Launch (Week 13+)
- [ ] Talk to every paying user within 48 hours of signup
- [ ] Ship one improvement per day based on user feedback
- [ ] Weekly revenue update posted publicly (build-in-public strategy)
