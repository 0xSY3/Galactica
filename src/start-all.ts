import { spawn, type ChildProcess } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createServer } from "net";
import { randomBytes } from "crypto";
import { SERVICE_DEFS } from "./config/services.js";
import { config } from "./config/env.js";

// Generate a shared internal secret for all child processes (paywall bypass auth)
if (!process.env["INTERNAL_SECRET"]) {
  process.env["INTERNAL_SECRET"] = randomBytes(32).toString("hex");
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");
const tsx = join(projectRoot, "node_modules", ".bin", "tsx");

// ─── Config ──────────────────────────────────────────────────────────────────

const MAX_RESTARTS = 5;
const RESTART_BACKOFF_BASE = 1000;   // 1s → 2s → 4s → 8s → 16s
const HEALTH_TIMEOUT = 15_000;       // max wait for service health
const HEALTH_POLL = 300;             // poll interval
const STAGGER_DELAY = 200;           // ms between service launches
const FORCE_KILL_TIMEOUT = 5000;

// Sub-services start first, coordinator last (depends on them)
const subServices = ["sentiment", "sentiment2", "polymarket", "defi", "news", "whale"] as const;
const coordinatorKey = "hunter";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ts(): string {
  return new Date().toISOString().slice(11, 23);
}

function log(msg: string): void {
  console.log(`  ${ts()}  ${msg}`);
}

function logErr(msg: string): void {
  console.error(`  ${ts()}  ${msg}`);
}

/** Check if a port is free. Resolves true if free, false if in use. */
function isPortFree(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const srv = createServer();
    srv.once("error", () => resolve(false));
    srv.listen(port, "0.0.0.0", () => {
      srv.close(() => resolve(true));
    });
  });
}

