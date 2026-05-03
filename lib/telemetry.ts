/**
 * Lightweight agent telemetry.
 *
 * Every agent / LLM call gets wrapped in `traceAgent()` which emits a
 * single structured JSON line to stdout. Vercel automatically captures
 * these in the project Logs UI (Project → Logs → filter on `kind:llm`).
 *
 * For richer observability (per-prompt diff views, cost dashboards,
 * conversation tracing across users), see OBSERVABILITY.md for the
 * LangFuse upgrade path. The shape below maps cleanly to Langfuse's
 * `generation` schema, so the swap is mechanical.
 */

export type AgentSpan = {
  agent: string; // e.g. "tagger", "reporter", "embedder"
  model?: string;
  ok: boolean;
  ms: number;
  tokensIn?: number;
  tokensOut?: number;
  error?: string;
  meta?: Record<string, unknown>;
};

function emit(span: AgentSpan) {
  // Single JSON line so Vercel Log Drains can parse it without splitting on newlines.
  // Stringify defensively so circular refs in `meta` don't crash the agent.
  let payload: string;
  try {
    payload = JSON.stringify({ kind: "llm", ts: new Date().toISOString(), ...span });
  } catch {
    payload = JSON.stringify({
      kind: "llm",
      ts: new Date().toISOString(),
      agent: span.agent,
      ok: span.ok,
      ms: span.ms,
      error: "failed_to_serialize_meta",
    });
  }
  if (span.ok) console.log(payload);
  else console.warn(payload);
}

export async function traceAgent<T>(
  agent: string,
  fn: () => Promise<T>,
  meta?: { model?: string } & Record<string, unknown>,
): Promise<T> {
  const start = Date.now();
  try {
    const result = await fn();
    // Convention: if the function returns an object with tokensIn/tokensOut/usage,
    // pull them out automatically so callers don't have to repeat themselves.
    const { tokensIn, tokensOut } = extractUsage(result);
    emit({
      agent,
      model: meta?.model,
      ok: true,
      ms: Date.now() - start,
      tokensIn,
      tokensOut,
      meta,
    });
    return result;
  } catch (err) {
    emit({
      agent,
      model: meta?.model,
      ok: false,
      ms: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
      meta,
    });
    throw err;
  }
}

function extractUsage(value: unknown): {
  tokensIn?: number;
  tokensOut?: number;
} {
  if (!value || typeof value !== "object") return {};
  const o = value as Record<string, unknown>;
  if (typeof o.tokensIn === "number" && typeof o.tokensOut === "number") {
    return { tokensIn: o.tokensIn, tokensOut: o.tokensOut };
  }
  if (o.usage && typeof o.usage === "object") {
    const u = o.usage as Record<string, unknown>;
    return {
      tokensIn:
        typeof u.inputTokens === "number"
          ? u.inputTokens
          : typeof u.promptTokens === "number"
            ? u.promptTokens
            : undefined,
      tokensOut:
        typeof u.outputTokens === "number"
          ? u.outputTokens
          : typeof u.completionTokens === "number"
            ? u.completionTokens
            : undefined,
    };
  }
  return {};
}
