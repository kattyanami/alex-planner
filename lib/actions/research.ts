"use server";

import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { buildDocText, embedBatch } from "@/lib/agents/embedder";
import { researchSymbols } from "@/lib/agents/researcher";
import {
  getUserAccountsDetailed,
  listUnembeddedDocs,
  logActivity,
  setDocEmbedding,
  upsertResearchDocs,
} from "@/lib/db/queries";

export type RunResearcherResult =
  | {
      ok: true;
      symbols: number;
      fetched: number;
      inserted: number;
      skipped: number;
      embedded: number;
      embeddingTokens: number;
      ms: number;
      perSymbol: Array<{ symbol: string; fetched: number }>;
    }
  | { error: string };

/**
 * Manually trigger the Researcher for the current user's holdings.
 *
 * Reads the unique symbols across all accounts, fans out a Yahoo news
 * fetch per symbol in parallel, then bulk-upserts documents into
 * research_documents. Dedup via the (symbol, hash) unique index — repeat
 * runs are cheap and idempotent.
 */
export async function runResearcherForUserAction(): Promise<RunResearcherResult> {
  try {
    const { userId } = await auth();
    if (!userId) return { error: "Not authenticated" };

    const start = Date.now();
    const accounts = await getUserAccountsDetailed(userId);
    const symbols = Array.from(
      new Set(accounts.flatMap((a) => a.positions.map((p) => p.symbol))),
    );
    if (symbols.length === 0) {
      return { error: "No holdings to research. Add positions first." };
    }

    const docs = await researchSymbols(symbols);
    const { inserted, skipped } = await upsertResearchDocs(docs);

    // Auto-embed: every doc that doesn't have an embedding yet (covers both
    // freshly-inserted ones and any older rows from before Phase 6).
    const pending = await listUnembeddedDocs(50);
    let embedded = 0;
    let embeddingTokens = 0;
    if (pending.length > 0) {
      const texts = pending.map((d) =>
        buildDocText({ symbol: d.symbol, title: d.title, content: d.content }),
      );
      const { embeddings, tokens } = await embedBatch(texts);
      await Promise.all(
        pending.map((d, i) =>
          embeddings[i] ? setDocEmbedding(d.id, embeddings[i]) : Promise.resolve(),
        ),
      );
      embedded = embeddings.length;
      embeddingTokens = tokens;
    }

    const perSymbol = symbols.map((sym) => ({
      symbol: sym,
      fetched: docs.filter((d) => d.symbol === sym).length,
    }));

    await logActivity(
      userId,
      "analysis_completed", // closest existing kind; could add 'research_run' later
      `Researcher fetched ${docs.length} docs across ${symbols.length} symbols (${inserted} new, ${skipped} dup, ${embedded} embedded)`,
      {
        kind: "research_run",
        symbols: symbols.length,
        fetched: docs.length,
        inserted,
        skipped,
        embedded,
        embeddingTokens,
      },
    );
    revalidatePath("/dashboard/research");
    revalidatePath("/dashboard");

    return {
      ok: true,
      symbols: symbols.length,
      fetched: docs.length,
      inserted,
      skipped,
      embedded,
      embeddingTokens,
      ms: Date.now() - start,
      perSymbol,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Researcher failed" };
  }
}
