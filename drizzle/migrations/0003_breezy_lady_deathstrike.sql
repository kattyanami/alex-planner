ALTER TABLE "instruments" ADD COLUMN "price_source" varchar(20) DEFAULT 'tagger';--> statement-breakpoint
ALTER TABLE "instruments" ADD COLUMN "price_updated_at" timestamp;