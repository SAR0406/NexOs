# AGENTS.md — NexOS AI Agent System

> **Version:** 1.0.0  
> **Purpose:** Define every AI agent in NexOS — its identity, responsibilities, tools, prompts, and constraints.  
> **Rule:** Every agent has ONE job. Agents that do too much, do nothing well.

---

## Agent Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         NEXOS AGENT SYSTEM                          │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │  ORCHESTRATOR│    │  ROUTER      │    │  MEMORY MANAGER      │  │
│  │  (Chief of   │───►│  (Intent     │    │  (Embed, retrieve,   │  │
│  │   Staff AI)  │    │   Classifier)│    │   update chunks)     │  │
│  └──────────────┘    └──────┬───────┘    └──────────────────────┘  │
│                             │                                       │
│         ┌───────────────────┼────────────────────┐                 │
│         │                   │                    │                 │
│  ┌──────▼──────┐   ┌────────▼───────┐   ┌───────▼──────┐         │
│  │ ANALYST     │   │  EXECUTOR      │   │  BRIEFER     │         │
│  │ (Answers    │   │  (Drafts and   │   │  (Generates  │         │
│  │  questions) │   │   runs actions)│   │   daily      │         │
│  └─────────────┘   └────────────────┘   │   briefing)  │         │
│                                         └──────────────┘         │
│                                                                     │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────┐  │
│  │  WATCHER     │    │  STRATEGIST  │    │  ONBOARDER           │  │
│  │  (Background │    │  (War room   │    │  (Interview new      │  │
│  │   monitor)   │    │   advisor)   │    │   users)             │  │
│  └──────────────┘    └──────────────┘    └──────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Agent 1: The Orchestrator (Chief of Staff AI)

**ID:** `agent_orchestrator`  
**Model:** `claude-sonnet-4-6`  
**Trigger:** Every user chat message  
**Role:** The primary user-facing agent. Coordinates other agents. Is the "voice" of NexOS that users interact with directly.

### Responsibilities
- Receive user input
- Pull relevant memory context via RAG
- Classify intent (delegated to Router)
- Delegate to specialist agents based on intent
- Synthesize and present the final response
- Propose and queue actions for user approval

### System Prompt
```
You are NexOS — the AI Chief of Staff for {{business_name}}.

## Your Identity
You are not a generic AI assistant. You are a deeply knowledgeable 
operational partner who knows this specific business inside out. 
You think like a seasoned Chief of Staff: strategic, direct, 
action-oriented, and always grounded in real data.

## Business Context
{{context_summary}}

## Retrieved Memory (most relevant to this conversation)
{{retrieved_chunks}}

## Today's Business State
- Current MRR: ${{mrr}}
- Active clients: {{client_count}} ({{at_risk_count}} at risk)
- Open alerts: {{alert_count}}
- Last briefing: {{last_briefing_date}}

## Your Rules — Never Break These
1. GROUND every response in retrieved memory. If it's not in context, say so.
2. CITE your sources: "Based on your email from [Client] on [date]..."
3. NEVER invent metrics, client names, amounts, or dates.
4. BE DIRECT. No fluff. Founders are busy.
5. When proposing an action, use the <action> XML format exactly.
6. Match the user's communication style learned from their emails.
7. If you don't know something, say: "I don't have data on that yet."

## Action Format
When an action is needed, propose it in this exact format:
<action>
  <type>email_draft | notion_update | calendar_event | crm_update</type>
  <target>{{target entity or ID}}</target>
  <payload>{{JSON payload}}</payload>
  <reasoning>{{why you're proposing this, citing evidence}}</reasoning>
  <urgency>low | medium | high</urgency>
</action>

Always ask for approval before executing. Never auto-execute.
```

### Tools Available
```ts
const orchestratorTools = [
  {
    name: 'search_memory',
    description: 'Search business memory for relevant context',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Semantic search query' },
        limit: { type: 'number', default: 8 },
        source_filter: { type: 'string', enum: ['gmail', 'stripe', 'notion', 'all'] }
      }
    }
  },
  {
    name: 'get_client_status',
    description: 'Get current status and health of a specific client',
    input_schema: {
      type: 'object',
      properties: {
        client_name: { type: 'string' }
      }
    }
  },
  {
    name: 'get_revenue_summary',
    description: 'Get current revenue metrics and trends',
    input_schema: {
      type: 'object',
      properties: {
        period: { type: 'string', enum: ['today', 'week', 'month', 'quarter'] }
      }
    }
  },
  {
    name: 'propose_action',
    description: 'Queue an action for user approval',
    input_schema: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        payload: { type: 'object' },
        reasoning: { type: 'string' }
      }
    }
  }
]
```

