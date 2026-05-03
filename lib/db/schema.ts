import { sql } from "drizzle-orm";
import {
  date,
  decimal,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  clerkUserId: varchar("clerk_user_id", { length: 255 }).primaryKey(),
  displayName: varchar("display_name", { length: 255 }),
  yearsUntilRetirement: integer("years_until_retirement"),
  targetRetirementIncome: decimal("target_retirement_income", {
    precision: 12,
    scale: 2,
  }),
  currentAge: integer("current_age"),
  annualContribution: decimal("annual_contribution", {
    precision: 12,
    scale: 2,
  }),
  assetClassTargets: jsonb("asset_class_targets").default(
    sql`'{"equity": 70, "fixed_income": 30}'::jsonb`,
  ),
  regionTargets: jsonb("region_targets").default(
    sql`'{"north_america": 50, "international": 50}'::jsonb`,
  ),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const instruments = pgTable("instruments", {
  symbol: varchar("symbol", { length: 20 }).primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  instrumentType: varchar("instrument_type", { length: 50 }),
  currentPrice: decimal("current_price", { precision: 12, scale: 4 }),
  priceSource: varchar("price_source", { length: 20 }).default("tagger"),
  priceUpdatedAt: timestamp("price_updated_at"),
  allocationRegions: jsonb("allocation_regions").default(sql`'{}'::jsonb`),
  allocationSectors: jsonb("allocation_sectors").default(sql`'{}'::jsonb`),
  allocationAssetClass: jsonb("allocation_asset_class").default(
    sql`'{}'::jsonb`,
  ),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const accounts = pgTable(
  "accounts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: varchar("clerk_user_id", { length: 255 })
      .references(() => users.clerkUserId, { onDelete: "cascade" })
      .notNull(),
    accountName: varchar("account_name", { length: 255 }).notNull(),
    accountPurpose: text("account_purpose"),
    cashBalance: decimal("cash_balance", { precision: 12, scale: 2 }).default(
      "0",
    ),
    cashInterest: decimal("cash_interest", { precision: 5, scale: 4 }).default(
      "0",
    ),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [index("idx_accounts_user").on(t.clerkUserId)],
);

export const positions = pgTable(
  "positions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    accountId: uuid("account_id")
      .references(() => accounts.id, { onDelete: "cascade" })
      .notNull(),
    symbol: varchar("symbol", { length: 20 })
      .references(() => instruments.symbol)
      .notNull(),
    quantity: decimal("quantity", { precision: 20, scale: 8 }).notNull(),
    asOfDate: date("as_of_date").defaultNow(),
    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    index("idx_positions_account").on(t.accountId),
    index("idx_positions_symbol").on(t.symbol),
    unique("positions_account_symbol_unique").on(t.accountId, t.symbol),
  ],
);

export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: varchar("clerk_user_id", { length: 255 })
      .references(() => users.clerkUserId, { onDelete: "cascade" })
      .notNull(),
    jobType: varchar("job_type", { length: 50 }).notNull(),
    status: varchar("status", { length: 20 }).default("pending"),
    requestPayload: jsonb("request_payload"),
    reportPayload: jsonb("report_payload"),
    chartsPayload: jsonb("charts_payload"),
    retirementPayload: jsonb("retirement_payload"),
    summaryPayload: jsonb("summary_payload"),
    errorMessage: text("error_message"),
    createdAt: timestamp("created_at").defaultNow(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    updatedAt: timestamp("updated_at").defaultNow(),
  },
  (t) => [
    index("idx_jobs_user").on(t.clerkUserId),
    index("idx_jobs_status").on(t.status),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Instrument = typeof instruments.$inferSelect;
export type NewInstrument = typeof instruments.$inferInsert;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Position = typeof positions.$inferSelect;
export type NewPosition = typeof positions.$inferInsert;
export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;

export const activityEvents = pgTable(
  "activity_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clerkUserId: varchar("clerk_user_id", { length: 255 })
      .references(() => users.clerkUserId, { onDelete: "cascade" })
      .notNull(),
    kind: varchar("kind", { length: 50 }).notNull(),
    description: text("description").notNull(),
    metadata: jsonb("metadata"),
    createdAt: timestamp("created_at").defaultNow(),
  },
  (t) => [index("idx_activity_user_created").on(t.clerkUserId, t.createdAt)],
);

export type ActivityEvent = typeof activityEvents.$inferSelect;
export type NewActivityEvent = typeof activityEvents.$inferInsert;

export const researchDocuments = pgTable(
  "research_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    symbol: varchar("symbol", { length: 20 })
      .references(() => instruments.symbol, { onDelete: "cascade" })
      .notNull(),
    source: varchar("source", { length: 50 }).notNull(),
    url: text("url").notNull(),
    title: text("title").notNull(),
    content: text("content"),
    hash: varchar("hash", { length: 64 }).notNull(),
    publishedAt: timestamp("published_at"),
    fetchedAt: timestamp("fetched_at").defaultNow().notNull(),
    metadata: jsonb("metadata"),
  },
  (t) => [
    index("idx_research_symbol_fetched").on(t.symbol, t.fetchedAt),
    unique("research_symbol_hash_unique").on(t.symbol, t.hash),
  ],
);

export type ResearchDocument = typeof researchDocuments.$inferSelect;
export type NewResearchDocument = typeof researchDocuments.$inferInsert;
