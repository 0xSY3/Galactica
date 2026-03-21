import { useState, useEffect, useCallback, useRef, type ReactNode } from "react";
import { Wallet, Activity, Clock, Shield, Copy, ExternalLink } from "lucide-react";
import { api } from "../api/client.ts";
import { usePolling } from "../hooks/usePolling.ts";
import { PageHeader } from "../components/shared/PageHeader.tsx";
import { timeAgo, shortAddr, shortHash } from "../lib/utils.ts";
import type {
  LiveConfig,
  TxFeedItem,
  SettlementStats,
  HuntPayingEvent,
  HuntResultEvent,
} from "../api/types.ts";

interface FlowServiceDef {
  key: string;
  label: string;
  price: string;
  port: string;
}

const FLOW_SERVICES: FlowServiceDef[] = [
  { key: "news-agent", label: "Risk Monitor", price: "$0.001", port: ":4004" },
  { key: "crypto-sentiment", label: "Engagement", price: "$0.001", port: ":4001" },
  { key: "polymarket-alpha-scanner", label: "Yield Scanner", price: "$0.020", port: ":4002" },
  { key: "defi-alpha-scanner", label: "DeFi Scanner", price: "$0.015", port: ":4003" },
  { key: "whale-agent", label: "Credit Analyzer", price: "$0.002", port: ":4005" },
];

interface PendingItem {
  huntId: string;
  topic: string;
  consensus: string;
  settled: boolean;
}

interface SettlementHistoryItem {
  huntId: string;
  topic: string;
  consensus: string;
  correct: boolean;
  priceMovePct: number;
  settledAt: string;
}

interface SettlementHistoryResponse {
  history: SettlementHistoryItem[];
}

function explorerTxLink(hash: string | undefined, explorer: string): ReactNode {
  if (!hash || hash.startsWith("0xdemo")) return <span style={{ color: "var(--text3)" }}>&mdash;</span>;
  return (
    <a className="explorer-link" href={`${explorer}/tx/${hash}`} target="_blank" rel="noopener noreferrer">
      {shortHash(hash)}
    </a>
  );
}

function explorerAddrLink(addr: string | undefined, explorer: string): ReactNode {
  if (!addr) return <span style={{ color: "var(--text3)" }}>&mdash;</span>;
  return (
    <a className="explorer-link" href={`${explorer}/address/${addr}`} target="_blank" rel="noopener noreferrer">
      {shortAddr(addr)}
    </a>
  );
}

async function copyAddr(text: string, setFlash: (id: string) => void, id: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
    setFlash(id);
  } catch { /* clipboard unavailable */ }
}

function statusBadge(status: string): ReactNode {
  const cls = status === "paid" ? "badge-green" : status === "demo" ? "badge-yellow" : "badge-red";
  const label = status === "paid" ? "LIVE" : status === "demo" ? "WDK" : status.toUpperCase();
  return (
    <span
      className={`badge ${cls}`}
      style={{ fontSize: ".65rem", padding: ".15rem .5rem", borderRadius: 0 }}
    >
      {label}
    </span>
  );
}

const SERVICE_NAME_MAP: Record<string, string> = {
  "news-agent": "risk-monitor",
  "crypto-sentiment": "engagement",
  "crypto-sentiment-v2": "engagement-v2",
  "polymarket-alpha-scanner": "yield-scanner",
  "defi-alpha-scanner": "defi-scanner",
  "whale-agent": "credit-analyzer",
  "galactica-strategy-engine": "strategy-engine",
};

function cleanServiceName(name: string): string {
  return SERVICE_NAME_MAP[name] ?? name.replace("", "").replace("-agent", "");
}

