/**
 * Client-side helper for the streaming agent routes.
 *
 * The server side writes plain markdown chunks, then a sentinel line
 * containing JSON metadata. We separate them on the boundary and
 * surface progressive markdown via onText, final metadata via onMeta.
 */

export const META_SENTINEL = "<<<META>>>";

export type StreamHandlers<TMeta> = {
  onText: (text: string) => void;
  onMeta: (meta: TMeta) => void;
  onError?: (err: Error) => void;
};

export async function streamAgent<TMeta = unknown>(
  url: string,
  handlers: StreamHandlers<TMeta>,
): Promise<{ text: string; meta: TMeta | null }> {
  const res = await fetch(url, { method: "POST" });
  if (!res.ok || !res.body) {
    const err = new Error(
      res.status === 401
        ? "Not authenticated"
        : `Stream failed (${res.status})`,
    );
    handlers.onError?.(err);
    throw err;
  }

  const reader = res.body
    .pipeThrough(new TextDecoderStream())
    .getReader();

  let buffer = "";
  let textPart = "";
  let metaPart: TMeta | null = null;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;

      const idx = buffer.indexOf(META_SENTINEL);
      if (idx === -1) {
        // No sentinel yet — everything is markdown
        textPart += value;
        handlers.onText(textPart);
      } else {
        // Sentinel found — split, flush text portion (only the slice up to it),
        // then drain remaining as metadata
        const newText = buffer.slice(0, idx);
        const metaJson = buffer.slice(idx + META_SENTINEL.length);
        textPart = newText.replace(/\n+$/, "");
        handlers.onText(textPart);
        try {
          metaPart = JSON.parse(metaJson) as TMeta;
        } catch {
          // metadata may still be partial across reads — keep buffering
          // and try again on the next chunk
          buffer = buffer.slice(idx);
          continue;
        }
        handlers.onMeta(metaPart);
        return { text: textPart, meta: metaPart };
      }
    }
  } catch (err) {
    handlers.onError?.(err instanceof Error ? err : new Error("Stream error"));
    throw err;
  }

  // Stream ended without sentinel — treat whatever we have as final text
  return { text: textPart, meta: metaPart };
}
