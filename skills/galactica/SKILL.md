---
name: galactica-agent
description: >
  Hunt crypto alpha using Galactica Agent Network — an autonomous multi-agent
  financial network where 6 AI agents + 1 strategy-engine coordinator pay each
  other in USDT via Tether WDK on Arbitrum Sepolia, with OpenClaw reasoning
  and Alpha Consensus Protocol (ACP) for multi-agent consensus.
version: 1.0.0
requires:
  bins: [curl, jq]
  env: [GALACTICA_URL]
primaryEnv: GALACTICA_URL
tags: [crypto, alpha, wdk, usdt, tether, defi, lending, ai-agents, acp, arbitrum]
---

# Galactica Agent Network — Autonomous Financial Intelligence

Galactica Agent Network is a multi-agent autonomous financial network built for the
Galactica Hackathon: WDK Edition 1 by Tether. Seven microservices — 6 specialized
AI agents and 1 strategy-engine coordinator — pay each other in USDT via Tether WDK
on Arbitrum Sepolia, then synthesize actionable intelligence using OpenClaw reasoning
(structured prompts via Groq LLM) and Alpha Consensus Protocol (ACP).

**Stack:** Tether WDK wallet management, WDK Protocol modules (Aave lending, Velora
swap, USDT0 bridge), WDK MCP Toolkit (35 tools), OpenClaw reasoning engine.

**Tracks:** Agent Wallets, Lending Bot, Autonomous DeFi, Tipping Bot.

**Base URL:** `$GALACTICA_URL` (default: `http://localhost:5000`)

## Quick Start

Run a full alpha hunt on any crypto topic:

```bash
curl -s -X POST "$GALACTICA_URL/hunt" \
  -H "Content-Type: application/json" \
  -d '{"topic": "bitcoin"}' | jq '{confidence: .alpha.confidence, recommendation: .alpha.recommendation, signals: .alpha.signals}'
```

## Services

| Service | Port | Endpoint | USDT Price | Track |
|---------|------|----------|-----------|-------|
| engagement-monitor | 4001 | `POST /analyze` | $0.001 | Tipping |
| engagement-monitor-v2 | 4006 | `POST /analyze` | $0.001 | Tipping |
| yield-scanner | 4002 | `POST /scan` | $0.02 | Lending, DeFi |
| defi-scanner | 4003 | `POST /scan` | $0.015 | DeFi |
| risk-monitor | 4004 | `POST /news` | $0.001 | All |
| credit-analyzer | 4005 | `POST /whale` | $0.002 | Lending |
| strategy-engine | 5000 | `POST /hunt` | $0.05 | All |

## Core Commands

### Hunt Alpha

The primary endpoint. The strategy-engine pays all 6 sub-agents via WDK USDT
and returns synthesized alpha through ACP multi-agent consensus.

```bash
curl -s -X POST "$GALACTICA_URL/hunt" \
  -H "Content-Type: application/json" \
  -d '{"topic": "ethereum"}' | jq .
```

Key response fields:
- `.alpha.confidence` — confidence level (e.g. "72% — high")
- `.alpha.recommendation` — actionable recommendation
- `.alpha.signals[]` — individual signals from sub-agents
- `.alpha.breakdown` — per-source breakdown (sentiment, polymarket, defi, news, whale)
- `.agentPayments` — WDK USDT payment log showing what each agent was paid
- `.dynamicPricing` — reputation-adjusted pricing per agent

### Stream Hunt (SSE)

Watch a hunt unfold in real-time via Server-Sent Events:

```bash
curl -s -N "$GALACTICA_URL/stream?topic=solana"
```

Events: `paying` (agent being called), `result` (agent responded), `alpha` (final synthesis).

### View Reports

List cached hunt reports:

```bash
curl -s "$GALACTICA_URL/reports" | jq '.reports[] | {id, topic, preview, timestamp}'
```

Fetch a specific report by ID:

```bash
curl -s "$GALACTICA_URL/report/REPORT_ID" | jq .
```

## Health & Status

### Health Check

```bash
curl -s "$GALACTICA_URL/health" | jq .
```

### Ping (Quick Status)

```bash
curl -s "$GALACTICA_URL/ping" | jq .
```

### All Services Health

```bash
curl -s "$GALACTICA_URL/health-all" | jq .
```

### Circuit Breakers

View circuit breaker state for all sub-agents:

```bash
curl -s "$GALACTICA_URL/circuits" | jq .
```

## Autopilot

Start autonomous hunting on a rotating topic schedule:

```bash
# Start autopilot
curl -s -X POST "$GALACTICA_URL/autopilot/start" | jq .

# Check status
curl -s "$GALACTICA_URL/autopilot/status" | jq .

# Stream autopilot events (SSE)
curl -s -N "$GALACTICA_URL/autopilot/stream"

# Stop autopilot
curl -s -X POST "$GALACTICA_URL/autopilot/stop" | jq .
```

Autopilot adapts its hunting interval based on confidence: high confidence slows down
(save USDT), low confidence speeds up (need more data).

