import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { neon } = await import("@neondatabase/serverless");
  const sql = neon(process.env.DATABASE_URL!);
  const installed = await sql`SELECT extname FROM pg_extension WHERE extname = 'vector'`;
  console.log("pgvector installed:", installed.length > 0);
  if (installed.length === 0) {
    console.log("Installing pgvector extension…");
    await sql`CREATE EXTENSION IF NOT EXISTS vector`;
    console.log("✓ pgvector installed");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
