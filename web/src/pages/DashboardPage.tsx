import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router";
import { Zap, Search, LayoutGrid, Bot, FileText, Server, SearchSlash } from "lucide-react";
import { api } from "../api/client.ts";
import { usePolling } from "../hooks/usePolling.ts";
import { useHuntStream } from "../hooks/useHuntStream.ts";
import { useStatus } from "../context/StatusContext.tsx";
import { HuntBox } from "../components/shared/HuntBox.tsx";
import { StreamLog } from "../components/shared/StreamLog.tsx";
import { timeAgo, formatMs, latencyClass } from "../lib/utils.ts";
import type {
  PingResponse,
  ReportsResponse,
  ReportSummary,
  ReputationResponse,
  AutopilotStatus,
  ServiceHealth,
  ACPProtocolStatus,
} from "../api/types.ts";

interface SettlementStats {
  totalSettled: number;
  accuracy: number;
  avgPriceMovePct: number;
}

interface MemoryStats {
  totalEntries: number;
  verified: number;
  topPatterns: { pattern: string; accuracy: number }[];
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function Hero() {
  return (
    <div className="hero" style={{ padding: "5rem 2rem 4rem", position: "relative", overflow: "hidden" }}>
      {/* Decorative background dots */}
      <div style={{
        position: "absolute", inset: 0, opacity: 0.03,
        backgroundImage: "radial-gradient(circle, var(--text) 1px, transparent 1px)",
        backgroundSize: "24px 24px",
        pointerEvents: "none",
      }} />

      <div className="hero-label" style={{ marginBottom: "2.5rem" }}>
        <Zap size={14} />
        Hackathon Galactica: WDK Edition 1
      </div>

      <h1 style={{ fontSize: "3.5rem", lineHeight: 1.1, marginBottom: "2rem", letterSpacing: "-0.02em" }}>
        Agents That <span>Hold Wallets</span>,
        <br />
        Move Money, Settle <span style={{ color: "var(--green)" }}>On-Chain</span>
      </h1>

      <p style={{
        maxWidth: 620, margin: "0 auto 3.5rem", lineHeight: 1.8,
        fontSize: "1.05rem", color: "var(--text2)",
      }}>
        7 autonomous AI agents. Each with its own <strong style={{ color: "var(--text)" }}>Tether WDK wallet</strong>.
        They lend USDT, optimize yields, score credit, and tip creators —
        all without human intervention.
      </p>

      {/* Stats — spacious cards */}
      <div style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        gap: "1rem", marginBottom: "3rem",
        maxWidth: 800, marginLeft: "auto", marginRight: "auto",
      }}>
        {[
          { value: "6", label: "WDK Packages", color: "#00FF88" },
          { value: "7", label: "Agent Wallets", color: "#F7931A" },
          { value: "3", label: "Smart Contracts", color: "#00FF88" },
          { value: "4/4", label: "Tracks Covered", color: "#F7931A" },
        ].map((item) => (
          <div key={item.label} style={{
            background: "var(--bg2)", border: "2px solid var(--border)",
            padding: "1.75rem 1rem", textAlign: "center",
          }}>
            <div style={{
              fontSize: "2.25rem", fontWeight: 900, color: item.color,
              fontFamily: "var(--mono)", lineHeight: 1,
            }}>
              {item.value}
            </div>
            <div style={{
              fontSize: ".7rem", fontWeight: 700, color: "var(--text2)",
              textTransform: "uppercase", letterSpacing: ".08em", marginTop: ".75rem",
            }}>
              {item.label}
            </div>
          </div>
        ))}
      </div>

      {/* WDK packages — subtle row */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: ".4rem",
        justifyContent: "center", marginBottom: "3rem",
      }}>
        {[
          "@tetherto/wdk", "@tetherto/wdk-wallet-evm",
          "@tetherto/wdk-protocol-lending-aave-evm", "@tetherto/wdk-protocol-swap-velora-evm",
          "@tetherto/wdk-protocol-bridge-usdt0-evm", "@tetherto/wdk-mcp-toolkit",
        ].map((pkg) => (
          <span key={pkg} style={{
            fontSize: ".68rem", fontFamily: "var(--mono)",
            padding: ".3rem .65rem", color: "#00FF88",
            background: "var(--bg3)", border: "1px solid var(--border)",
          }}>
            {pkg}
          </span>
        ))}
      </div>

      <div className="hero-actions">
        <Link className="btn btn-primary" to="/hunt">
          <Search size={16} />
          Run Analysis
        </Link>
        <Link className="btn btn-secondary" to="/live">
          <Bot size={16} />
          View Agent Wallets
        </Link>
        <Link className="btn btn-secondary" to="/network">
          <LayoutGrid size={16} />
          Network Status
        </Link>
      </div>
    </div>
  );
}

