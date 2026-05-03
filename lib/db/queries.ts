import { and, desc, eq } from "drizzle-orm";
import { db } from "./index";
import {
  accounts,
  activityEvents,
  instruments,
  jobs,
  positions,
  researchDocuments,
  users,
  type ActivityEvent,
  type Job,
  type ResearchDocument,
} from "./schema";
import type { Portfolio, UserProfile } from "@/lib/agents/reporter";
import type { ResearchDoc } from "@/lib/agents/researcher";

export async function ensureUser(clerkUserId: string, displayName?: string) {
  await db
    .insert(users)
    .values({ clerkUserId, displayName: displayName ?? null })
    .onConflictDoNothing();
}

export async function getUser(clerkUserId: string) {
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.clerkUserId, clerkUserId));
  return user ?? null;
}

export async function listInstruments(limit = 25) {
  return db.select().from(instruments).limit(limit);
}

export async function listAllInstruments() {
  return db.select().from(instruments).orderBy(instruments.symbol);
}

export async function getInstrumentBySymbol(symbol: string) {
  const [row] = await db
    .select()
    .from(instruments)
    .where(eq(instruments.symbol, symbol));
  return row ?? null;
}

export type PriceSource = "tagger" | "yahoo" | "polygon";

export async function addInstrument(input: {
  symbol: string;
  name: string;
  instrumentType: string;
  currentPrice: number;
  priceSource?: PriceSource;
  priceUpdatedAt?: Date | null;
  allocationAssetClass: Record<string, number>;
  allocationRegions: Record<string, number>;
  allocationSectors: Record<string, number>;
}) {
  const priceSource = input.priceSource ?? "tagger";
  const priceUpdatedAt = input.priceUpdatedAt ?? new Date();
  const [row] = await db
    .insert(instruments)
    .values({
      symbol: input.symbol,
      name: input.name,
      instrumentType: input.instrumentType,
      currentPrice: String(input.currentPrice),
      priceSource,
      priceUpdatedAt,
      allocationAssetClass: input.allocationAssetClass,
      allocationRegions: input.allocationRegions,
      allocationSectors: input.allocationSectors,
    })
    .onConflictDoUpdate({
      target: instruments.symbol,
      set: {
        name: input.name,
        instrumentType: input.instrumentType,
        currentPrice: String(input.currentPrice),
        priceSource,
        priceUpdatedAt,
        allocationAssetClass: input.allocationAssetClass,
        allocationRegions: input.allocationRegions,
        allocationSectors: input.allocationSectors,
        updatedAt: new Date(),
      },
    })
    .returning();
  return row;
}

