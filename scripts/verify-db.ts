import { config } from "dotenv";
import { neon } from "@neondatabase/serverless";

config({ path: ".env.local" });

async function main() {
  const sql = neon(process.env.DATABASE_URL!);
  const tables = await sql`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name
  `;
  console.log("Tables in Neon:");
  for (const t of tables) {
    console.log(`  - ${t.table_name}`);
  }

  const counts = await sql`SELECT COUNT(*) as count FROM instruments`;
  console.log(`\nInstruments: ${counts[0].count}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