/** Poll GET /health on a port until 200 or timeout. */
function waitForHealth(port: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve) => {
    function poll() {
      if (Date.now() > deadline) return resolve(false);
      fetch(`http://127.0.0.1:${port}/health`)
        .then((r) => (r.ok ? resolve(true) : schedule()))
        .catch(schedule);
    }
    function schedule() {
      setTimeout(poll, HEALTH_POLL);
    }
    poll();
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Managed Process ─────────────────────────────────────────────────────────

interface ManagedService {
  key: string;
  port: number;
  entryFile: string;
  child: ChildProcess | null;
  restarts: number;
  stopping: boolean;
}

const managed: ManagedService[] = [];
let shuttingDown = false;

function spawnService(svc: ManagedService): void {
  const child = spawn(tsx, [join(projectRoot, svc.entryFile)], {
    stdio: "inherit",
    env: process.env,
  });
  svc.child = child;

  child.on("error", (err) => {
    logErr(`[${svc.key}] spawn error: ${err.message}`);
  });

  child.on("exit", (code, signal) => {
    svc.child = null;

    if (shuttingDown || svc.stopping) return;

    if (code !== 0 && code !== null) {
      logErr(`[${svc.key}] exited with code ${code} (signal: ${signal ?? "none"})`);

      if (svc.restarts < MAX_RESTARTS) {
        const delay = RESTART_BACKOFF_BASE * Math.pow(2, svc.restarts);
        svc.restarts++;
        log(`[${svc.key}] restarting in ${delay}ms (attempt ${svc.restarts}/${MAX_RESTARTS})`);
        setTimeout(() => {
          if (!shuttingDown) {
            spawnService(svc);
          }
        }, delay);
      } else {
        logErr(`[${svc.key}] exceeded max restarts (${MAX_RESTARTS}) — giving up`);
      }
    }
  });
}

// ─── Port Preflight ──────────────────────────────────────────────────────────

async function checkPorts(): Promise<boolean> {
  const allKeys = [...subServices, coordinatorKey];
  const results = await Promise.all(
    allKeys.map(async (key) => {
      const def = SERVICE_DEFS[key]!;
      const free = await isPortFree(def.port);
      if (!free) logErr(`port ${def.port} (${key}) is already in use`);
      return free;
    })
  );
  return results.every(Boolean);
}

// ─── Startup Sequence ────────────────────────────────────────────────────────

async function startAll(): Promise<void> {
  console.log("\n  ⚡  Galactica Agent Network — starting all services\n");

  // 1. Preflight port check
  log("preflight: checking ports...");
  const portsFree = await checkPorts();
  if (!portsFree) {
    logErr("ABORT: ports in use. Kill conflicting processes and retry.");
    process.exit(1);
  }
  log("preflight: all ports free ✓");

  // 2. Start sub-services with stagger
  log("phase 1: starting sub-services...");
  const subManaged: ManagedService[] = [];

  for (const key of subServices) {
    const def = SERVICE_DEFS[key]!;
    const svc: ManagedService = {
      key,
      port: def.port,
      entryFile: def.entryFile,
      child: null,
      restarts: 0,
      stopping: false,
    };
    managed.push(svc);
    subManaged.push(svc);
    spawnService(svc);
    await sleep(STAGGER_DELAY);
  }

  // 3. Wait for all sub-services to be healthy
  log("phase 2: waiting for sub-service health checks...");
  const healthResults = await Promise.all(
    subManaged.map(async (svc) => {
      const ok = await waitForHealth(svc.port, HEALTH_TIMEOUT);
      if (ok) {
        log(`  [${svc.key}] ready on :${svc.port} ✓`);
      } else {
        logErr(`  [${svc.key}] health check timeout (${HEALTH_TIMEOUT}ms) ✗`);
      }
      return { key: svc.key, ok };
    })
  );

  const failedServices = healthResults.filter((r) => !r.ok);
  if (failedServices.length > 0) {
    logErr(`WARNING: ${failedServices.length} service(s) failed health check: ${failedServices.map((f) => f.key).join(", ")}`);
    log("continuing anyway — coordinator will use circuit breakers for unhealthy services");
  }

  // 4. Start coordinator last
  log("phase 3: starting coordinator...");
  const coordDef = SERVICE_DEFS[coordinatorKey]!;
  const coordSvc: ManagedService = {
    key: coordinatorKey,
    port: coordDef.port,
    entryFile: coordDef.entryFile,
    child: null,
    restarts: 0,
    stopping: false,
  };
  managed.push(coordSvc);
  spawnService(coordSvc);

  const coordHealthy = await waitForHealth(coordSvc.port, HEALTH_TIMEOUT);
  if (coordHealthy) {
    log(`  [coordinator] ready on :${coordSvc.port} ✓`);
  } else {
    logErr("CRITICAL: coordinator failed to start");
  }

  // 5. Startup summary
  const readyCount = healthResults.filter((r) => r.ok).length + (coordHealthy ? 1 : 0);
  const totalCount = subServices.length + 1;

  console.log("");
  console.log("  ┌─────────────────────────────────────────────────────────┐");
  console.log(`  │  Galactica Agent Network — ${readyCount}/${totalCount} services ready              │`);
  console.log("  ├─────────────────────────────────────────────────────────┤");
  console.log("  │  4001 — Engagement Monitor      (USDT $0.001)          │");
  console.log("  │  4006 — Engagement V2 (rival)   (USDT $0.001)          │");
  console.log("  │  4002 — Yield Scanner           (USDT $0.020)          │");
  console.log("  │  4003 — DeFi Scanner            (USDT $0.015)          │");
  console.log("  │  4004 — Risk Monitor            (USDT $0.001)          │");
  console.log("  │  4005 — Credit Analyzer         (USDT $0.002)          │");
  console.log("  │  5000 — Strategy Engine         (USDT $0.050)          │");
  console.log("  ├─────────────────────────────────────────────────────────┤");
  console.log("  │  Dashboard:  http://localhost:5000                      │");
  console.log("  │  Tracks:     Wallets │ Lending │ DeFi │ Tipping        │");
  console.log("  │  Payments:   Tether WDK (USDT/XAUT)                    │");
  console.log(`  │  Auto-restart: up to ${MAX_RESTARTS} attempts per service              │`);
  console.log("  └─────────────────────────────────────────────────────────┘");
  console.log("");
}

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

function shutdown(signal: NodeJS.Signals): void {
  if (shuttingDown) return;
  shuttingDown = true;

  log(`${signal} received — stopping all services...`);

  for (const svc of managed) {
    svc.stopping = true;
    if (svc.child && !svc.child.killed) {
      svc.child.kill("SIGTERM");
    }
  }

  // Force-kill any survivors
  setTimeout(() => {
    for (const svc of managed) {
      if (svc.child && !svc.child.killed) {
        log(`[${svc.key}] force killing (SIGKILL)`);
        svc.child.kill("SIGKILL");
      }
    }
    process.exit(0);
  }, FORCE_KILL_TIMEOUT).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  logErr(`uncaught exception in supervisor: ${err.message}`);
  shutdown("SIGTERM");
});

process.on("unhandledRejection", (reason) => {
  logErr(`unhandled rejection in supervisor: ${reason}`);
});

// ─── Run ─────────────────────────────────────────────────────────────────────

startAll().catch((err) => {
  logErr(`startup failed: ${err.message}`);
  process.exit(1);
});
