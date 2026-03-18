/**
 * Moltbook integration — disabled in Galactica build.
 * Stubs exported to maintain import compatibility.
 */

import { createLogger } from "../lib/logger.js";

const log = createLogger("moltbook");

export function loadMoltbook(): void {
  log.info("moltbook disabled — Galactica build");
}

export function initMoltbook(): void {
  // no-op
}

export function getMoltbookStatus(): { enabled: boolean } {
  return { enabled: false };
}

export function getPostHistory(): never[] {
  return [];
}