export async function updateInstrumentPrice(
  symbol: string,
  price: number,
  source: PriceSource = "yahoo",
) {
  const [row] = await db
    .update(instruments)
    .set({
      currentPrice: String(price),
      priceSource: source,
      priceUpdatedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(instruments.symbol, symbol))
    .returning();
  return row;
}

// ---- Profile ---------------------------------------------------------------

export type UserProfileFull = UserProfile & {
  current_age?: number | null;
  annual_contribution?: number | null;
};

export async function getUserProfile(
  clerkUserId: string,
): Promise<UserProfileFull | null> {
  const u = await getUser(clerkUserId);
  if (!u) return null;
  return {
    display_name: u.displayName,
    years_until_retirement: u.yearsUntilRetirement,
    target_retirement_income: u.targetRetirementIncome
      ? Number(u.targetRetirementIncome)
      : null,
    current_age: u.currentAge,
    annual_contribution: u.annualContribution
      ? Number(u.annualContribution)
      : null,
  };
}

export async function updateUserProfile(
  clerkUserId: string,
  patch: {
    yearsUntilRetirement?: number | null;
    targetRetirementIncome?: number | null;
    currentAge?: number | null;
    annualContribution?: number | null;
  },
) {
  await db
    .update(users)
    .set({
      yearsUntilRetirement: patch.yearsUntilRetirement ?? null,
      targetRetirementIncome:
        patch.targetRetirementIncome != null
          ? String(patch.targetRetirementIncome)
          : null,
      currentAge: patch.currentAge ?? null,
      annualContribution:
        patch.annualContribution != null
          ? String(patch.annualContribution)
          : null,
      updatedAt: new Date(),
    })
    .where(eq(users.clerkUserId, clerkUserId));
}

// ---- Portfolio (read) ------------------------------------------------------

type AccountRow = typeof accounts.$inferSelect;
type PositionRow = typeof positions.$inferSelect;
type InstrumentRow = typeof instruments.$inferSelect;

export async function getUserPortfolio(
  clerkUserId: string,
): Promise<Portfolio> {
  const accountRows: AccountRow[] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.clerkUserId, clerkUserId));

  if (accountRows.length === 0) return { accounts: [] };

  const accountIds = accountRows.map((a) => a.id);
  const positionRows = await db
    .select({ pos: positions, inst: instruments })
    .from(positions)
    .innerJoin(instruments, eq(positions.symbol, instruments.symbol))
    .where(
      // accountId IN (...)
      accountIds.length === 1
        ? eq(positions.accountId, accountIds[0])
        : undefined,
    );

  // Drizzle doesn't have a clean inArray import here; if more than one account
  // we fetch all then filter in-memory (small N). Could swap to inArray() later.
  const filtered = positionRows.filter((r) =>
    accountIds.includes(r.pos.accountId),
  );

  const byAccount = new Map<string, Array<{ pos: PositionRow; inst: InstrumentRow }>>();
  for (const r of filtered) {
    const list = byAccount.get(r.pos.accountId) ?? [];
    list.push(r);
    byAccount.set(r.pos.accountId, list);
  }

  return {
    accounts: accountRows.map((a) => ({
      name: a.accountName,
      cash_balance: a.cashBalance ? Number(a.cashBalance) : 0,
      positions: (byAccount.get(a.id) ?? []).map(({ pos, inst }) => ({
        symbol: pos.symbol,
        quantity: Number(pos.quantity),
        instrument: {
          name: inst.name,
          instrument_type: inst.instrumentType,
          current_price: inst.currentPrice ? Number(inst.currentPrice) : null,
          allocation_asset_class:
            (inst.allocationAssetClass as Record<string, number>) ?? null,
          allocation_regions:
            (inst.allocationRegions as Record<string, number>) ?? null,
          allocation_sectors:
            (inst.allocationSectors as Record<string, number>) ?? null,
        },
      })),
    })),
  };
}

export type AccountWithPositions = {
  id: string;
  name: string;
  cashBalance: number;
  positions: Array<{
    id: string;
    symbol: string;
    quantity: number;
    instrumentName: string;
    currentPrice: number | null;
  }>;
};

export async function getUserAccountsDetailed(
  clerkUserId: string,
): Promise<AccountWithPositions[]> {
  const accountRows = await db
    .select()
    .from(accounts)
    .where(eq(accounts.clerkUserId, clerkUserId));

  if (accountRows.length === 0) return [];

  const accountIds = accountRows.map((a) => a.id);
  const all = await db
    .select({ pos: positions, inst: instruments })
    .from(positions)
    .innerJoin(instruments, eq(positions.symbol, instruments.symbol));

  const filtered = all.filter((r) => accountIds.includes(r.pos.accountId));

  return accountRows.map((a) => ({
    id: a.id,
    name: a.accountName,
    cashBalance: a.cashBalance ? Number(a.cashBalance) : 0,
    positions: filtered
      .filter((r) => r.pos.accountId === a.id)
      .map((r) => ({
        id: r.pos.id,
        symbol: r.pos.symbol,
        quantity: Number(r.pos.quantity),
        instrumentName: r.inst.name,
        currentPrice: r.inst.currentPrice ? Number(r.inst.currentPrice) : null,
      })),
  }));
}

// ---- Portfolio (write) -----------------------------------------------------

export async function addAccount(
  clerkUserId: string,
  name: string,
  cashBalance = 0,
) {
  const [row] = await db
    .insert(accounts)
    .values({
      clerkUserId,
      accountName: name,
      cashBalance: String(cashBalance),
    })
    .returning();
  return row;
}

export async function removeAccount(clerkUserId: string, accountId: string) {
  await db
    .delete(accounts)
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.clerkUserId, clerkUserId),
      ),
    );
}

