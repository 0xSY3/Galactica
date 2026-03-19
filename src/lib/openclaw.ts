/**
 * OpenClaw reasoning wrapper — structures every LLM call as an OpenClaw
 * reasoning step with typed input/output. Uses the existing Groq backend
 * (from llm.ts) as the embedded reasoning engine.
 *
 * OPENCLAW_MODE controls behavior:
 *   "embedded" (default) — uses the built-in Groq LLM as the reasoning engine
 *   "disabled"           — all queries return null, callers use their own fallback
 */

import { callLLMJson, isLLMEnabled } from "./llm.js";
import { createLogger } from "./logger.js";
import { config } from "../config/env.js";

const log = createLogger("openclaw");

export interface OpenClawResponse {
  reasoning: string;
  decision: string;
  confidence: number;
  actions: string[];
}

interface OpenClawReasoningPrompt {
  objective: string;
  context: Record<string, unknown>;
  constraints: string[];
}

export function isOpenClawEnabled(): boolean {
  return config.openclaw.mode !== "disabled" && isLLMEnabled();
}

/**
 * Build an OpenClaw-structured prompt that frames the LLM call as a
 * reasoning step with explicit objective, context, and constraints.
 */
function buildReasoningPrompt(prompt: string, context: Record<string, unknown>): string {
  const structured: OpenClawReasoningPrompt = {
    objective: prompt,
    context,
    constraints: [
      "Respond with structured reasoning",
      "Provide a clear decision with confidence level 0-100",
      "List concrete next actions",
      "Keep reasoning concise but complete",
    ],
  };

  return `You are the OpenClaw reasoning engine — a structured decision-making system for autonomous agents.

## Reasoning Step

**Objective:** ${structured.objective}

**Context:**
${Object.entries(structured.context)
  .filter(([, v]) => v != null)
  .map(([k, v]) => `- ${k}: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
  .join("\n")}

**Constraints:**
${structured.constraints.map(c => `- ${c}`).join("\n")}

Analyze the context, reason step-by-step, and return ONLY valid JSON:
{"reasoning":"<your chain-of-thought reasoning, 1-3 sentences>","decision":"<clear actionable decision statement>","confidence":<0-100>,"actions":["<action1>","<action2>"]}`;
}

/**
 * Query the OpenClaw reasoning engine with a prompt and context.
 * Returns a structured response with reasoning, decision, confidence, and actions.
 * Returns null if OpenClaw is disabled or the LLM call fails — callers must have a fallback.
 */
export async function queryOpenClaw(
  prompt: string,
  context: Record<string, unknown>,
): Promise<OpenClawResponse | null> {
  if (!isOpenClawEnabled()) {
    log.debug("openclaw disabled or llm unavailable, skipping reasoning step");
    return null;
  }

  const reasoningPrompt = buildReasoningPrompt(prompt, context);

  log.info("openclaw reasoning step", { objective: prompt.slice(0, 80) });

  const result = await callLLMJson<OpenClawResponse>(reasoningPrompt, 512);

  if (!result) {
    log.warn("openclaw reasoning step failed, returning null");
    return null;
  }

  if (typeof result.confidence !== "number") {
    result.confidence = 50;
  }
  if (!Array.isArray(result.actions)) {
    result.actions = [];
  }

  log.info("openclaw reasoning complete", {
    decision: result.decision?.slice(0, 60),
    confidence: result.confidence,
    actionCount: result.actions.length,
  });

  return result;
}
