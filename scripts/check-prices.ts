import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { db } = await import("@/lib/db");
  const { activityEvents, instruments } = await import("@/lib/db/schema");
  const { eq, desc } = await import("drizzle-orm");

  const recent = await db
    .select()
    .from(activityEvents)
    .where(eq(activityEvents.kind, "profile_saved"))
    .orderBy(desc(activityEvents.createdAt))
    .limit(3);
  console.log("=== Last 3 refresh activity entries ===");
  for (const r of recent) {
    console.log(
      "  at",
      r.createdAt?.toISOString(),
      "→",
      JSON.stringify(r.metadata),
    );
  }

  console.log("");
  console.log("=== Current price source distribution ===");
  const all = await db
    .select({
      s: instruments.priceSource,
      sym: instruments.symbol,
      p: instruments.currentPrice,
    })
    .from(instruments);
  const counts: Record<string, number> = {};
  const sample: Record<string, string[]> = {};
  for (const r of all) {
    const k = r.s || "null";
    counts[k] = (counts[k] || 0) + 1;
    if (!sample[k]) sample[k] = [];
    if (sample[k].length < 4) sample[k].push(`${r.sym}=$${r.p}`);
  }
  console.log(counts);
  console.log("Examples:", sample);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