export async function setAccountCash(
  clerkUserId: string,
  accountId: string,
  cashBalance: number,
) {
  await db
    .update(accounts)
    .set({ cashBalance: String(cashBalance), updatedAt: new Date() })
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.clerkUserId, clerkUserId),
      ),
    );
}

async function userOwnsAccount(clerkUserId: string, accountId: string) {
  const [a] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(
      and(
        eq(accounts.id, accountId),
        eq(accounts.clerkUserId, clerkUserId),
      ),
    );
  return !!a;
}

export async function addPosition(
  clerkUserId: string,
  accountId: string,
  symbol: string,
  quantity: number,
) {
  if (!(await userOwnsAccount(clerkUserId, accountId))) {
    throw new Error("Account not found");
  }
  await db
    .insert(positions)
    .values({ accountId, symbol, quantity: String(quantity) })
    .onConflictDoUpdate({
      target: [positions.accountId, positions.symbol],
      set: { quantity: String(quantity), updatedAt: new Date() },
    });
}

export async function removePosition(
  clerkUserId: string,
  positionId: string,
) {
  // Lookup-then-delete to enforce ownership
  const [row] = await db
    .select({ accountId: positions.accountId })
    .from(positions)
    .where(eq(positions.id, positionId));
  if (!row) return;
  if (!(await userOwnsAccount(clerkUserId, row.accountId))) {
    throw new Error("Not allowed");
  }
  await db.delete(positions).where(eq(positions.id, positionId));
}

// ---- Sample portfolio seed (idempotent, per user) --------------------------

export async function seedSamplePortfolioForUser(clerkUserId: string) {
  const existing = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.clerkUserId, clerkUserId));
  if (existing.length > 0) return { skipped: true as const };

  const a401k = await addAccount(clerkUserId, "401(k)", 5_000);
  const aRoth = await addAccount(clerkUserId, "Roth IRA", 1_500);

  await Promise.all([
    addPosition(clerkUserId, a401k.id, "SPY", 120),
    addPosition(clerkUserId, a401k.id, "BND", 200),
    addPosition(clerkUserId, aRoth.id, "QQQ", 40),
    addPosition(clerkUserId, aRoth.id, "VEA", 150),
    addPosition(clerkUserId, aRoth.id, "GLD", 8),
  ]);

  await updateUserProfile(clerkUserId, {
    yearsUntilRetirement: 25,
    targetRetirementIncome: 90_000,
    currentAge: 40,
    annualContribution: 10_000,
  });

  return { skipped: false as const };
}

export async function clearUserPortfolio(clerkUserId: string) {
  // Cascades delete positions
  await db.delete(accounts).where(eq(accounts.clerkUserId, clerkUserId));
}

// ---- Activity log ----------------------------------------------------------

export type ActivityKind =
  | "account_added"
  | "account_removed"
  | "position_added"
  | "position_removed"
  | "profile_saved"
  | "sample_loaded"
  | "portfolio_cleared"
  | "analysis_completed";

export async function logActivity(
  clerkUserId: string,
  kind: ActivityKind,
  description: string,
  metadata?: Record<string, unknown>,
) {
  await db.insert(activityEvents).values({
    clerkUserId,
    kind,
    description,
    metadata: metadata ?? null,
  });
}

export async function listRecentActivity(
  clerkUserId: string,
  limit = 8,
): Promise<ActivityEvent[]> {
  return db
    .select()
    .from(activityEvents)
    .where(eq(activityEvents.clerkUserId, clerkUserId))
    .orderBy(desc(activityEvents.createdAt))
    .limit(limit);
}

// ---- Analysis snapshots (jobs table) ---------------------------------------

export type AnalysisSnapshot = {
  reportMarkdown?: string;
  retirementMarkdown?: string;
  successRate?: number;
  expectedAtRetirement?: number;
  totalValue?: number;
  charts?: unknown;
  durations?: { tagger: number; reporter: number; charter: number; retirement: number };
  tokens?: { in: number; out: number };
};