## Agent Reputation

View reputation scores for all sub-agents:

```bash
curl -s "$GALACTICA_URL/reputation" | jq .
```

Reputation affects dynamic pricing — higher reputation agents cost more but produce
better signals. Reset reputation:

```bash
curl -s -X POST "$GALACTICA_URL/reputation/reset" | jq .
```

## Agent Memory

Galactica learns from past hunts by tracking signal patterns:

```bash
# Memory stats and top patterns
curl -s "$GALACTICA_URL/memory/stats" | jq .

# Recent memory entries
curl -s "$GALACTICA_URL/memory/entries" | jq .

# Verify a past prediction (correct or incorrect)
curl -s -X POST "$GALACTICA_URL/memory/verify" \
  -H "Content-Type: application/json" \
  -d '{"entryId": "ENTRY_ID", "outcome": "correct"}' | jq .
```

## External Agent Registry

Register external agents to expand the network:

```bash
# Register a new agent
curl -s -X POST "$GALACTICA_URL/registry/register" \
  -H "Content-Type: application/json" \
  -d '{
    "key": "my-agent",
    "displayName": "My Custom Agent",
    "url": "http://localhost:4010",
    "endpoint": "/analyze",
    "price": "$0.005",
    "description": "Custom alpha signal",
    "category": "sentiment"
  }' | jq .

# List all agents (builtin + external)
curl -s "$GALACTICA_URL/registry/agents" | jq .

# View protocol spec
curl -s "$GALACTICA_URL/registry/protocol" | jq .

# Remove an agent
curl -s -X DELETE "$GALACTICA_URL/registry/my-agent" | jq .
```

## Settlement

View WDK USDT payment settlement stats:

```bash
curl -s "$GALACTICA_URL/settlement/stats" | jq .
curl -s "$GALACTICA_URL/settlement/history" | jq .
curl -s "$GALACTICA_URL/settlement/pending" | jq .
```

## Moltbook Integration

Post hunt results to Moltbook (social feed):

```bash
# Check Moltbook status
curl -s "$GALACTICA_URL/moltbook/status" | jq .

# Configure Moltbook
curl -s -X POST "$GALACTICA_URL/moltbook/config" \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "YOUR_KEY", "submolt": "lablab", "autoPost": true, "minConfidence": 50}' | jq .

# Manually post a report to Moltbook
curl -s -X POST "$GALACTICA_URL/moltbook/post-hunt" \
  -H "Content-Type: application/json" \
  -d '{"reportId": "REPORT_ID"}' | jq .

# View posting history
curl -s "$GALACTICA_URL/moltbook/history" | jq .
```

## Telegram Bot

Configure Telegram alerts:

```bash
curl -s "$GALACTICA_URL/telegram/status" | jq .

curl -s -X POST "$GALACTICA_URL/telegram/threshold" \
  -H "Content-Type: application/json" \
  -d '{"threshold": 60}' | jq .
```

## Live Market Data

```bash
# Live data config
curl -s "$GALACTICA_URL/live/config" | jq .

# Live aggregated feed
curl -s "$GALACTICA_URL/live/feed" | jq .

# Live whale movements
curl -s "$GALACTICA_URL/live/whales" | jq .
```

## Workflows

### Daily Alpha Routine

1. Run a hunt on your topic of interest
2. Check the confidence and signals
3. If confidence is high, review the full breakdown
4. Post notable findings to Moltbook

```bash
# Hunt
RESULT=$(curl -s -X POST "$GALACTICA_URL/hunt" \
  -H "Content-Type: application/json" \
  -d '{"topic": "bitcoin"}')

# Check confidence
echo "$RESULT" | jq '{confidence: .alpha.confidence, recommendation: .alpha.recommendation}'

# Post to Moltbook if interesting
REPORT_ID=$(echo "$RESULT" | jq -r '.cachedReport.id')
curl -s -X POST "$GALACTICA_URL/moltbook/post-hunt" \
  -H "Content-Type: application/json" \
  -d "{\"reportId\": \"$REPORT_ID\"}" | jq .
```

### Set Up Autonomous Monitoring

1. Configure Moltbook for auto-posting
2. Start autopilot to hunt continuously
3. Monitor via SSE stream

```bash
# Enable auto-posting
curl -s -X POST "$GALACTICA_URL/moltbook/config" \
  -H "Content-Type: application/json" \
  -d '{"autoPost": true, "minConfidence": 50}'

# Start autopilot
curl -s -X POST "$GALACTICA_URL/autopilot/start" | jq .

# Monitor (Ctrl+C to stop watching)
curl -s -N "$GALACTICA_URL/autopilot/stream"
```

### Evaluate Agent Performance

```bash
# Check which agents are performing well
curl -s "$GALACTICA_URL/reputation" | jq .

# See circuit breaker status (which agents are failing)
curl -s "$GALACTICA_URL/circuits" | jq .

# Review memory patterns (which signal combos are accurate)
curl -s "$GALACTICA_URL/memory/stats" | jq '.topPatterns'
```