export function LivePage() {
  const [config, setConfig] = useState<LiveConfig | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [topic, setTopic] = useState("USDT lending yield");
  const [flashCopy, setFlashCopy] = useState<string | null>(null);
  const [activeServices, setActiveServices] = useState<Record<string, "paying" | "paid" | "demo">>({});
  const [liveTxItems, setLiveTxItems] = useState<TxFeedItem[]>([]);
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const cfg = await api<LiveConfig>("/live/config");
        if (!cancelled) setConfig(cfg);
      } catch { /* swallow */ }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const feedFetcher = useCallback(() => api<TxFeedItem[]>("/live/feed?limit=20"), []);
  const { data: feedData, refresh: refreshFeed } = usePolling(feedFetcher, 15_000);

  const statsFetcher = useCallback(() => api<SettlementStats>("/settlement/stats"), []);
  const { data: settlementStats } = usePolling(statsFetcher, 30_000);

  const pendingFetcher = useCallback(() => api<PendingItem[]>("/settlement/pending"), []);
  const { data: pendingItems } = usePolling(pendingFetcher, 30_000);

  const historyFetcher = useCallback(() => api<SettlementHistoryResponse>("/settlement/history?limit=20"), []);
  const { data: historyData } = usePolling(historyFetcher, 30_000);

  const explorer = config?.explorer ?? "https://sepolia.arbiscan.io";

  const allTxItems: TxFeedItem[] = liveTxItems.length > 0
    ? [...liveTxItems, ...(feedData ?? [])].slice(0, 30)
    : (feedData ?? []);

  useEffect(() => {
    if (!flashCopy) return;
    const t = setTimeout(() => setFlashCopy(null), 800);
    return () => clearTimeout(t);
  }, [flashCopy]);

  const closeStream = useCallback(() => {
    if (esRef.current) { esRef.current.close(); esRef.current = null; }
    setStreaming(false);
    setActiveServices({});
  }, []);

  const startLiveHunt = useCallback(() => {
    if (esRef.current) return;
    const encodedTopic = encodeURIComponent(topic || "USDT lending");
    const es = new EventSource(`/stream?topic=${encodedTopic}`);
    esRef.current = es;
    setStreaming(true);
    setLiveTxItems([]);
    setActiveServices({});

    es.addEventListener("paying", (e: MessageEvent) => {
      const d = JSON.parse(e.data) as HuntPayingEvent;
      setActiveServices((prev) => ({ ...prev, [d.service]: "paying" }));
    });

    es.addEventListener("result", (e: MessageEvent) => {
      const d = JSON.parse(e.data) as HuntResultEvent;
      const status = d.paid ? "paid" : "demo";
      setActiveServices((prev) => ({ ...prev, [d.service]: status }));
      setTimeout(() => {
        setActiveServices((prev) => {
          const next = { ...prev };
          if (next[d.service] === status) delete next[d.service];
          return next;
        });
      }, 3000);

      const tx: TxFeedItem = {
        timestamp: new Date().toISOString(),
        service: d.service,
        fromAddr: d.fromAddr,
        toAddr: d.toAddr,
        amount: d.paid ? (d.amount ?? "(paid)") : `$${d.amount ?? "0.001"}`,
        txHash: d.txHash,
        status: d.paid ? "paid" : "demo",
      };
      setLiveTxItems((prev) => [tx, ...prev].slice(0, 20));
    });

    es.addEventListener("done", () => { closeStream(); setTimeout(refreshFeed, 500); });
    es.onerror = () => { closeStream(); };
  }, [topic, refreshFeed, closeStream]);

  useEffect(() => {
    return () => { if (esRef.current) { esRef.current.close(); esRef.current = null; } };
  }, []);

  const agents = (config as Record<string, unknown>)?.agents as { key: string; address: string; demoMode: boolean }[] | undefined;
  const hunterAgent = agents?.find(a => a.key === "hunter");
  const wdkMode = (config as Record<string, unknown>)?.wdkMode as string | undefined;

  return (
    <>
      <PageHeader description="WDK USDT/XAUT agent wallets and on-chain payment transactions. All payments settled via Tether WDK.">
        <span>Agent</span> Wallets
      </PageHeader>

      {/* ── Agent Wallet Panel ──────────────────────────────────── */}
      <div className="section-title">
        <span className="sec-icon"><Wallet size={18} /></span>
        WDK Agent Wallets
        <span
          className={`badge ${wdkMode === "live" ? "badge-green" : "badge-yellow"}`}
          style={{ marginLeft: ".5rem", fontSize: ".65rem", borderRadius: 0 }}
        >
          {wdkMode === "live" ? "LIVE" : "DEMO"}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
          gap: "1rem",
          marginBottom: "2rem",
        }}
      >
        {agents ? agents.map((agent) => (
          <div
            className="wallet-panel"
            key={agent.key}
            style={{
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              minHeight: 140,
              borderRadius: 0,
            }}
          >
            <div
              className="wallet-panel-label"
              style={{ textTransform: "capitalize" }}
            >
              {cleanServiceName(agent.key)} Agent
            </div>

            <div className="wallet-addr-row">
              <code
                className="wallet-addr"
                style={{
                  fontFamily: "var(--mono)",
                  fontSize: ".82rem",
                  letterSpacing: ".03em",
                  color: flashCopy === agent.key ? "var(--green)" : "var(--accent2)",
                  transition: "color .3s",
                }}
              >
                {shortAddr(agent.address)}
              </code>
              <button
                className="copy-btn"
                title="Copy address"
                onClick={() => copyAddr(agent.address, setFlashCopy, agent.key)}
                style={{ borderRadius: 0 }}
              >
                <Copy size={14} />
              </button>
            </div>

            <div
              className="wallet-meta"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: ".75rem",
                marginTop: "auto",
              }}
            >
              <a
                className="explorer-link"
                href={`${explorer}/address/${agent.address}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: ".35rem",
                  fontFamily: "var(--mono)",
                  fontSize: ".72rem",
                  color: "var(--accent3)",
                  textDecoration: "none",
                }}
              >
                <ExternalLink size={12} /> Explorer
              </a>
              <span
                className={`badge ${agent.demoMode ? "badge-yellow" : "badge-green"}`}
                style={{
                  fontSize: ".65rem",
                  padding: ".15rem .5rem",
                  fontWeight: 700,
                  borderRadius: 0,
                }}
              >
                {agent.demoMode ? "DEMO" : "LIVE"}
              </span>
            </div>
          </div>
        )) : (
          <div className="wallet-panel" style={{ borderRadius: 0 }}>
            <div className="wallet-panel-label">Loading wallets...</div>
          </div>
        )}
      </div>

      {/* ── Contract Addresses ────────────────────────────────── */}
      <div
        className="panel"
        style={{
          marginBottom: "2rem",
          textAlign: "center",
          padding: "1rem 1.5rem",
          borderRadius: 0,
        }}
      >
        <span
          style={{
            fontSize: ".78rem",
            color: "var(--text3)",
            fontFamily: "var(--mono)",
            letterSpacing: ".02em",
            lineHeight: 1.8,
          }}
        >
          USDT:{" "}
          <span style={{ color: "var(--accent2)" }}>
            {(config as Record<string, unknown>)?.usdtContract as string ?? "loading..."}
          </span>
          <span style={{ margin: "0 .75rem", color: "var(--border2)" }}>|</span>
          Network:{" "}
          <span style={{ color: "var(--text2)" }}>
            {(config as Record<string, unknown>)?.network as string ?? "..."}
          </span>
        </span>
      </div>

      {/* ── Payment Flow Diagram ──────────────────────────────── */}
      <div className="section-title">
        <span className="sec-icon"><Activity size={18} /></span>
        WDK Payment Flow
      </div>
      <div className="panel" style={{ marginBottom: "2rem", borderRadius: 0 }}>
        <div
          className="flow-diagram"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "1.5rem",
            padding: "1.5rem 1rem",
            flexWrap: "wrap",
          }}
        >
          <div className="flow-node flow-client" style={{ borderRadius: 0 }}>
            <div className="flow-node-label">Client</div>
            <div className="flow-node-detail">&rarr; $0.050 USDT</div>
          </div>

          <div
            className={`flow-arrow${streaming ? " active" : ""}`}
            style={{ fontSize: "1.4rem" }}
          >
            &rarr;
          </div>

          <div className="flow-node flow-coordinator" style={{ borderRadius: 0 }}>
            <div className="flow-node-label">Strategy Engine</div>
            <div
              className="flow-node-addr"
              style={{ fontFamily: "var(--mono)", fontSize: ".68rem" }}
            >
              {hunterAgent ? shortAddr(hunterAgent.address) : "..."}
            </div>
            <div className="flow-node-detail">:5050</div>
          </div>

          <div
            className={`flow-arrow${streaming ? " active" : ""}`}
            style={{ fontSize: "1.4rem" }}
          >
            &rarr;
          </div>

          <div className="flow-services" style={{ gap: ".5rem" }}>
            {FLOW_SERVICES.map((svc) => {
              const state = activeServices[svc.key];
              const cls = [
                "flow-service",
                state === "paying" ? "flow-active" : "",
                state === "paid" ? "flow-paid" : "",
                state === "demo" ? "flow-demo" : "",
              ].filter(Boolean).join(" ");
              return (
                <div
                  className={cls}
                  data-service={svc.key}
                  key={svc.key}
                  style={{
                    padding: ".4rem .75rem",
                    gap: ".75rem",
                    borderRadius: 0,
                  }}
                >
                  <span style={{ minWidth: 100 }}>{svc.label}</span>
                  <span className="flow-svc-price">{svc.price} USDT</span>
                  <span className="flow-svc-port">{svc.port}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── WDK Transaction Feed ─────────────────────────────── */}
      <div className="section-title">
        <span className="sec-icon"><Clock size={18} /></span>
        WDK Transaction Feed
        {streaming && (
          <span className="live-badge"><span className="live-dot" /> STREAMING</span>
        )}
      </div>

      <div
        style={{
          display: "flex",
          gap: ".75rem",
          marginBottom: "1rem",
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >
        <input
          type="text"
          className="hunt-input"
          placeholder="Topic for live analysis..."
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !streaming) startLiveHunt(); }}
          style={{ maxWidth: 300, borderRadius: 0 }}
        />
        {!streaming ? (
          <button
            className="btn btn-primary btn-sm"
            onClick={startLiveHunt}
            style={{ borderRadius: 0 }}
          >
            Start Live Analysis
          </button>
        ) : (
          <button
            className="btn btn-secondary btn-sm"
            onClick={closeStream}
            style={{ borderRadius: 0 }}
          >
            Stop
          </button>
        )}
      </div>

      <div className="tx-feed" style={{ borderRadius: 0 }}>
        <div className="tx-header">
          <div className="tx-title">Recent USDT Payments</div>
          <span className="badge badge-purple" style={{ borderRadius: 0 }}>
            {allTxItems.length} txs
          </span>
        </div>
        <div>
          {allTxItems.length === 0 ? (
            <div className="tx-empty">No transactions yet. Start an analysis or wait for autopilot.</div>
          ) : (
            allTxItems.map((tx, i) => (
              <div
                className="tx-item tx-item-new"
                key={`${tx.txHash ?? tx.service}-${tx.timestamp}-${i}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "1rem",
                  padding: ".85rem 1.5rem",
                  fontFamily: "var(--mono)",
                  fontSize: ".75rem",
                }}
              >
                <span style={{ color: "var(--text3)", minWidth: 70, flexShrink: 0 }}>
                  {timeAgo(tx.timestamp)}
                </span>
                <span className="tx-dir">&rarr;</span>
                <span style={{ minWidth: 90, flexShrink: 0 }}>
                  {explorerAddrLink(tx.fromAddr, explorer)}
                </span>
                <span className="tx-dir">&rarr;</span>
                <span style={{ minWidth: 90, flexShrink: 0 }}>
                  {explorerAddrLink(tx.toAddr, explorer)}
                </span>
                <span style={{ color: "var(--text2)", minWidth: 100, flexShrink: 0 }}>
                  {cleanServiceName(tx.service)}
                </span>
                <span className="tx-amount" style={{ minWidth: 80, textAlign: "right" }}>
                  {tx.amount}
                </span>
                <span style={{ minWidth: 80, flexShrink: 0 }}>
                  {explorerTxLink(tx.txHash, explorer)}
                </span>
                {statusBadge(tx.status)}
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Settlement Oracle ──────────────────────────────────── */}
      <div className="section-title" style={{ marginTop: "2rem" }}>
        <span className="sec-icon"><Shield size={18} /></span>
        Settlement Oracle
      </div>
      <div className="panel" style={{ marginBottom: "2rem", borderRadius: 0 }}>
        <div className="stats" style={{ marginBottom: 0, borderRadius: 0 }}>
          <div className="stat">
            <div className="stat-val">{pendingItems?.length ?? "\u2014"}</div>
            <div className="stat-label">Pending</div>
          </div>
          <div className="stat">
            <div className="stat-val">
              {settlementStats && settlementStats.totalSettled > 0
                ? `${((settlementStats.correctCount / settlementStats.totalSettled) * 100).toFixed(0)}%`
                : "\u2014"}
            </div>
            <div className="stat-label">Accuracy</div>
          </div>
          <div className="stat">
            <div className="stat-val">{settlementStats?.totalSettled ?? "\u2014"}</div>
            <div className="stat-label">Settled</div>
          </div>
        </div>
      </div>

      {historyData?.history && historyData.history.length > 0 && (
        <div
          className="panel"
          style={{
            marginBottom: "2rem",
            maxHeight: 300,
            overflow: "auto",
            borderRadius: 0,
          }}
        >
          <div
            style={{
              fontSize: ".7rem",
              fontWeight: 600,
              color: "var(--text3)",
              textTransform: "uppercase",
              letterSpacing: ".04em",
              marginBottom: ".75rem",
              paddingBottom: ".5rem",
              borderBottom: "1px solid var(--border)",
            }}
          >
            Settlement History
          </div>
          {historyData.history.map((h, i) => (
            <div
              key={h.huntId}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "1rem",
                padding: ".5rem 0",
                borderBottom: i < historyData.history.length - 1 ? "1px solid var(--border)" : "none",
                fontSize: ".75rem",
                fontFamily: "var(--mono)",
              }}
            >
              <span style={{ fontSize: ".85rem", flexShrink: 0 }}>
                {h.correct ? "\u2705" : "\u274c"}
              </span>
              <span
                style={{
                  color: "var(--text)",
                  fontWeight: 600,
                  minWidth: 110,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {h.topic}
              </span>
              <span
                style={{
                  color: h.consensus === "bullish"
                    ? "var(--green)"
                    : h.consensus === "bearish"
                      ? "var(--red)"
                      : "var(--text3)",
                  minWidth: 70,
                  fontWeight: 600,
                }}
              >
                {h.consensus}
              </span>
              <span style={{ color: "var(--text2)", minWidth: 60 }}>
                {h.priceMovePct >= 0 ? "+" : ""}{h.priceMovePct.toFixed(2)}%
              </span>
              <span
                style={{
                  color: "var(--text3)",
                  fontSize: ".68rem",
                  marginLeft: "auto",
                  flexShrink: 0,
                }}
              >
                {new Date(h.settledAt).toLocaleTimeString("en", { hour12: false })}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
