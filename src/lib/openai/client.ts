import "server-only";

import OpenAI from "openai";
import { ConfigurationError } from "@/lib/errors";

let client: OpenAI | null = null;

export function getOpenAIClient() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new ConfigurationError("OpenAI is not configured. Add OPENAI_API_KEY or use the seeded demo.");
  }

  client ??= new OpenAI({ apiKey, timeout: 35_000, maxRetries: 1 });
  return client;
}

export function getOpenAIModel() {
  return process.env.OPENAI_MODEL?.trim() || "gpt-5.6";
}

export function getOpenAIModerationModel() {
  return process.env.OPENAI_MODERATION_MODEL?.trim() || "omni-moderation-latest";
}

export function getOpenAIRealtimeModel() {
  return process.env.OPENAI_REALTIME_MODEL?.trim() || "gpt-realtime-2.1";
}