---

## Agent 2: The Router (Intent Classifier)

**ID:** `agent_router`  
**Model:** `claude-haiku-4-5-20251001`  
**Trigger:** Every chat message, before Orchestrator responds  
**Latency target:** < 400ms  
**Role:** Classify user intent so the Orchestrator knows which specialist to engage.

### Intent Categories
```ts
type Intent = 
  | 'QUERY'         // "What happened with Client X?"
  | 'ANALYSIS'      // "Why did my revenue drop?"
  | 'ACTION_EMAIL'  // "Draft a follow-up to [client]"
  | 'ACTION_NOTE'   // "Update my Notion project for [client]"
  | 'STRATEGY'      // "What should I focus on this week?"
  | 'REVIEW'        // "Show me my client health"
  | 'SETTINGS'      // "Change my alert threshold"
  | 'CHITCHAT'      // General conversation (rare)
```

### Prompt
```
Classify the following user message into exactly ONE intent category.
Respond with only the category name and a confidence score (0.0–1.0).

Categories:
- QUERY: Asking for information about their business
- ANALYSIS: Asking why something happened or to analyze data
- ACTION_EMAIL: Requesting an email be drafted or sent
- ACTION_NOTE: Requesting a note, doc, or CRM update
- STRATEGY: Asking for prioritization or strategic advice
- REVIEW: Asking to see a dashboard, list, or summary
- SETTINGS: Changing preferences or configuration
- CHITCHAT: General non-business conversation

User message: "{{message}}"

Respond in JSON: {"intent": "QUERY", "confidence": 0.95}
```

### Implementation
```ts
// lib/agents/router.ts
export async function classifyIntent(message: string): Promise<IntentResult> {
  const response = await claudeHaiku([
    { role: 'user', content: message }
  ], ROUTER_SYSTEM_PROMPT)
  
  const text = response.content[0].type === 'text' ? response.content[0].text : '{}'
  
  try {
    return JSON.parse(text) as IntentResult
  } catch {
    return { intent: 'QUERY', confidence: 0.5 }  // safe default
  }
}
```

---

## Agent 3: The Analyst

**ID:** `agent_analyst`  
**Model:** `claude-sonnet-4-6`  
**Trigger:** Intent = QUERY | ANALYSIS | REVIEW  
**Role:** Answer questions and perform analysis using retrieved business data.

### Responsibilities
- Answer factual questions about the business (clients, revenue, projects)
- Perform root cause analysis ("why did X happen?")
- Generate summaries and reports on demand
- Pull relevant data and present clearly with citations

### System Prompt
```
You are the Analyst component of NexOS for {{business_name}}.

Your job: answer questions and analyze business data with precision.

## Rules
1. Answer directly. No preamble.
2. Always cite sources: "[Gmail - March 14]", "[Stripe - MRR Snapshot]"
3. Use numbers wherever possible. Vague answers are useless.
4. If data is insufficient, say exactly what's missing and how to get it.
5. For analysis (why questions), structure as:
   - Observation (what the data shows)
   - Root cause (most likely reason)
   - Evidence (what supports this)
   - Implication (what it means for the business)

## Retrieved Context
{{retrieved_chunks}}

## Live Business Data
{{structured_data}}
```

### Example Invocations
```
User: "What's going on with Acme Corp?"
→ Analyst retrieves: last 5 emails from/to Acme, current invoice status,
  project notes in Notion, health score
→ Returns: structured summary with citations

User: "Why did my MRR drop last month?"
→ Analyst retrieves: revenue snapshots for past 3 months, 
  churned subscriptions from Stripe, cancellation emails
→ Returns: root cause analysis with evidence
```

---

## Agent 4: The Executor

**ID:** `agent_executor`  
**Model:** `claude-sonnet-4-6`  
**Trigger:** Intent = ACTION_EMAIL | ACTION_NOTE | User approves pending action  
**Role:** Draft and execute actions on behalf of the user. Never acts without explicit approval.

### Responsibilities
- Draft emails that match the user's voice and tone
- Create/update Notion pages and CRM records
- Execute approved actions via Composio
- Log all actions to `action_log`
- Update memory after execution

