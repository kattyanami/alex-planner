/**
 * Model registry — direct OpenAI API (uses OPENAI_API_KEY env var).
 *
 * Mixed fleet strategy:
 *   - Cheap fleet (gpt-5-mini): Tagger, Charter
 *   - Smart fleet (gpt-5): Planner, Reporter, Retirement, Researcher
 */

import { openai } from "@ai-sdk/openai";

export const MODELS = {
  tagger: openai("gpt-5-mini"),
  charter: openai("gpt-5-mini"),
  planner: openai("gpt-5"),
  reporter: openai("gpt-5"),
  retirement: openai("gpt-5"),
  researcher: openai("gpt-5"),
};

export type AgentName = keyof typeof MODELS;
