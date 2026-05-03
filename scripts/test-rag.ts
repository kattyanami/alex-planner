import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("@/lib/db");
  const { researchDocuments } = await import("@/lib/db/schema");
  const { isNull, sql } = await import("drizzle-orm");
  const { embedText, embedBatch, buildDocText } = await import(
    "@/lib/agents/embedder"
  );
  const { findRelevantDocsForSymbol, listUnembeddedDocs, setDocEmbedding } =
    await import("@/lib/db/queries");

  console.log("=== Embedding status ===");
  const [counts] = await db
    .select({
      total: sql<number>`COUNT(*)::int`,
      embedded: sql<number>`COUNT(${researchDocuments.embedding})::int`,
    })
    .from(researchDocuments);
  console.log(`  Total docs: ${counts.total}`);
  console.log(`  Embedded:   ${counts.embedded}`);
  console.log(`  Pending:    ${counts.total - counts.embedded}`);

  if (counts.total === 0) {
    console.log("\n  → No docs yet. Click 'Run now' on /dashboard/research first.");
    return;
  }

  // Backfill any unembedded docs
  const pending = await listUnembeddedDocs(50);
  if (pending.length > 0) {
    console.log(`\n=== Embedding ${pending.length} pending docs ===`);
    const texts = pending.map((d) =>
      buildDocText({ symbol: d.symbol, title: d.title, content: d.content }),
    );
    const { embeddings, tokens } = await embedBatch(texts);
    console.log(`  ✓ Got ${embeddings.length} embeddings (${tokens} tokens)`);
    await Promise.all(
      pending.map((d, i) =>
        embeddings[i] ? setDocEmbedding(d.id, embeddings[i]) : Promise.resolve(),
      ),
    );
    console.log(`  ✓ Persisted to DB`);
  }

  // Pick a symbol with docs
  const distinctSymbols = await db
    .select({ s: researchDocuments.symbol })
    .from(researchDocuments)
    .where(sql`${researchDocuments.embedding} IS NOT NULL`)
    .limit(50);
  const symbols = Array.from(new Set(distinctSymbols.map((r) => r.s)));
  const testSymbol = symbols[0];
  if (!testSymbol) {
    console.log("\n  → No embedded docs to retrieve from.");
    return;
  }

  console.log(`\n=== Retrieving top-3 for ${testSymbol} ===`);
  const query = `Material recent developments and risks affecting an investor with positions in ${testSymbol}: market-moving news, earnings, sector rotations.`;
  const { values: queryEmbedding } = await embedText(query);
  console.log(`  Query embedded (${queryEmbedding.length} dims)`);
  const docs = await findRelevantDocsForSymbol(testSymbol, queryEmbedding, 3);
  for (const d of docs) {
    const sim = d.similarity != null ? `${(d.similarity * 100).toFixed(1)}%` : "—";
    console.log(`  [${sim}] ${d.title.slice(0, 80)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
