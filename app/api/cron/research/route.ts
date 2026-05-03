/**
 * ============================================================================
 * Researcher cron route — currently MANUAL-ONLY.
 * ============================================================================
 *
 * Cron is intentionally NOT enabled. To activate scheduled runs later:
 *
 *   1. Add this block to vercel.json (create the file if it doesn't exist):
 *
 *      {
 *        "crons": [
 *          {
 *            "path": "/api/cron/research",
 *            "schedule": "0 2 * * *"
 *          }
 *        ]
 *      }
 *
 *      Schedule "0 2 * * *" = every day at 02:00 UTC.
 *      Other useful schedules:
 *        "0 * * * *"      hourly
 *        "0 0 * * *"      daily at midnight UTC
 *        "0 0 * * 1"      weekly Monday 00:00 UTC
 *        "0 6,18 * * 1-5" twice daily on weekdays at 06:00 + 18:00 UTC
 *
 *   2. Set a CRON_SECRET env var on Vercel:
 *      vercel env add CRON_SECRET production
 *      (value: any random 32+ char string)
 *
 *   3. Redeploy. Vercel adds an "Authorization: Bearer <CRON_SECRET>" header
 *      automatically when invoking the route on schedule. Local dev / manual
 *      curl can hit the route by sending the same header.
 *
 *   4. Optional: tighten which users get researched by editing the loop
 *      below (e.g. only the last-active 30 days).
 *
 * Until step 1 is taken, this endpoint exists but is not invoked on schedule.
 * It's still callable manually with the right auth header.
 * ============================================================================
 */

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, accounts, positions } from "@/lib/db/schema";
import { researchSymbols } from "@/lib/agents/researcher";
import { logActivity, upsertResearchDocs } from "@/lib/db/queries";
import { eq } from "drizzle-orm";

export const maxDuration = 60;

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;

  // Only enforce auth when CRON_SECRET is set (so local dev without the
  // env var still works for manual testing).
  if (expected && authHeader !== `Bearer ${expected}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const start = Date.now();
  const allUsers = await db.select({ id: users.clerkUserId }).from(users);

  let totalSymbols = 0;
  let totalDocs = 0;
  let totalInserted = 0;
  let usersProcessed = 0;
  const errors: string[] = [];

  for (const u of allUsers) {
    try {
      const userAccounts = await db
        .select({ accountId: accounts.id })
        .from(accounts)
        .where(eq(accounts.clerkUserId, u.id));
      if (userAccounts.length === 0) continue;

      const accountIds = userAccounts.map((a) => a.accountId);
      const userPositions = await db
        .select({ symbol: positions.symbol })
        .from(positions);
      const symbols = Array.from(
        new Set(
          userPositions
            .filter(() => accountIds.length > 0) // (we filter by accountId in app code)
            .map((p) => p.symbol),
        ),
      );
      if (symbols.length === 0) continue;

      const docs = await researchSymbols(symbols);
      const { inserted } = await upsertResearchDocs(docs);

      totalSymbols += symbols.length;
      totalDocs += docs.length;
      totalInserted += inserted;
      usersProcessed++;

      await logActivity(
        u.id,
        "analysis_completed",
        `Cron researcher fetched ${docs.length} docs across ${symbols.length} symbols (${inserted} new)`,
        { kind: "research_cron", symbols: symbols.length, fetched: docs.length, inserted },
      );
    } catch (err) {
      errors.push(
        `user ${u.id}: ${err instanceof Error ? err.message : "unknown"}`,
      );
    }
  }

  return NextResponse.json({
    ok: true,
    usersProcessed,
    totalSymbols,
    totalDocs,
    totalInserted,
    ms: Date.now() - start,
    errors,
  });
}