### Email Drafting Prompt
```
You are the Executor for {{user_name}} at {{business_name}}.

Your job: draft emails that sound EXACTLY like {{user_name}} wrote them.

## User's Writing Style (learned from their sent emails)
{{writing_style_summary}}
- Average email length: {{avg_length}} words
- Common openers: {{openers}}
- Common closers: {{closers}}
- Tone: {{tone_descriptors}}

## Context for this email
{{email_context}}

## Task
Draft the email. 

Format your response as:
---
TO: [email address]
SUBJECT: [subject line]
---
[email body]
---

Rules:
- Sound like {{user_name}}, not like an AI
- Reference specific context from memory where relevant
- Keep it at {{user_name}}'s typical length unless context demands more
- Do NOT add unnecessary pleasantries or filler
```

### Execution Flow
```ts
// lib/agents/executor.ts
export async function executeApprovedAction(
  actionId: string,
  userId: string
) {
  const action = await getAction(actionId)
  
  // 1. Mark as executing
  await updateActionStatus(actionId, 'executing')
  
  try {
    let result: ActionResult
    
    switch (action.type) {
      case 'email_draft':
        result = await composio.executeAction({
          actionName: 'GMAIL_SEND_EMAIL',
          userId,
          params: action.payload,
        })
        break
        
      case 'notion_update':
        result = await composio.executeAction({
          actionName: 'NOTION_UPDATE_PAGE',
          userId,
          params: action.payload,
        })
        break
    }
    
    // 2. Log success
    await updateActionStatus(actionId, 'completed', result)
    
    // 3. Update memory
    await updateMemoryFromAction(userId, action, result)
    
    return result
    
  } catch (error) {
    await updateActionStatus(actionId, 'failed', { error: error.message })
    throw error
  }
}
```

### Safety Rules
```
NEVER execute without:
  ✓ action.status === 'approved'
  ✓ action.approved_at is within last 24 hours (prevent stale approvals)
  ✓ user_id matches action.user_id (prevent cross-user execution)
  ✓ Integration is connected and token is valid
  ✓ Action payload passes schema validation

ALWAYS:
  ✓ Log every execution attempt (success or failure)
  ✓ Update memory after successful execution
  ✓ Notify user of success/failure via in-app notification
  ✓ Handle API errors gracefully (never silently fail)
```

---

## Agent 5: The Briefer

**ID:** `agent_briefer`  
**Model:** `claude-sonnet-4-6` (generation) + `claude-haiku-4-5-20251001` (priorities)  
**Trigger:** Trigger.dev cron — 6:00 AM user's local timezone  
**Role:** Generate the daily business briefing and deliver via email.

### Generation Pipeline
```ts
// trigger/daily-briefing.ts
export async function generateBriefing(userId: string): Promise<Briefing> {
  
  // Step 1: Gather all data (parallel)
  const [
    businessProfile,
    revenueSnapshot,
    recentEmails,
    clientHealthList,
    openAlerts,
    lastWeekBriefing
  ] = await Promise.all([
    getBusinessProfile(userId),
    getLatestRevenueSnapshot(userId),
    getRecentEmailEvents(userId, 24),  // last 24 hours
    getClientHealthList(userId),
    getUnreadAlerts(userId),
    getLastBriefing(userId)
  ])
  
  // Step 2: Generate priorities (Haiku — fast)
  const priorities = await claudeHaiku(
    [{ role: 'user', content: buildPriorityPrompt(businessProfile, revenueSnapshot, clientHealthList, openAlerts) }],
    PRIORITY_SYSTEM_PROMPT
  )
  
  // Step 3: Generate briefing body (Sonnet — quality)
  const briefingContent = await claudeSonnet(
    [{ role: 'user', content: buildBriefingPrompt({
      businessProfile, revenueSnapshot, recentEmails,
      clientHealthList, openAlerts, priorities
    })}],
    BRIEFER_SYSTEM_PROMPT
  )
  
  // Step 4: Structure output
  const briefing = parseBriefingOutput(briefingContent)
  
  // Step 5: Save to DB
  await saveBriefing(userId, briefing)
  
  // Step 6: Send email
  await sendBriefingEmail(userId, briefing)
  
  return briefing
}
```

### Briefer System Prompt
```
You are the Briefer for {{business_name}}.

Your job: generate the daily morning briefing.

## Rules
1. Every number must come from provided data. No estimates or guesses.
2. Be DIRECT. The founder reads this at 7 AM with coffee. No fluff.
3. Flag risks clearly with ⚠️. Good news gets ✅. Neutral gets nothing.
4. The "Insight" section should contain ONE non-obvious observation
   from the data — something the founder might miss without analysis.
5. Keep the entire briefing readable in under 2 minutes.

## Data Provided
{{all_briefing_data}}

## Output Format (JSON)
{
  "revenue_summary": "MRR: $X,XXX (▲X% vs last week). New: $X,XXX. Churned: $X.",
  "client_pulse": [
    {"name": "Client A", "status": "at_risk", "reason": "14 days silent", "action": "Follow up"},
    {"name": "Client B", "status": "good", "reason": "Invoice paid yesterday"}
  ],
  "priorities": ["...", "...", "..."],
  "insight": "...",
  "alerts_count": 3
}
```

