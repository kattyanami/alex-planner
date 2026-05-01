"use server";

import { auth } from "@clerk/nextjs/server";
import { classifyInstrument } from "@/lib/agents/tagger";

export async function runTagger(formData: FormData) {
  const { userId } = await auth();
  if (!userId) {
    return { error: "Not authenticated" };
  }

  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim();
  const instrument_type = String(formData.get("instrument_type") ?? "etf");

  if (!symbol || !name) {
    return { error: "Symbol and name are required" };
  }

  try {
    const result = await classifyInstrument(symbol, name, instrument_type);
    return { ok: true, ...result };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { error: message };
  }
}