interface StatsBarProps {
  ping: PingResponse | null;
  reports: ReportsResponse | null;
  reputation: ReputationResponse | null;
  health: { onlineCount: number } | null;
}

function StatsBar({ ping, reports, reputation, health }: StatsBarProps) {
  const agentCount = ping?.dynamicPricing
    ? ping.dynamicPricing.length + 1
    : health?.onlineCount ?? "\u2014";

  const avgRep =
    reputation?.agents && reputation.agents.length > 0
      ? (
          (reputation.agents.reduce((s, a) => s + a.score, 0) /
            reputation.agents.length) *
          100
        ).toFixed(0) + "%"
      : "\u2014";

  const totalPnl =
    reputation?.agents && reputation.agents.length > 0
      ? reputation.agents.reduce((s, a) => s + a.pnl, 0)
      : null;

  const pnlText =
    totalPnl !== null ? (totalPnl >= 0 ? "+" : "") + totalPnl.toFixed(1) : "\u2014";
  const pnlColor =
    totalPnl !== null
      ? totalPnl >= 0
        ? "var(--green)"
        : "var(--red)"
      : "var(--text2)";

  return (
    <div
      className="stats"
      style={{
        gridTemplateColumns: "repeat(7, 1fr)",
      }}
    >
      <div className="stat">
        <div className="stat-val">{agentCount}</div>
        <div className="stat-label">Active Agents</div>
      </div>
      <div className="stat">
        <div className="stat-val">{reports?.count ?? "\u2014"}</div>
        <div className="stat-label">Cached Reports</div>
      </div>
      <div className="stat">
        <div className="stat-val">{ping?.totalBuyCost ?? "$0.039"}</div>
        <div className="stat-label">Buy Cost</div>
      </div>
      <div className="stat">
        <div className="stat-val">$0.050</div>
        <div className="stat-label">Sell Price</div>
      </div>
      <div className="stat">
        <div className="stat-val" style={{ color: "var(--green)" }}>
          {ping?.margin ? ping.margin.replace(" per hunt", "") : "$0.011"}
        </div>
        <div className="stat-label">Margin / Hunt</div>
      </div>
      <div className="stat">
        <div className="stat-val" style={{ color: "var(--accent2)" }}>
          {avgRep}
        </div>
        <div className="stat-label">Avg Reputation</div>
      </div>
      <div className="stat">
        <div className="stat-val" style={{ color: pnlColor }}>
          {pnlText}
        </div>
        <div className="stat-label">Economy P&amp;L</div>
      </div>
    </div>
  );
}

