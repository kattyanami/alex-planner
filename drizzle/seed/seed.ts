import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { sql } from "drizzle-orm";
import { instruments } from "@/lib/db/schema";
import { ETF_SEED } from "./etfs";

config({ path: ".env.local" });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

const client = neon(process.env.DATABASE_URL);
const db = drizzle(client);

async function main() {
  console.log(`Seeding ${ETF_SEED.length} instruments...`);

  for (const etf of ETF_SEED) {
    await db
      .insert(instruments)
      .values(etf)
      .onConflictDoUpdate({
        target: instruments.symbol,
        set: {
          name: etf.name,
          instrumentType: etf.instrumentType,
          currentPrice: etf.currentPrice,
          allocationRegions: etf.allocationRegions,
          allocationSectors: etf.allocationSectors,
          allocationAssetClass: etf.allocationAssetClass,
          updatedAt: sql`NOW()`,
        },
      });
    console.log(`  upserted ${etf.symbol} — ${etf.name}`);
  }

  const result = await client`SELECT COUNT(*)::int as count FROM instruments`;
  console.log(`\nDone. instruments table now has ${result[0].count} rows.`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