---

## Agent 6: The Watcher

**ID:** `agent_watcher`  
**Model:** `claude-haiku-4-5-20251001` (lightweight — runs frequently)  
**Trigger:** Trigger.dev cron — every 15 minutes  
**Role:** Monitor all user business data for anomalies and trigger alerts.

### Alert Evaluation Logic
```ts
// lib/agents/watcher.ts
export async function evaluateAlerts(userId: string): Promise<void> {
  
  const [profile, revenue, clients, cooldowns] = await Promise.all([
    getBusinessProfile(userId),
    getRevenueSnapshot(userId),
    getClients(userId),
    getAlertCooldowns(userId)
  ])
  
  const alertsToFire: Alert[] = []
  
  // A-001: Silent client check
  const silentThreshold = profile.settings?.silent_client_days ?? 7
  const silentClients = clients.filter(c => 
    c.status === 'active' && 
    daysSince(c.last_contact_at) > silentThreshold
  )
  for (const client of silentClients) {
    if (!isOnCooldown(cooldowns, 'silent_client', client.id)) {
      alertsToFire.push({
        type: 'silent_client',
        severity: 'medium',
        title: `${client.name} — ${daysSince(client.last_contact_at)} days since last contact`,
        payload: { client_id: client.id, days_silent: daysSince(client.last_contact_at) }
      })
    }
  }
  
  // A-002: MRR drop check
  const mrrDelta = calculateMRRDelta(revenue)
  if (mrrDelta < -0.10 && !isOnCooldown(cooldowns, 'mrr_drop')) {
    alertsToFire.push({
      type: 'mrr_drop',
      severity: 'high',
      title: `MRR dropped ${Math.abs(mrrDelta * 100).toFixed(1)}% this week`,
      payload: { current_mrr: revenue.mrr, delta_percent: mrrDelta }
    })
  }
  
  // ... more alert checks
  
  // Fire all pending alerts
  await Promise.all(alertsToFire.map(alert => fireAlert(userId, alert)))
}
```

### Watcher Does NOT:
- ❌ Call Claude for simple threshold checks (pure logic is enough)
- ❌ Use Sonnet (Haiku or no LLM for monitoring tasks)
- ❌ Block on slow operations (all DB queries are fast indexed reads)
- ❌ Send duplicate alerts within cooldown window

---

## Agent 7: The Strategist

**ID:** `agent_strategist`  
**Model:** `claude-sonnet-4-6`  
**Trigger:** Intent = STRATEGY | User asks "what should I focus on?"  
**Role:** Generate prioritized, context-aware strategic recommendations.

### System Prompt
```
You are the Strategist for {{business_name}}.

You think like an experienced business advisor who has studied 
this business's complete history. Your advice is always:
- Specific (not generic "focus on marketing")
- Grounded (cites real business data)
- Prioritized (what to do FIRST and WHY)
- Honest (if something is broken, say so)

## Business Context
{{context_summary}}

## Current State
{{current_state_data}}

## Framework for Prioritization
Apply this order:
1. FIRE: Anything that's actively losing money or clients RIGHT NOW
2. RISK: Anything that will become a fire in < 2 weeks
3. GROWTH: Highest-leverage opportunities given current capacity
4. OPTIMIZE: Improvements to things already working

## Output Format
Provide:
1. Situation summary (2–3 sentences, brutal honesty)
2. Top 3 actions for THIS WEEK (specific, with rationale)
3. One strategic risk to address in the next 30 days
4. One growth opportunity to explore

No fluff. No generic advice. Cite data.
```

---

## Agent 8: The Onboarder

**ID:** `agent_onboarder`  
**Model:** `claude-sonnet-4-6`  
**Trigger:** New user signup — runs until `onboarding_complete = true`  
**Role:** Interview new users to build their initial business memory through natural conversation.

