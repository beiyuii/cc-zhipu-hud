import { readFileSync } from "node:fs";
import { readCache, readConfig } from "./cache.js";

// ANSI colors (matching original statusline.sh)
const FG_GRAY      = "\x1b[38;5;245m";
const FG_GRAY_DIM  = "\x1b[38;5;102m";
const FG_YELLOW    = "\x1b[38;2;229;192;123m";
const FG_GREEN     = "\x1b[38;5;29m";
const FG_ORANGE    = "\x1b[38;5;208m";
const FG_RED       = "\x1b[38;5;167m";
const FG_MODEL     = "\x1b[38;2;202;124;94m";
const FG_CYAN      = "\x1b[38;5;109m";
const RESET        = "\x1b[0m";

function formatTokens(t: number): string {
  if (t >= 1_000_000) return (t / 1_000_000).toFixed(1) + "M";
  if (t >= 1_000) return (t / 1_000).toFixed(1) + "k";
  return String(t);
}

function formatCost(n: number): string {
  if (n >= 1000) return "$" + Math.round(n).toLocaleString("en-US");
  if (n >= 100) return "$" + n.toFixed(0);
  if (n >= 10) return "$" + n.toFixed(1);
  return "$" + n.toFixed(2);
}

function ctxColor(pct: number): string {
  if (pct >= 80) return FG_RED;
  if (pct >= 60) return FG_ORANGE;
  return FG_GREEN;
}

export function render(input: string): string {
  let data: any;
  try {
    data = JSON.parse(input);
  } catch {
    return "";
  }

  // Session data from Claude Code stdin
  const cost = data.cost?.total_cost_usd ?? 0;
  const linesAdd = data.cost?.total_lines_added ?? 0;
  const linesDel = data.cost?.total_lines_removed ?? 0;
  const model = data.model?.display_name ?? "—";
  const contextPct = Math.floor(data.context_window?.used_percentage ?? 0);

  // Token stats from transcript
  let inTokens = 0;
  let outTokens = 0;
  const transcriptPath = data.transcript_path ?? "";

  if (transcriptPath) {
    try {
      const content = readFileSync(transcriptPath, "utf-8");
      const lines = content.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const entry = JSON.parse(line);
          if (entry.type === "assistant" && entry.message?.usage) {
            inTokens += entry.message.usage.input_tokens || 0;
            outTokens += entry.message.usage.output_tokens || 0;
          }
        } catch {
          // skip malformed lines
        }
      }
    } catch {
      // transcript not readable
    }
  }

  const inFmt = formatTokens(inTokens);
  const outFmt = formatTokens(outTokens);

  // Cached cost data
  const cache = readCache();
  const config = readConfig();

  let costSuffix = "";
  if (cache) {
    const { period } = config;
    if (period === "7d") {
      costSuffix = ` ${FG_CYAN}(7d:${formatCost(cache.cost7d)})${RESET}`;
    } else if (period === "30d") {
      costSuffix = ` ${FG_CYAN}(30d:${formatCost(cache.cost30d)})${RESET}`;
    } else {
      costSuffix = ` ${FG_CYAN}(7d:${formatCost(cache.cost7d)} 30d:${formatCost(cache.cost30d)})${RESET}`;
    }
  }

  const parts = [
    `${FG_GRAY_DIM}Token: ↑${inFmt} ↓${outFmt}${RESET}`,
    `${FG_YELLOW}${formatCost(cost)}${costSuffix}${RESET}`,
    `${FG_GRAY_DIM}Code: ${FG_GREEN}+${linesAdd}${RESET} ${FG_GRAY_DIM}-${linesDel}${RESET}`,
    `${ctxColor(contextPct)}${contextPct}%${RESET} ${FG_GRAY_DIM}by${RESET} ${FG_MODEL}${model}${RESET}`,
  ];

  return "\n " + parts.join(` ${FG_GRAY}|${RESET} `) + "\n";
}
