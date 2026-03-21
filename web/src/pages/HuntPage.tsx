import { useState, useEffect, useCallback } from "react";
import { api } from "../api/client.ts";
import { useHuntStream } from "../hooks/useHuntStream.ts";
import { PageHeader } from "../components/shared/PageHeader.tsx";
import { HuntBox } from "../components/shared/HuntBox.tsx";
import { StreamLog } from "../components/shared/StreamLog.tsx";
import { shortHash } from "../lib/utils.ts";
import { SERVICE_LABELS } from "../lib/constants.ts";
import type {
  PingResponse,
  DynamicPrice,
  HuntAlphaEvent,
  HuntStakingEvent,
  HuntCompetitionEvent,
  BreakdownSection,
  StakeResult,
  ACPConsensusResult,
  ACPSettlementResult,
  ACPAgentVote,
} from "../api/types.ts";

// ─── Sub-components ──────────────────────────────────────────────────────────

function PricingTable({ pricing, totalBuyCost }: { pricing: DynamicPrice[]; totalBuyCost: string }) {
  return (
    <div className="panel" style={{ marginBottom: "2rem" }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>Service</th>
            <th>Base Price</th>
            <th>Effective Price</th>
            <th>Multiplier</th>
            <th>Reputation</th>
          </tr>
        </thead>
        <tbody>
          {pricing.map((p) => (
            <tr key={p.service}>
              <td style={{ color: "var(--text)" }}>{SERVICE_LABELS[p.service] ?? p.service}</td>
              <td>{p.basePrice}</td>
              <td style={{ color: "var(--accent2)" }}>{p.effectivePrice}</td>
              <td>{p.multiplier.toFixed(2)}x</td>
              <td>{(p.reputation * 100).toFixed(0)}%</td>
            </tr>
          ))}
          <tr style={{ borderTop: "2px solid var(--border2)" }}>
            <td style={{ color: "var(--text)", fontWeight: 700 }}>Total</td>
            <td />
            <td style={{ color: "var(--green)", fontWeight: 700 }}>{totalBuyCost}</td>
            <td />
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function AlphaResult({ alpha }: { alpha: HuntAlphaEvent }) {
  return (
    <div className="alpha-result" style={{ display: "block", marginBottom: "2rem" }}>
      <div className="alpha-header">
        <div className="alpha-rec">{alpha.recommendation}</div>
        <div className="alpha-conf">
          Confidence: {alpha.confidence}
          {alpha.weightedConfidence != null && ` (weighted: ${alpha.weightedConfidence.toFixed(1)}%)`}
        </div>
      </div>
      <div className="alpha-signals">
        {alpha.signals.map((s) => (
          <span key={s} className="signal-tag">{s}</span>
        ))}
      </div>
      {alpha.narrative && (
        <div
          style={{
            marginTop: "1rem",
            padding: "1rem 1.2rem",
            background: "var(--bg3)",
            border: "1px solid var(--border)",
            borderLeft: "3px solid var(--accent2)",
            borderRadius: 0,
          }}
        >
          <div style={{ fontSize: ".7rem", fontWeight: 600, color: "var(--accent2)", textTransform: "uppercase", letterSpacing: ".04em", marginBottom: ".4rem" }}>
            AI Analysis
          </div>
          <div style={{ fontSize: ".85rem", color: "var(--text)", lineHeight: 1.6 }}>
            {alpha.narrative.summary}
          </div>
          {alpha.narrative.keyInsight && (
            <div style={{ marginTop: ".5rem", fontSize: ".8rem", color: "var(--text2)", fontStyle: "italic" }}>
              Key insight: {alpha.narrative.keyInsight}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function BreakdownPanel({ breakdown }: { breakdown: BreakdownSection }) {
  const hasContent =
    breakdown.news || breakdown.sentiment || breakdown.polymarket || breakdown.defi || breakdown.whale;
  if (!hasContent) return null;

  return (
    <div className="panel" style={{ marginBottom: "2rem" }}>
      <div className="section-title" style={{ marginBottom: "1rem" }}>Signal Breakdown</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: ".75rem" }}>
        {breakdown.news && (
          <div className="info-card" style={{ marginBottom: 0 }}>
            <div style={{ fontWeight: 600, fontSize: ".85rem", marginBottom: ".5rem", color: "var(--accent2)" }}>
              Risk Monitor
            </div>
            <div className="breakdown-item">
              <span className="breakdown-key">Top headline</span>
              <span className="breakdown-val">{breakdown.news.topHeadline}</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-key">Articles</span>
              <span className="breakdown-val">{breakdown.news.articleCount}</span>
            </div>
          </div>
        )}

        {breakdown.sentiment && (
          <div className="info-card" style={{ marginBottom: 0 }}>
            <div style={{ fontWeight: 600, fontSize: ".85rem", marginBottom: ".5rem", color: "var(--accent2)" }}>
              Engagement Monitor
            </div>
            <div className="breakdown-item">
              <span className="breakdown-key">Label</span>
              <span className="breakdown-val">{breakdown.sentiment.label}</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-key">Score</span>
              <span className="breakdown-val">{breakdown.sentiment.score}</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-key">Confidence</span>
              <span className="breakdown-val">{breakdown.sentiment.confidence}</span>
            </div>
          </div>
        )}

        {breakdown.polymarket && (
          <div className="info-card" style={{ marginBottom: 0 }}>
            <div style={{ fontWeight: 600, fontSize: ".85rem", marginBottom: ".5rem", color: "var(--accent2)" }}>
              Yield Scanner
            </div>
            <div className="breakdown-item">
              <span className="breakdown-key">Market</span>
              <span className="breakdown-val">{breakdown.polymarket.market}</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-key">Signal</span>
              <span className="breakdown-val">{breakdown.polymarket.signal}</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-key">YES price</span>
              <span className="breakdown-val">{breakdown.polymarket.yesPrice}</span>
            </div>
          </div>
        )}

        {breakdown.defi && (
          <div className="info-card" style={{ marginBottom: 0 }}>
            <div style={{ fontWeight: 600, fontSize: ".85rem", marginBottom: ".5rem", color: "var(--accent2)" }}>
              DeFi
            </div>
            <div className="breakdown-item">
              <span className="breakdown-key">Asset</span>
              <span className="breakdown-val">{breakdown.defi.asset}</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-key">Action</span>
              <span className="breakdown-val">{breakdown.defi.action}</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-key">24h change</span>
              <span className="breakdown-val">{breakdown.defi.change24h}</span>
            </div>
          </div>
        )}

        {breakdown.whale && (
          <div className="info-card" style={{ marginBottom: 0 }}>
            <div style={{ fontWeight: 600, fontSize: ".85rem", marginBottom: ".5rem", color: "var(--accent2)" }}>
              Credit Analyzer
            </div>
            <div className="breakdown-item">
              <span className="breakdown-key">Signal</span>
              <span className="breakdown-val">{breakdown.whale.signal}</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-key">Whale count</span>
              <span className="breakdown-val">{breakdown.whale.whaleCount}</span>
            </div>
            <div className="breakdown-item">
              <span className="breakdown-key">Total volume</span>
              <span className="breakdown-val">{breakdown.whale.totalVolume}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function StakingCard({ staking }: { staking: HuntStakingEvent }) {
  return (
    <div className="stake-card visible">
      <div className="stake-header">
        <span className="stake-title">Staking Results</span>
        <span className={`consensus-badge consensus-${staking.consensus}`}>
          {staking.consensus.toUpperCase()}
        </span>
      </div>
      {staking.results.map((r: StakeResult) => (
        <div className="stake-row" key={r.service}>
          <span className="stake-svc">{SERVICE_LABELS[r.service] ?? r.service}</span>
          <span className={`stake-dir ${r.direction}`}>{r.direction}</span>
          <span className="stake-num">{r.staked.toFixed(0)}</span>
          <span className={`stake-num ${r.correct ? "stake-correct" : "stake-incorrect"}`}>
            {r.correct ? "+" : ""}
            {(r.returned - r.staked).toFixed(1)}
          </span>
          <span className="stake-num">{(r.reputationAfter * 100).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );
}

function ACPCard({ consensus, settlement, votes }: { consensus: ACPConsensusResult; settlement?: ACPSettlementResult | null; votes?: ACPAgentVote[] | null }) {
  const dirColor = consensus.direction === "bullish" ? "var(--green)" : consensus.direction === "bearish" ? "var(--red)" : "var(--text3)";
  const totalWeight = Object.values(consensus.weightBreakdown).reduce((s, v) => s + v, 0) || 1;
  return (
    <div className="panel" style={{ marginBottom: "2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
        <div style={{ fontWeight: 700, fontSize: ".85rem", color: "var(--text)" }}>
          ACP Consensus
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: ".5rem" }}>
          <span style={{ color: dirColor, fontWeight: 700, fontSize: ".85rem", textTransform: "uppercase" }}>
            {consensus.direction}
          </span>
          {consensus.unanimity && (
            <span style={{ fontSize: ".65rem", background: "var(--green)", color: "#000", borderRadius: 0, padding: "1px 5px", fontWeight: 600 }}>
              UNANIMOUS
            </span>
          )}
        </div>
      </div>

      {/* Strength bar */}
      <div style={{ marginBottom: "1rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: ".65rem", color: "var(--text3)", marginBottom: 4 }}>
          <span>Consensus Strength</span>
          <span style={{ fontFamily: "var(--mono)" }}>{(consensus.strength * 100).toFixed(0)}%</span>
        </div>
        <div style={{ background: "var(--bg3)", borderRadius: 0, height: 8, overflow: "hidden" }}>
          <div style={{
            width: `${consensus.strength * 100}%`,
            height: "100%",
            background: consensus.strength > 0.7 ? "var(--green)" : consensus.strength > 0.4 ? "var(--yellow, #eab308)" : "var(--red)",
            borderRadius: 0,
            transition: "width .5s ease",
          }} />
        </div>
      </div>

      {/* Weight breakdown */}
      <div style={{ display: "flex", gap: 0, overflow: "hidden", borderRadius: 0, marginBottom: votes ? "1rem" : 0, height: 28 }}>
        {Object.entries(consensus.weightBreakdown).sort((a, b) => b[1] - a[1]).map(([dir, weight]) => (
          <div key={dir} style={{
            flex: `${weight / totalWeight}`,
            minWidth: 0,
            background: dir === "bullish" ? "var(--green)" : dir === "bearish" ? "var(--red)" : "var(--text3)",
            borderRadius: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: ".65rem",
            fontWeight: 700,
            color: "#000",
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}>
            {dir} {((weight / totalWeight) * 100).toFixed(0)}%
          </div>
        ))}
      </div>

      {/* Votes grid */}
      {votes && votes.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))", gap: ".5rem", marginBottom: settlement ? "1rem" : 0 }}>
          {votes.map((v) => (
            <div key={v.key} style={{
              background: "var(--bg3)",
              border: `1px solid ${v.agreedWithConsensus ? "var(--green)" : "var(--red)"}`,
              borderRadius: 0,
              padding: ".4rem .6rem",
              fontSize: ".65rem",
              fontFamily: "var(--mono)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".15rem" }}>
                <span style={{ fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{SERVICE_LABELS[v.key] ?? v.key}</span>
                <span style={{ color: v.direction === "bullish" ? "var(--green)" : v.direction === "bearish" ? "var(--red)" : "var(--text3)", fontWeight: 600, flexShrink: 0, marginLeft: ".4rem" }}>{v.direction}</span>
              </div>
              <div style={{ color: "var(--text3)" }}>w: {v.weight.toFixed(1)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Settlement */}
      {settlement && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(100px, auto))",
          gap: ".75rem",
          fontSize: ".7rem",
          fontFamily: "var(--mono)",
          color: "var(--text3)",
          padding: ".5rem 0 0",
          borderTop: "1px solid var(--border)",
        }}>
          <span>Staked: {settlement.totalStaked.toFixed(0)}</span>
          <span>Returned: {settlement.totalReturned.toFixed(0)}</span>
          <span style={{ color: settlement.netPnl >= 0 ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
            Net: {settlement.netPnl >= 0 ? "+" : ""}{settlement.netPnl.toFixed(1)}
          </span>
          {settlement.slashedAgents.length > 0 && (
            <span style={{ color: "var(--red)" }}>Slashed: {settlement.slashedAgents.join(", ")}</span>
          )}
        </div>
      )}
    </div>
  );
}

function CompetitionCard({ competition }: { competition: HuntCompetitionEvent }) {
  const v1IsWinner = competition.winner === "sentiment";
  return (
    <div className="comp-card visible">
      <div className="comp-header">Sentiment Agent Competition</div>
      <div className="comp-matchup">
        <div className={`comp-agent ${v1IsWinner ? "winner" : "loser"}`}>
          <div className="comp-agent-name">Sentiment v1</div>
          <div className="comp-agent-ratio">
            {v1IsWinner ? competition.winnerRatio : competition.loserRatio}
          </div>
        </div>
        <div className="comp-vs">VS</div>
        <div className={`comp-agent ${v1IsWinner ? "loser" : "winner"}`}>
          <div className="comp-agent-name">Sentiment v2</div>
          <div className="comp-agent-ratio">
            {v1IsWinner ? competition.loserRatio : competition.winnerRatio}
          </div>
        </div>
      </div>
      <div className="comp-reason">{competition.reason}</div>
    </div>
  );
}

interface TxEntry {
  service: string;
  txHash?: string;
  amount: string;
}

function PaymentLog({ txLog }: { txLog: TxEntry[] }) {
  if (txLog.length === 0) return null;
  return (
    <div className="tx-feed" style={{ display: "block" }}>
      <div className="tx-header">
        <span className="tx-title">WDK USDT Payment Log</span>
        <span className="badge badge-green" style={{ fontSize: ".7rem" }}>
          <span className="dot" /> Tether WDK
        </span>
      </div>
      {txLog.map((tx, i) => (
        <div className="tx-item" key={i}>
          <span className="tx-dir">OUT</span>
          <span className="tx-addr">{SERVICE_LABELS[tx.service] ?? tx.service}</span>
          <span className="tx-hash">{shortHash(tx.txHash)}</span>
          <span className="tx-amount">{tx.amount || "USDT"}</span>
        </div>
      ))}
    </div>
  );
}

interface ContractAction {
  action: string;
  success: boolean;
  demoMode: boolean;
}

function WDKActionsPanel({ actions }: { actions: ContractAction[] }) {
  if (actions.length === 0) return null;
  return (
    <div className="panel" style={{ marginBottom: "2rem" }}>
      <div style={{ fontWeight: 700, fontSize: ".85rem", color: "var(--accent2)", marginBottom: ".75rem" }}>
        WDK On-Chain Actions
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: ".4rem" }}>
        {actions.map((a, i) => (
          <div key={i} style={{
            display: "grid",
            gridTemplateColumns: "40px 1fr auto",
            alignItems: "center",
            gap: ".75rem",
            padding: ".5rem .75rem",
            background: "var(--bg3)",
            borderRadius: 0,
            borderLeft: `3px solid ${a.success ? "var(--green)" : "var(--red)"}`,
            fontSize: ".78rem",
            fontFamily: "var(--mono)",
          }}>
            <span style={{ color: a.success ? "var(--green)" : "var(--red)", fontWeight: 700 }}>
              {a.success ? "OK" : "FAIL"}
            </span>
            <span style={{ color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.action}</span>
            <span className={`badge ${a.demoMode ? "badge-yellow" : "badge-green"}`} style={{ fontSize: ".6rem", padding: ".1rem .4rem" }}>
              {a.demoMode ? "DEMO" : "LIVE"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function HuntPage() {
  // SSE hunt stream
  const { hunting, logs, alpha, breakdown, staking, competition, acpConsensus, acpSettlement, acpVotes, txLog, startHunt } =
    useHuntStream();

  // Dynamic pricing (loaded once on mount)
  const [pricing, setPricing] = useState<DynamicPrice[]>([]);
  const [totalBuyCost, setTotalBuyCost] = useState("$0.039");
  const [contractActions, setContractActions] = useState<ContractAction[]>([]);

  useEffect(() => {
    api<PingResponse>("/ping")
      .then((d) => {
        setPricing(d.dynamicPricing ?? []);
        setTotalBuyCost(d.totalBuyCost);
      })
      .catch(() => {});
  }, []);

  // Track whether we ever started hunting for showing sections
  const [hasHunted, setHasHunted] = useState(false);
  useEffect(() => {
    if (hunting) setHasHunted(true);
  }, [hunting]);

  const handleHunt = useCallback(
    (topic: string) => {
      setContractActions([]);
      startHunt(topic);
      // Also fire a POST to get contractActions (SSE stream doesn't include them)
      fetch("/hunt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic }),
      })
        .then(r => r.json())
        .then(d => {
          if (d.contractActions) setContractActions(d.contractActions);
        })
        .catch(() => {});
    },
    [startHunt],
  );

  return (
    <>
      <PageHeader description="Query 6 AI agents simultaneously. WDK executes USDT/XAUT transfers, Aave deposits, Velora swaps, and USDT0 bridges on-chain.">
        <span>Analyze</span> &amp; Execute
      </PageHeader>

      {/* Hunt Form */}
      <HuntBox onHunt={handleHunt} hunting={hunting} />

      {/* Live Stream */}
      <div className="section-title">Live Stream</div>
      {hasHunted ? (
        <div style={{ marginBottom: "2rem" }}>
          <StreamLog logs={logs} maxHeight="500px" />
        </div>
      ) : (
        <div
          style={{
            color: "var(--text3)",
            fontSize: ".85rem",
            padding: "2rem",
            textAlign: "center",
            background: "var(--bg2)",
            border: "1px solid var(--border)",
            borderRadius: 0,
            marginBottom: "2rem",
          }}
        >
          Run a hunt to see the live event stream
        </div>
      )}

      {/* Alpha Result */}
      {alpha && <AlphaResult alpha={alpha} />}

      {/* WDK On-Chain Actions */}
      <WDKActionsPanel actions={contractActions} />

      {/* Signal Breakdown */}
      {breakdown && <BreakdownPanel breakdown={breakdown} />}

      {/* Staking Results */}
      {staking && <StakingCard staking={staking} />}

      {/* ACP Consensus */}
      {acpConsensus && <ACPCard consensus={acpConsensus} settlement={acpSettlement} votes={acpVotes} />}

      {/* Competition */}
      {competition && <CompetitionCard competition={competition} />}

      {/* Payment Log */}
      <PaymentLog txLog={txLog} />

      {/* Dynamic Pricing */}
      <div className="section-title">Dynamic Pricing</div>
      {pricing.length > 0 ? (
        <PricingTable pricing={pricing} totalBuyCost={totalBuyCost} />
      ) : (
        <div className="panel" style={{ marginBottom: "2rem" }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Service</th>
                <th>Base Price</th>
                <th>Effective Price</th>
                <th>Multiplier</th>
                <th>Reputation</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--text3)" }}>
                  Loading pricing...
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
