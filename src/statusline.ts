import { readFileSync, existsSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
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
const FG_WHITE     = "\x1b[38;5;255m";
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

// ccclub rank fetcher with 120s file cache
function getCcclubRank(): { rank: number; total: number; cost: number } | null {
  const configPath = join(homedir(), ".ccclub", "config.json");
  if (!existsSync(configPath)) return null;
  const cacheFile = "/tmp/sl-ccclub-rank";
  const now = Date.now() / 1000;
  if (existsSync(cacheFile)) {
    const mtime = statSync(cacheFile).mtimeMs / 1000;
    if (now - mtime <= 120) {
      try {
        return JSON.parse(readFileSync(cacheFile, "utf-8"));
      } catch { }
    }
  }
  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const code = config.groups?.[0];
    const userId = config.userId;
    if (!code || !userId) return null;
    const tz = -(new Date()).getTimezoneOffset();
    const url = `${config.apiUrl}/api/rank/${code}?period=today&tz=${tz}`;
    const response = execSync(`curl -sf "${url}"`, { encoding: "utf-8", timeout: 5000 });
    if (!response) return null;
    const data = JSON.parse(response);
    const rankings = data.rankings || [];
    const me = rankings.find((r: any) => r.userId === userId);
    if (!me) return null;
    const result = { rank: me.rank, total: rankings.length, cost: me.costUSD };
    writeFileSync(cacheFile, JSON.stringify(result), "utf-8");
    return result;
  } catch {
    return null;
  }
}

function rankColor(rank: number): string {
  if (rank === 1) return FG_YELLOW;
  if (rank === 2) return FG_WHITE;
  if (rank === 3) return FG_ORANGE;
  return FG_CYAN;
}

// Claude usage fetcher with 60s file cache
function getClaudeUsage(): { fiveHour: number; sevenDay: number } | null {
  const cacheFile = "/tmp/sl-claude-usage";
  const now = Date.now() / 1000;
  if (existsSync(cacheFile)) {
    const mtime = statSync(cacheFile).mtimeMs / 1000;
    if (now - mtime <= 60) {
      try {
        return JSON.parse(readFileSync(cacheFile, "utf-8"));
      } catch { }
    }
  }
  try {
    const username = process.env.USER || process.env.USERNAME;
    const keychainCmd = `security find-generic-password -s "Claude Code-credentials" -a "${username}" -w 2>/dev/null`;
    const credentialsJSON = execSync(keychainCmd, { encoding: "utf-8", timeout: 2000 }).trim();
    if (!credentialsJSON) return null;
    const credentials = JSON.parse(credentialsJSON);
    const accessToken = credentials.claudeAiOauth?.accessToken;
    if (!accessToken) return null;
    const expiresAt = credentials.claudeAiOauth?.expiresAt;
    if (expiresAt && Date.now() / 1000 > expiresAt) return null;
    const apiUrl = "https://api.anthropic.com/api/oauth/usage";
    const curlCmd = `curl -sf "${apiUrl}" -H "Authorization: Bearer ${accessToken}" -H "anthropic-beta: oauth-2025-04-20" -H "User-Agent: claude-code/2.1.5"`;
    const response = execSync(curlCmd, { encoding: "utf-8", timeout: 5000 });
    if (!response) return null;
    const data = JSON.parse(response);
    const parseUtil = (val: any): number => {
      if (typeof val === "number") return Math.round(val);
      if (typeof val === "string") return Math.round(parseFloat(val.replace("%", "")));
      return 0;
    };
    const result = { fiveHour: parseUtil(data.five_hour?.utilization), sevenDay: parseUtil(data.seven_day?.utilization) };
    writeFileSync(cacheFile, JSON.stringify(result), "utf-8");
    return result;
  } catch {
    return null;
  }
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
  const model = data.model?.display_name ?? "—";
  const contextPct = Math.floor(data.context_window?.used_percentage ?? 0);

  // Token stats from transcript
  let totalTokens = 0;
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
            totalTokens += (entry.message.usage.input_tokens || 0) + (entry.message.usage.output_tokens || 0);
          }
        } catch { }
      }
    } catch { }
  }

  const cache = readCache();
  const config = readConfig();
  const claudeUsage = getClaudeUsage();
  const parts: string[] = [];

  // 1. Tokens ~ cost / context % + model
  parts.push(`${FG_GRAY_DIM}${formatTokens(totalTokens)}${RESET} ${FG_GRAY_DIM}~${RESET} ${FG_YELLOW}${formatCost(cost)}${RESET} ${FG_GRAY_DIM}/${RESET} ${ctxColor(contextPct)}${contextPct}%${RESET} ${FG_GRAY_DIM}by${RESET} ${FG_MODEL}${model}${RESET}`);

  // 2. Claude usage limits (colored by utilization)
  if (claudeUsage) {
    parts.push(`${ctxColor(claudeUsage.fiveHour)}5h: ${claudeUsage.fiveHour}%${RESET} ${FG_GRAY_DIM}/${RESET} ${ctxColor(claudeUsage.sevenDay)}7d: ${claudeUsage.sevenDay}%${RESET}`);
  }

  // 3. Period cost (default 30d, configurable)
  if (cache) {
    const period = config.period || "30d";
    const periodCost = period === "7d" ? cache.cost7d : cache.cost30d;
    parts.push(`${FG_YELLOW}${period}: ${formatCost(periodCost)}${RESET}`);
  }

  // 4. ccclub rank (colored by position)
  const ccclubRank = getCcclubRank();
  if (ccclubRank) {
    const rc = rankColor(ccclubRank.rank);
    parts.push(`${rc}#${ccclubRank.rank}/${ccclubRank.total} ${formatCost(ccclubRank.cost)}${RESET}`);
  }

  return "\n " + parts.join(` ${FG_GRAY}|${RESET} `) + "\n";
}
