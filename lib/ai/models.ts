/**
 * Model registry — direct OpenAI API (uses OPENAI_API_KEY env var).
 *
 * All agents use gpt-5-mini for the personal-use cost profile.
 * If Reporter/Planner output quality lags, swap them up to gpt-5 individually.
 */

import { openai } from "@ai-sdk/openai";

export const MODELS = {
  tagger: openai("gpt-5-mini"),
  charter: openai("gpt-5-mini"),
  planner: openai("gpt-5-mini"),
  reporter: openai("gpt-5-mini"),
  retirement: openai("gpt-5-mini"),
  researcher: openai("gpt-5-mini"),
};

export type AgentName = keyof typeof MODELS;
