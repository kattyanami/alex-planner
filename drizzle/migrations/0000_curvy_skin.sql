CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"account_name" varchar(255) NOT NULL,
	"account_purpose" text,
	"cash_balance" numeric(12, 2) DEFAULT '0',
	"cash_interest" numeric(5, 4) DEFAULT '0',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "instruments" (
	"symbol" varchar(20) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"instrument_type" varchar(50),
	"current_price" numeric(12, 4),
	"allocation_regions" jsonb DEFAULT '{}'::jsonb,
	"allocation_sectors" jsonb DEFAULT '{}'::jsonb,
	"allocation_asset_class" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"job_type" varchar(50) NOT NULL,
	"status" varchar(20) DEFAULT 'pending',
	"request_payload" jsonb,
	"report_payload" jsonb,
	"charts_payload" jsonb,
	"retirement_payload" jsonb,
	"summary_payload" jsonb,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"started_at" timestamp,
	"completed_at" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "positions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_id" uuid NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"quantity" numeric(20, 8) NOT NULL,
	"as_of_date" date DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "positions_account_symbol_unique" UNIQUE("account_id","symbol")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"clerk_user_id" varchar(255) PRIMARY KEY NOT NULL,
	"display_name" varchar(255),
	"years_until_retirement" integer,
	"target_retirement_income" numeric(12, 2),
	"asset_class_targets" jsonb DEFAULT '{"equity": 70, "fixed_income": 30}'::jsonb,
	"region_targets" jsonb DEFAULT '{"north_america": 50, "international": 50}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_clerk_user_id_users_clerk_user_id_fk" FOREIGN KEY ("clerk_user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_clerk_user_id_users_clerk_user_id_fk" FOREIGN KEY ("clerk_user_id") REFERENCES "public"."users"("clerk_user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "positions" ADD CONSTRAINT "positions_symbol_instruments_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "public"."instruments"("symbol") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_accounts_user" ON "accounts" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "idx_jobs_user" ON "jobs" USING btree ("clerk_user_id");--> statement-breakpoint
CREATE INDEX "idx_jobs_status" ON "jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_positions_account" ON "positions" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "idx_positions_symbol" ON "positions" USING btree ("symbol");