function AutopilotCompact({ status }: { status: AutopilotStatus | null }) {
  const phase = status?.phase ?? "idle";
  const huntCount = status?.huntCount ?? 0;
  const nextTime = status?.nextHuntAt
    ? new Date(status.nextHuntAt).toLocaleTimeString("en", { hour12: false })
    : "\u2014";
  const interval = status ? formatMs(status.currentIntervalMs) : "5m 0s";

  return (
    <>
      <div className="section-title">
        <span className="sec-icon">
          <Bot size={18} stroke="var(--accent2)" />
        </span>
        Autopilot
        <Link to="/autopilot" style={{ fontSize: "13px", color: "var(--accent2)", textDecoration: "none", marginLeft: "0.5rem" }}>
          View full &rarr;
        </Link>
      </div>
      <div className="panel" style={{ marginBottom: "2rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <span className={`ap-phase ${phase}`}>{phase.toUpperCase()}</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: "13px", color: "var(--text2)" }}>
            {huntCount} hunts
          </span>
          <span style={{ fontFamily: "var(--mono)", fontSize: "13px", color: "var(--text3)" }}>
            Next: {nextTime}
          </span>
          <span style={{ fontFamily: "var(--mono)", fontSize: "13px", color: "var(--text3)" }}>
            Interval: {interval}
          </span>
        </div>
      </div>
    </>
  );
}

function RecentReports({ reports }: { reports: ReportSummary[] }) {
  return (
    <>
      <div className="section-title">
        <span className="sec-icon">
          <FileText size={18} stroke="var(--accent2)" />
        </span>
        Recent Reports
        <Link to="/reports" style={{ fontSize: "13px", color: "var(--accent2)", textDecoration: "none", marginLeft: "0.5rem" }}>
          View all &rarr;
        </Link>
      </div>
      <div style={{ marginBottom: "2rem" }}>
        {reports.length === 0 ? (
          <div style={{ color: "var(--text3)", fontSize: "14px", padding: "1.5rem", textAlign: "center" }}>
            No reports yet &mdash; run a hunt to generate one
          </div>
        ) : (
          reports.slice(0, 5).map((rep) => (
            <Link
              key={rep.id}
              to="/reports"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.75rem 1rem",
                borderBottom: "1px solid var(--border)",
                fontSize: "14px",
                cursor: "pointer",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <span style={{ color: "var(--text)", fontWeight: 500 }}>{rep.topic}</span>
              <span style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                <span style={{ fontFamily: "var(--mono)", fontSize: "13px", color: "var(--text3)" }}>
                  {timeAgo(rep.timestamp)}
                </span>
                <span className="report-price">{rep.price}</span>
              </span>
            </Link>
          ))
        )}
      </div>
    </>
  );
}

function ServicesGrid({ services }: { services: ServiceHealth[] }) {
  return (
    <>
      <div className="section-title">
        <span className="sec-icon">
          <Server size={18} stroke="var(--accent3)" />
        </span>
        Service Health
        <Link to="/network" style={{ fontSize: "13px", color: "var(--accent2)", textDecoration: "none", marginLeft: "0.5rem" }}>
          Details &rarr;
        </Link>
      </div>
      <div
        className="services-grid"
        style={{
          gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
          marginBottom: "2rem",
        }}
      >
        {services.map((s) => {
          const statusCls = s.status === "ok" ? "ok" : s.status === "error" ? "err" : "off";
          const latCls = latencyClass(s.latencyMs);
          return (
            <div
              className="service-card"
              key={s.name}
              style={{ minHeight: "72px", alignItems: "center" }}
            >
              <div className={`service-status status-${statusCls}`} />
              <div className="service-info">
                <div className="service-name" style={{ fontSize: "14px" }}>
                  {s.name.replace("", "")}
                </div>
                <div className="service-details" style={{ marginTop: "0.35rem" }}>
                  <span className="service-price" style={{ fontSize: "13px" }}>{s.price || "coordinator"}</span>
                  <span className={`service-latency ${latCls}`} style={{ fontSize: "13px" }}>{s.latencyMs}ms</span>
                  <span className="service-port" style={{ fontSize: "13px" }}>:{s.port}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function SystemPulse({ acp, settlement, memory }: { acp: ACPProtocolStatus | null; settlement: SettlementStats | null; memory: MemoryStats | null }) {
  const pulseCardStyle: React.CSSProperties = {
    padding: "1rem 1.25rem",
    display: "flex",
    flexDirection: "column",
    minHeight: "80px",
  };

  const pulseLabelStyle: React.CSSProperties = {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--accent2)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    marginBottom: "0.5rem",
  };

  const pulseDataStyle: React.CSSProperties = {
    display: "flex",
    gap: "1rem",
    fontSize: "14px",
    fontFamily: "var(--mono)",
    alignItems: "baseline",
  };

  const noDataStyle: React.CSSProperties = {
    color: "var(--text3)",
    fontSize: "14px",
  };

  return (
    <>
      <div className="section-title">
        <span className="sec-icon">
          <Zap size={18} stroke="var(--accent2)" />
        </span>
        System Pulse
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.75rem", marginBottom: "2rem" }}>
        <Link to="/acp" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="panel" style={pulseCardStyle}>
            <div style={pulseLabelStyle}>
              ACP Consensus
            </div>
            {acp ? (
              <div style={pulseDataStyle}>
                <span><strong>{acp.totalRounds}</strong> rounds</span>
                <span style={{ color: "var(--red)" }}>{acp.totalSlashes} slashes</span>
                <span style={{ color: "var(--green)" }}>{acp.totalRewards} rewards</span>
              </div>
            ) : (
              <span style={noDataStyle}>No data</span>
            )}
          </div>
        </Link>

        <Link to="/live" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="panel" style={pulseCardStyle}>
            <div style={pulseLabelStyle}>
              Settlement Oracle
            </div>
            {settlement ? (
              <div style={pulseDataStyle}>
                <span><strong>{settlement.totalSettled}</strong> settled</span>
                <span style={{ color: settlement.accuracy >= 50 ? "var(--green)" : "var(--red)" }}>{settlement.accuracy.toFixed(0)}% accuracy</span>
              </div>
            ) : (
              <span style={noDataStyle}>No settlements</span>
            )}
          </div>
        </Link>

        <Link to="/memory" style={{ textDecoration: "none", color: "inherit" }}>
          <div className="panel" style={pulseCardStyle}>
            <div style={pulseLabelStyle}>
              Agent Memory
            </div>
            {memory ? (
              <div style={pulseDataStyle}>
                <span><strong>{memory.totalEntries}</strong> entries</span>
                <span style={{ color: "var(--green)" }}>{memory.verified} verified</span>
                <span>{memory.topPatterns.length} patterns</span>
              </div>
            ) : (
              <span style={noDataStyle}>No entries</span>
            )}
          </div>
        </Link>
      </div>
    </>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function DashboardPage() {
  const health = useStatus();

  const reportsFetcher = useCallback(() => api<ReportsResponse>("/reports"), []);
  const reputationFetcher = useCallback(() => api<ReputationResponse>("/reputation"), []);
  const autopilotFetcher = useCallback(() => api<AutopilotStatus>("/autopilot/status"), []);
  const pingFetcher = useCallback(() => api<PingResponse>("/ping"), []);
  const acpFetcher = useCallback(() => api<ACPProtocolStatus>("/acp/status"), []);
  const settlementFetcher = useCallback(() => api<SettlementStats>("/settlement/stats"), []);
  const memoryFetcher = useCallback(() => api<MemoryStats>("/memory/stats"), []);

  const { data: reports } = usePolling(reportsFetcher, 10_000);
  const { data: reputation } = usePolling(reputationFetcher, 10_000);
  const { data: autopilot } = usePolling(autopilotFetcher, 10_000);
  const { data: ping } = usePolling(pingFetcher, 10_000);
  const { data: acp } = usePolling(acpFetcher, 15_000);
  const { data: settlement } = usePolling(settlementFetcher, 15_000);
  const { data: memory } = usePolling(memoryFetcher, 15_000);

  const { hunting, logs, alpha, startHunt } = useHuntStream();
  const [showStream, setShowStream] = useState(false);

  useEffect(() => {
    if (hunting || logs.length > 0) setShowStream(true);
  }, [hunting, logs.length]);

  const handleHunt = useCallback(
    (topic: string) => {
      setShowStream(true);
      startHunt(topic);
    },
    [startHunt],
  );

  const [prevHunting, setPrevHunting] = useState(false);
  useEffect(() => {
    if (prevHunting && !hunting) {
      const t = setTimeout(() => reportsFetcher().catch(() => {}), 500);
      return () => clearTimeout(t);
    }
    setPrevHunting(hunting);
  }, [hunting, prevHunting, reportsFetcher]);

  return (
    <>
      <Hero />

      <StatsBar ping={ping} reports={reports} reputation={reputation} health={health} />

      <div className="section-title">
        <span className="sec-icon">
          <SearchSlash size={18} stroke="var(--accent2)" />
        </span>
        Quick Hunt
      </div>

      <div style={{ marginBottom: "2rem" }}>
        <HuntBox
          onHunt={handleHunt}
          hunting={hunting}
          topics={["Trump impeachment", "Fed rate cut March", "Bitcoin ETF approval", "Ethereum DeFi", "Base L2 yields"]}
        />
      </div>

      {showStream && (
        <div style={{ marginTop: "-0.5rem", marginBottom: "2rem" }}>
          <StreamLog logs={logs} maxHeight="200px" />
          {alpha && (
            <div className="alpha-result" style={{ display: "block" }}>
              <div className="alpha-header">
                <div className="alpha-rec">{alpha.recommendation}</div>
                <div className="alpha-conf">Confidence: {alpha.confidence}</div>
              </div>
              <div className="alpha-signals">
                {alpha.signals.map((s) => (
                  <span key={s} className="signal-tag">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <AutopilotCompact status={autopilot} />

      <SystemPulse acp={acp} settlement={settlement} memory={memory} />

      <RecentReports reports={reports?.reports ?? []} />

      <ServicesGrid services={health?.services ?? []} />
    </>
  );
}
