---
name: galactica-agent
description: Hunt crypto alpha signals — sentiment, prediction markets, DeFi trends, news, whale movements. Autonomous agent network with WDK USDT payments on Arbitrum Sepolia.
---

# Galactica Agent Network — Alpha Hunter

You can query the Galactica Agent Network for synthesized crypto trading signals. The network consists of 6 specialized AI agents and 1 strategy-engine coordinator that pays them all via Tether WDK USDT and synthesizes the results using OpenClaw reasoning.

Base URL: `${GALACTICA_URL:-http://localhost:5000}`

## Full Alpha Hunt

When the user asks for alpha, trading signals, market analysis, or anything related to crypto market intelligence on a specific topic, run the full hunt:

```bash
curl -s -X POST "${GALACTICA_URL:-http://localhost:5000}/hunt" \
  -H "Content-Type: application/json" \
  -d "{\"topic\": \"REPLACE_WITH_USER_TOPIC\"}" | jq .
```

Replace `REPLACE_WITH_USER_TOPIC` with whatever the user asked about (e.g. "ethereum", "solana DeFi", "bitcoin halving").

**Interpreting the response (HTTP 200):**
- `.alpha.recommendation` — the main signal (STRONG BUY, MODERATE OPPORTUNITY, WATCH CLOSELY, or WAIT)
- `.alpha.confidence` — confidence percentage
- `.alpha.signals[]` — list of contributing signals
- `.alpha.breakdown.sentiment` — mood analysis (bullish/bearish/neutral)
- `.alpha.breakdown.polymarket` — prediction market data
- `.alpha.breakdown.defi` — DeFi momentum (HOT/WARM/COOL tokens)
- `.alpha.breakdown.news` — relevant headlines
- `.alpha.breakdown.whale` — on-chain whale movements
- `.agentPayments` — transparent payment ledger showing what the coordinator paid each sub-agent

**If HTTP 402:** The endpoint requires $0.05 USDT on Arbitrum Sepolia via WDK. Show the user the payment requirements from the response body. In demo mode (no WALLET_ADDRESS configured), endpoints work without payment.

Present results clearly: lead with the recommendation and confidence, then break down each signal source.

## Service Health Check

When the user asks if services are running, or before attempting other calls:

```bash
curl -s "${GALACTICA_URL:-http://localhost:5000}/health-all" | jq .
```

Shows status of all 7 agents. `.ok` is true if all are online. `.marketplaceStatus` is "FULLY OPERATIONAL" or "DEGRADED".

## Cached Reports

List previously generated alpha reports (free, no payment):

```bash
curl -s "${GALACTICA_URL:-http://localhost:5000}/reports" | jq .
```

Each report has an `.id` and `.preview`. To fetch a full cached report:

```bash
curl -s "${GALACTICA_URL:-http://localhost:5000}/report/REPORT_ID" | jq .
```

## Individual Data Agents

For more targeted queries, call individual services directly (all paid via WDK USDT):

**Engagement Monitor** ($0.001 USDT) — analyze text for bullish/bearish signals:
```bash
curl -s -X POST "http://localhost:4001/analyze" \
  -H "Content-Type: application/json" \
  -d "{\"text\": \"USER_TEXT_HERE\"}" | jq .
```

**Yield Scanner** ($0.02 USDT) — find mispriced prediction markets and yield opportunities:
```bash
curl -s -X POST "http://localhost:4002/scan" \
  -H "Content-Type: application/json" \
  -d "{\"filter\": \"OPTIONAL_FILTER\", \"limit\": 5}" | jq .
```

**DeFi Scanner** ($0.015 USDT) — scan for hot tokens and DeFi momentum:
```bash
curl -s -X POST "http://localhost:4003/scan" \
  -H "Content-Type: application/json" \
  -d "{\"asset\": \"OPTIONAL_ASSET\", \"limit\": 5}" | jq .
```

**Risk Monitor** ($0.001 USDT) — latest headlines and risk signals for a topic:
```bash
curl -s -X POST "http://localhost:4004/news" \
  -H "Content-Type: application/json" \
  -d "{\"topic\": \"TOPIC\", \"limit\": 5}" | jq .
```

**Credit Analyzer** ($0.002 USDT) — on-chain whale activity and credit scoring:
```bash
curl -s -X POST "http://localhost:4005/whale" \
  -H "Content-Type: application/json" \
  -d "{\"limit\": 10}" | jq .
```

## Network Economics

The strategy-engine coordinator buys data from 6 agents for $0.040 USDT total and sells synthesized reports at $0.05 USDT — a $0.010 margin per hunt. All payments use USDT on Arbitrum Sepolia via Tether WDK. This demonstrates autonomous agent-to-agent commerce powered by WDK wallet management.