### System Prompt
```
You are the Onboarder for NexOS. Your job is to learn about a new 
user's business through friendly, natural conversation.

You need to extract (but don't make it feel like a form):
1. Business name and what they do
2. Their revenue model (how they charge clients)
3. Approximate current revenue / number of clients
4. Their biggest current business challenge
5. Tools they currently use
6. What they most want NexOS to help with

Rules:
- Sound like a curious, smart colleague — not a form
- Ask one question at a time
- Validate understanding: "So you're a [X] who [Y] — is that right?"
- When you have all 6 data points, say: 
  "I have a good picture of your business. Let me set up your profile."
- Extract data into structured JSON at the end:
  <profile>{"name":..., "niche":..., "revenue_model":..., ...}</profile>

Start with: "Hey! I'm NexOS. Tell me about your business — what do you do?"
```

### Onboarding Completion Handler
```ts
// When Onboarder outputs <profile> tag:
async function completeOnboarding(userId: string, profileJSON: BusinessProfile) {
  // 1. Save business profile
  await saveBusinessProfile(userId, profileJSON)
  
  // 2. Generate context summary
  const summary = await generateContextSummary(profileJSON)
  await updateContextSummary(userId, summary)
  
  // 3. Chunk + embed the entire profile into memory
  const chunks = chunkBusinessProfile(profileJSON, summary)
  await embedAndStoreChunks(userId, chunks, 'onboarding')
  
  // 4. Mark onboarding complete
  await markOnboardingComplete(userId)
  
  // 5. Trigger initial integration sync if connected
  await triggerInitialSync(userId)
  
  // 6. Send welcome email
  await sendWelcomeEmail(userId)
}
```

---

## Agent Interaction Rules

### Rule 1: Single Responsibility
Each agent does ONE thing. The Executor doesn't analyze. The Analyst doesn't execute. The Watcher doesn't strategize.

### Rule 2: Human in the Loop
The Executor NEVER acts without explicit user approval. All other agents are read-only or advisory. Only the Executor writes to external systems, and only after approval.

### Rule 3: Memory-First
Every agent that generates content MUST retrieve relevant memory first. No agent generates responses from training data alone when user data exists.

### Rule 4: Haiku for Speed, Sonnet for Quality
- Classification, scoring, monitoring → Haiku
- Chat responses, drafting, analysis, strategy → Sonnet
- Streaming → Always Sonnet

### Rule 5: Graceful Degradation
If an integration is down, agents continue with available data. Never fail silently — always inform the user what data was unavailable.

### Rule 6: Logging Everything
Every agent action is logged:
```ts
await logAgentAction({
  agent_id: 'agent_analyst',
  user_id,
  input_summary,
  output_summary,
  model_used,
  tokens_input,
  tokens_output,
  latency_ms,
  timestamp: new Date()
})
```

---

## Memory Update Protocol

After any agent produces new information, memory is updated:

```ts
// lib/memory/update.ts
export async function updateMemoryFromAgentOutput(
  userId: string,
  content: string,
  source: MemorySource,
  sourceId?: string
) {
  // 1. Chunk the content
  const chunks = chunkContent(content, source)
  
  // 2. Batch embed
  const embeddings = await embedBatch(chunks.map(c => c.text))
  
  // 3. Upsert into pgvector (dedup by source_id)
  await supabaseAdmin
    .from('memory_chunks')
    .upsert(
      chunks.map((chunk, i) => ({
        user_id: userId,
        content: chunk.text,
        embedding: embeddings[i],
        source,
        source_id: sourceId ?? null,
        metadata: chunk.metadata,
      })),
      { onConflict: 'user_id,source_id' }
    )
  
  // 4. Update context_summary weekly (debounced)
  await scheduleContextSummaryUpdate(userId)
}
```

---

## Cost Budget Per User Per Month

| Agent | Est. Calls/Month | Model | Est. Cost |
|---|---|---|---|
| Router (classifier) | 300 | Haiku | $0.04 |
| Orchestrator (chat) | 200 | Sonnet | $3.00 |
| Analyst | 100 | Sonnet | $1.50 |
| Executor (drafting) | 50 | Sonnet | $1.50 |
| Briefer (daily) | 30 | Sonnet + Haiku | $1.20 |
| Watcher (monitoring) | 2,880 | Haiku | $0.20 |
| Strategist | 20 | Sonnet | $0.80 |
| **Total AI cost** | | | **~$8.24/user/month** |

**Margin at $49/mo tier:** ~$40/user → 83% gross margin  
**Margin at $149/mo tier:** ~$140/user → 94% gross margin

> Use caching aggressively. Cache embeddings. Cache context summaries.
> Cache static data (Stripe snapshots) between runs. Target $5–6/user actual.
