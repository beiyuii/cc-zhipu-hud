import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { calculateCost } from "./calculator.js";

const CLAUDE_PROJECTS_DIR = ".claude/projects";

interface CollectResult {
  cost7d: number;
  cost30d: number;
}

/** Recursively find all .jsonl files under a directory */
function findJsonlFiles(dir: string): string[] {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      results.push(...findJsonlFiles(full));
    } else if (entry.endsWith(".jsonl")) {
      results.push(full);
    }
  }
  return results;
}

export function collectCosts(): CollectResult {
  const projectsDir = join(homedir(), CLAUDE_PROJECTS_DIR);
  const files = findJsonlFiles(projectsDir);

  if (files.length === 0) {
    return { cost7d: 0, cost30d: 0 };
  }

  const now = Date.now();
  const cutoff7d = now - 7 * 24 * 60 * 60 * 1000;
  const cutoff30d = now - 30 * 24 * 60 * 60 * 1000;

  let cost7d = 0;
  let cost30d = 0;

  // Deduplication set (same as ccclub)
  const seen = new Set<string>();

  for (const file of files) {
    let content: string;
    try {
      content = readFileSync(file, "utf-8");
    } catch {
      continue;
    }

    const lines = content.split("\n");
    for (const line of lines) {
      if (!line.trim()) continue;

      let parsed: any;
      try {
        parsed = JSON.parse(line);
      } catch {
        continue;
      }

      if (parsed.type !== "assistant" || !parsed.message?.usage) continue;

      const ts = new Date(parsed.timestamp).getTime();
      if (isNaN(ts) || ts < cutoff30d) continue;

      const usage = parsed.message.usage;
      const requestId = parsed.requestId || "";
      const sessionId = parsed.sessionId || "";
      const dedupeKey = requestId
        ? `${sessionId}:${requestId}`
        : `${sessionId}:${parsed.timestamp}:${usage.input_tokens}:${usage.output_tokens}`;

      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);

      const model: string = parsed.message.model || "unknown";
      const inputTokens: number = usage.input_tokens || 0;
      const outputTokens: number = usage.output_tokens || 0;
      const cacheCreationTokens: number = usage.cache_creation_input_tokens || 0;
      const cacheReadTokens: number = usage.cache_read_input_tokens || 0;

      const cost = calculateCost(model, inputTokens, outputTokens, cacheCreationTokens, cacheReadTokens);

      cost30d += cost;
      if (ts >= cutoff7d) {
        cost7d += cost;
      }
    }
  }

  return { cost7d, cost30d };
}
