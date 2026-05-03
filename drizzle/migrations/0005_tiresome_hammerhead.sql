ALTER TABLE "research_documents" ADD COLUMN "embedding" vector(1536);--> statement-breakpoint
ALTER TABLE "research_documents" ADD COLUMN "embedded_at" timestamp;--> statement-breakpoint
CREATE INDEX "idx_research_embedding_hnsw" ON "research_documents" USING hnsw ("embedding" vector_cosine_ops);