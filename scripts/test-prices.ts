import { config } from "dotenv";
config({ path: ".env.local" });
import { fetchQuote, fetchQuotes } from "@/lib/finance/prices";
import { isPolygonConfigured } from "@/lib/finance/providers/polygon";

async function main() {
  console.log("Polygon configured:", isPolygonConfigured());
  console.log("");

  console.log("=== Single fetchQuote(AAPL) ===");
  const aapl = await fetchQuote("AAPL");
  console.log(aapl);
  console.log("");

  console.log("=== Bulk fetchQuotes([AAPL, SPY, BND, BTC, GLD]) ===");
  const bulk = await fetchQuotes(["AAPL", "SPY", "BND", "BTC", "GLD"]);
  for (const [k, v] of bulk) console.log(k, "→ $", v.price, "via", v.provider);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
