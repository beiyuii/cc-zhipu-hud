import { readFileSync, existsSync, statSync, writeFileSync, unlinkSync } from "node:fs";
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

export function formatTokens(t: number): string {
  if (t >= 1_000_000) return (t / 1_000_000).toFixed(1) + "M";
  if (t >= 1_000) return (t / 1_000).toFixed(1) + "k";
  return String(t);
}

export function formatCost(n: number): string {
  if (n >= 1000) return "$" + Math.round(n).toLocaleString("en-US");
  if (n >= 100) return "$" + n.toFixed(0);
  if (n >= 10) return "$" + n.toFixed(1);
  return "$" + n.toFixed(2);
}

export function ctxColor(pct: number): string {
  if (pct >= 80) return FG_RED;
  if (pct >= 60) return FG_ORANGE;
  return FG_GREEN;
}

export function formatCountdown(resetsAtMs: number): string {
  const remainingMs = resetsAtMs - Date.now();
  if (remainingMs <= 0) return "~0:00";
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `-${hours}:${String(minutes).padStart(2, "0")}`;
}

// ccclub rank fetcher — cached per session (stale fallback on failure)
function getCcclubRank(sessionId: string): { rank: number; total: number; cost: number } | null {
  const configPath = join(homedir(), ".ccclub", "config.json");
  if (!existsSync(configPath)) return null;
  const cacheFile = "/tmp/sl-ccclub-rank";
  let staleData: { rank: number; total: number; cost: number } | null = null;
  if (existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(readFileSync(cacheFile, "utf-8"));
      staleData = cached.data ?? null;
      if (cached.sessionId === sessionId) return staleData;
    } catch { }
  }
  try {
    const config = JSON.parse(readFileSync(configPath, "utf-8"));
    const code = config.groups?.[0];
    const userId = config.userId;
    if (!code || !userId) return staleData;
    const tz = -(new Date()).getTimezoneOffset();
    const url = `${config.apiUrl}/api/rank/${code}?period=today&tz=${tz}`;
    const response = execSync(`curl -sf "${url}"`, { encoding: "utf-8", timeout: 5000 });
    if (!response) return staleData;
    const data = JSON.parse(response);
    const rankings = data.rankings || [];
    const me = rankings.find((r: any) => r.userId === userId);
    if (!me) return staleData;
    const result = { rank: me.rank, total: rankings.length, cost: me.costUSD };
    writeFileSync(cacheFile, JSON.stringify({ sessionId, data: result }), "utf-8");
    return result;
  } catch {
    return staleData;
  }
}

export function rankColor(rank: number): string {
  if (rank === 1) return FG_YELLOW;
  if (rank === 2) return FG_WHITE;
  if (rank === 3) return FG_ORANGE;
  return FG_CYAN;
}

// Claude usage fetcher — cached per session (stale fallback on failure)
function getClaudeUsage(sessionId: string): { fiveHour: number; sevenDay: number; fiveHourResetsAt?: number } | null {
  const cacheFile = "/tmp/sl-claude-usage";
  const hitFile = "/tmp/sl-claude-usage-hit";
  const now = Date.now();
  let staleData: { fiveHour: number; sevenDay: number; fiveHourResetsAt?: number } | null = null;
  if (existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(readFileSync(cacheFile, "utf-8"));
      staleData = cached.data ?? null;
      if (cached.sessionId === sessionId) return staleData;
    } catch { }
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
    const fiveHour = parseUtil(data.five_hour?.utilization);
    const sevenDay = parseUtil(data.seven_day?.utilization);

    let fiveHourResetsAt: number | undefined;

    // Strategy 1: Use reset time from API if available
    const resetsAtRaw = data.five_hour?.resets_at ?? data.five_hour?.reset_at ?? data.five_hour?.next_reset;
    if (resetsAtRaw) {
      const ts = typeof resetsAtRaw === "string" ? new Date(resetsAtRaw).getTime() : resetsAtRaw * 1000;
      if (!isNaN(ts) && ts > now) fiveHourResetsAt = ts;
    }

    // Strategy 2: Fallback - track when we first saw 100%
    if (fiveHour >= 100) {
      if (!fiveHourResetsAt) {
        if (existsSync(hitFile)) {
          const hitTime = parseFloat(readFileSync(hitFile, "utf-8").trim());
          if (!isNaN(hitTime)) {
            fiveHourResetsAt = hitTime + 5 * 3600 * 1000;
          }
        } else {
          writeFileSync(hitFile, String(now), "utf-8");
          fiveHourResetsAt = now + 5 * 3600 * 1000;
        }
      }
    } else {
      // Usage dropped below 100%, clear hit tracker
      try { if (existsSync(hitFile)) unlinkSync(hitFile); } catch {}
    }

    const result: { fiveHour: number; sevenDay: number; fiveHourResetsAt?: number } = { fiveHour, sevenDay };
    if (fiveHourResetsAt) result.fiveHourResetsAt = fiveHourResetsAt;
    writeFileSync(cacheFile, JSON.stringify({ sessionId, data: result }), "utf-8");
    return result;
  } catch {
    return staleData;
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

  // Session ID from transcript path (filename without extension)
  const transcriptPath = data.transcript_path ?? "";
  const sessionId = transcriptPath ? transcriptPath.replace(/^.*\//, "").replace(/\.jsonl$/, "") : "";

  // Token stats from transcript
  let totalTokens = 0;
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
  const claudeUsage = getClaudeUsage(sessionId);
  const g = FG_GRAY_DIM;
  const y = FG_YELLOW;
  const m = FG_MODEL;
  const gr = FG_GRAY;
  const r = RESET;
  const cx = ctxColor(contextPct);

  const segments: string[] = [];

  // tokens $cost · ctx% Model
  segments.push(`${formatTokens(totalTokens)} ${y}${formatCost(cost)}${r} ${g}·${r} ${cx}${contextPct}%${r} ${m}${model}${r}`);

  // 5h:100% · 7d:26% · 30d:$960
  const usageParts: string[] = [];
  if (claudeUsage) {
    if (claudeUsage.fiveHour >= 100 && claudeUsage.fiveHourResetsAt) {
      const countdown = formatCountdown(claudeUsage.fiveHourResetsAt);
      usageParts.push(`${FG_RED}5h:${countdown}${r}`);
    } else {
      const c5 = ctxColor(claudeUsage.fiveHour);
      usageParts.push(`${c5}5h:${claudeUsage.fiveHour}%${r}`);
    }
    const c7 = ctxColor(claudeUsage.sevenDay);
    usageParts.push(`${c7}7d:${claudeUsage.sevenDay}%${r}`);
  }
  if (cache) {
    const period = config.period || "30d";
    const periodCost = period === "7d" ? cache.cost7d : cache.cost30d;
    usageParts.push(`${y}${period}:${formatCost(periodCost)}${r}`);
  }
  if (usageParts.length > 0) {
    segments.push(usageParts.join(` ${g}·${r} `));
  }

  // #2 $53.6
  const ccclubRank = getCcclubRank(sessionId);
  if (ccclubRank) {
    const rc = rankColor(ccclubRank.rank);
    segments.push(`${rc}#${ccclubRank.rank} ${formatCost(ccclubRank.cost)}${r}`);
  }

  return " " + segments.join(` ${gr}/${r} `);
}
