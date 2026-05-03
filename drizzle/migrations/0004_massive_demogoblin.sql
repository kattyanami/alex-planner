CREATE TABLE "research_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"symbol" varchar(20) NOT NULL,
	"source" varchar(50) NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"content" text,
	"hash" varchar(64) NOT NULL,
	"published_at" timestamp,
	"fetched_at" timestamp DEFAULT now() NOT NULL,
	"metadata" jsonb,
	CONSTRAINT "research_symbol_hash_unique" UNIQUE("symbol","hash")
);
--> statement-breakpoint
ALTER TABLE "research_documents" ADD CONSTRAINT "research_documents_symbol_instruments_symbol_fk" FOREIGN KEY ("symbol") REFERENCES "public"."instruments"("symbol") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_research_symbol_fetched" ON "research_documents" USING btree ("symbol","fetched_at");