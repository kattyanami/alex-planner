/**
 * Embedder service.
 *
 * Wraps OpenAI's text-embedding-3-small (1536 dims, $0.02 per 1M tokens).
 * Used by the Researcher to vectorize incoming docs and by the Retriever
 * to embed query strings before similarity search.
 */
import { embed, embedMany } from "ai";
import { openai } from "@ai-sdk/openai";

const embeddingModel = openai.embedding("text-embedding-3-small");

export type EmbeddingResult = {
  values: number[];
  tokens: number;
};

/**
 * Build the text we actually embed for a research document. We mix the
 * title (highest signal) with the optional content body so the vector
 * captures both headline meaning and publisher / context.
 */
export function buildDocText(doc: {
  title: string;
  content?: string | null;
  symbol?: string;
}): string {
  const parts = [doc.symbol ? `[${doc.symbol}]` : null, doc.title, doc.content]
    .filter(Boolean)
    .join("\n\n");
  // Soft cap to avoid runaway tokens on weird inputs. text-embedding-3-small
  // accepts 8K tokens; 4K chars is a comfortable headroom.
  return parts.slice(0, 4000);
}

export async function embedText(text: string): Promise<EmbeddingResult> {
  const { embedding, usage } = await embed({
    model: embeddingModel,
    value: text,
  });
  return { values: embedding, tokens: usage?.tokens ?? 0 };
}

export async function embedBatch(texts: string[]): Promise<{
  embeddings: number[][];
  tokens: number;
}> {
  if (texts.length === 0) return { embeddings: [], tokens: 0 };
  const { embeddings, usage } = await embedMany({
    model: embeddingModel,
    values: texts,
  });
  return {
    embeddings: embeddings.map((e) => e),
    tokens: usage?.tokens ?? 0,
  };
}