export async function saveAnalysisSnapshot(
  clerkUserId: string,
  snapshot: AnalysisSnapshot,
) {
  const now = new Date();
  await db.insert(jobs).values({
    clerkUserId,
    jobType: "analysis",
    status: "completed",
    requestPayload: { totalValue: snapshot.totalValue },
    reportPayload: snapshot.reportMarkdown ? { markdown: snapshot.reportMarkdown } : null,
    chartsPayload: snapshot.charts ? snapshot.charts : null,
    retirementPayload: snapshot.retirementMarkdown
      ? {
          markdown: snapshot.retirementMarkdown,
          successRate: snapshot.successRate,
          expectedAtRetirement: snapshot.expectedAtRetirement,
        }
      : null,
    summaryPayload: {
      durations: snapshot.durations,
      tokens: snapshot.tokens,
      successRate: snapshot.successRate,
    },
    startedAt: now,
    completedAt: now,
  });
}

export async function getLastAnalysis(clerkUserId: string): Promise<Job | null> {
  const [j] = await db
    .select()
    .from(jobs)
    .where(
      and(
        eq(jobs.clerkUserId, clerkUserId),
        eq(jobs.jobType, "analysis"),
        eq(jobs.status, "completed"),
      ),
    )
    .orderBy(desc(jobs.completedAt))
    .limit(1);
  return j ?? null;
}

// ---- Research documents ----------------------------------------------------

export async function upsertResearchDocs(docs: ResearchDoc[]): Promise<{
  inserted: number;
  skipped: number;
}> {
  if (docs.length === 0) return { inserted: 0, skipped: 0 };
  let inserted = 0;
  let skipped = 0;
  for (const d of docs) {
    const result = await db
      .insert(researchDocuments)
      .values({
        symbol: d.symbol,
        source: d.source,
        url: d.url,
        title: d.title,
        content: d.content,
        hash: d.hash,
        publishedAt: d.publishedAt,
        metadata: d.metadata ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: researchDocuments.id });
    if (result.length > 0) inserted++;
    else skipped++;
  }
  return { inserted, skipped };
}

export async function listResearchForSymbols(
  symbols: string[],
  limitPerSymbol = 5,
): Promise<ResearchDocument[]> {
  if (symbols.length === 0) return [];
  // Drizzle inArray would be cleaner but we filter post-fetch for simplicity
  const all = await db
    .select()
    .from(researchDocuments)
    .orderBy(desc(researchDocuments.fetchedAt))
    .limit(limitPerSymbol * symbols.length * 4);
  const set = new Set(symbols.map((s) => s.toUpperCase()));
  const grouped = new Map<string, ResearchDocument[]>();
  for (const r of all) {
    if (!set.has(r.symbol)) continue;
    const list = grouped.get(r.symbol) ?? [];
    if (list.length < limitPerSymbol) {
      list.push(r);
      grouped.set(r.symbol, list);
    }
  }
  return Array.from(grouped.values()).flat();
}

export async function getResearchSummaryForUser(clerkUserId: string): Promise<{
  symbols: Array<{
    symbol: string;
    docCount: number;
    lastFetchedAt: Date | null;
    sample: ResearchDocument[];
  }>;
  totalDocs: number;
}> {
  const portfolio = await getUserAccountsDetailed(clerkUserId);
  const symbols = Array.from(
    new Set(portfolio.flatMap((a) => a.positions.map((p) => p.symbol))),
  );
  if (symbols.length === 0) return { symbols: [], totalDocs: 0 };

  const all = await db
    .select()
    .from(researchDocuments)
    .orderBy(desc(researchDocuments.fetchedAt));
  const set = new Set(symbols);
  const filtered = all.filter((r) => set.has(r.symbol));

  const grouped = new Map<string, ResearchDocument[]>();
  for (const r of filtered) {
    const list = grouped.get(r.symbol) ?? [];
    list.push(r);
    grouped.set(r.symbol, list);
  }

  return {
    symbols: symbols.map((sym) => {
      const docs = grouped.get(sym) ?? [];
      return {
        symbol: sym,
        docCount: docs.length,
        lastFetchedAt: docs[0]?.fetchedAt ?? null,
        sample: docs.slice(0, 3),
      };
    }),
    totalDocs: filtered.length,
  };
}
