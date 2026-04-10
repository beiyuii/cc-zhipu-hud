import { readFileSync, existsSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { join, dirname, sep } from "node:path";
import { homedir, tmpdir } from "node:os";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readCache, writeCache, readConfig } from "./cache.js";
import { getZhipuBalance, isZhipuMode, getGlmCodingPlanUsage } from "./zhipu.js";
import type { CacheData } from "./cache.js";
import { collectCosts } from "./collector.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// TTL for local cost cache (2 minutes)
const CACHE_TTL_MS = 120_000;
// TTL for external API retry throttle (5 minutes)
const API_RETRY_TTL_MS = 300_000;

// ANSI colors
const FG_GRAY      = "\x1b[38;5;245m";
const FG_GRAY_DIM  = "\x1b[38;5;102m";
const FG_YELLOW    = "\x1b[38;2;229;192;123m";
const FG_GREEN     = "\x1b[38;5;29m";
const FG_ORANGE    = "\x1b[38;5;208m";
const FG_RED       = "\x1b[38;5;167m";
const FG_MODEL     = "\x1b[38;2;202;124;94m";
const FG_CYAN      = "\x1b[38;5;109m";
const FG_WHITE     = "\x1b[38;5;255m";
const FG_MAGENTA   = "\x1b[38;5;171m";
const RESET        = "\x1b[0m";
const DIM          = "\x1b[2m";

const SEPARATOR = ` ${FG_GRAY_DIM}│${RESET} `;

// Unicode characters for progress bar
const BLOCK_FULL = "█";
const BLOCK_EMPTY = "░";

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

export function formatCNY(n: number): string {
  if (n >= 1000) return "¥" + Math.round(n).toLocaleString("en-US");
  if (n >= 100) return "¥" + n.toFixed(0);
  return "¥" + n.toFixed(1);
}

/**
 * Generate a visual progress bar
 * @param percent - Percentage (0-100)
 * @param width - Total width in characters
 * @returns Progress bar string like "████░░░░"
 */
export function formatBar(percent: number, width = 10): string {
  const clamped = Math.max(0, Math.min(100, percent));
  const filled = Math.round(clamped / 100 * width);
  const empty = width - filled;
  return BLOCK_FULL.repeat(filled) + BLOCK_EMPTY.repeat(empty);
}

/**
 * Get color for percentage-based display
 */
export function pctColor(pct: number): string {
  if (pct >= 80) return FG_RED;
  if (pct >= 60) return FG_ORANGE;
  return FG_GREEN;
}

export function ctxColor(pct: number): string {
  return pctColor(pct);
}

export function formatCountdown(resetsAtMs: number): string {
  const remainingMs = resetsAtMs - Date.now();
  if (remainingMs <= 0) return "~0:00";
  const totalMinutes = Math.ceil(remainingMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `-${hours}:${String(minutes).padStart(2, "0")}`;
}

export function shouldRefreshLocalCostCache(
  cache: CacheData | null,
  transcriptPath = "",
  now = Date.now(),
): boolean {
  if (!cache) return true;

  const cacheUpdatedAt = new Date(cache.updatedAt).getTime();
  if (isNaN(cacheUpdatedAt)) return true;

  if (transcriptPath) {
    try {
      const transcriptMtime = statSync(transcriptPath).mtimeMs;
      if (transcriptMtime > cacheUpdatedAt) return true;
    } catch { }
  }

  return now - cacheUpdatedAt >= CACHE_TTL_MS;
}

/**
 * Get git status: current branch and whether working dir is dirty
 */
function getGitStatus(): { branch: string; dirty: boolean } | null {
  try {
    const branch = execSync("git rev-parse --abbrev-ref HEAD", { encoding: "utf-8", timeout: 1000 }).trim();
    const status = execSync("git status --porcelain", { encoding: "utf-8", timeout: 1000 }).trim();
    return { branch, dirty: status.length > 0 };
  } catch {
    return null;
  }
}

// ccclub rank fetcher — split cache: data persists, retry throttled
function getCcclubRank(): { rank: number; total: number; cost: number } | null {
  const configPath = join(homedir(), ".ccclub", "config.json");
  if (!existsSync(configPath)) return null;
  const cacheFile = join(tmpdir(), "sl-ccclub-rank");
  const now = Date.now();
  let staleData: { rank: number; total: number; cost: number } | null = null;
  let lastAttempt = 0;
  if (existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(readFileSync(cacheFile, "utf-8"));
      staleData = cached.data ?? null;
      lastAttempt = cached.lastAttempt || cached.timestamp || 0;
      if (now - lastAttempt < API_RETRY_TTL_MS) return staleData;
    } catch { }
  }
  try { writeFileSync(cacheFile, JSON.stringify({ data: staleData, timestamp: staleData ? (lastAttempt || now) : 0, lastAttempt: now }), "utf-8"); } catch {}
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
    writeFileSync(cacheFile, JSON.stringify({ data: result, timestamp: now, lastAttempt: now }), "utf-8");
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

// Claude usage fetcher — token-aware cache: detects token rotation to retry immediately
function getClaudeUsage(): { fiveHour: number; sevenDay: number; fiveHourResetsAt?: number } | null {
  const cacheFile = join(tmpdir(), "sl-claude-usage");
  const hitFile = join(tmpdir(), "sl-claude-usage-hit");
  const now = Date.now();
  let staleData: { fiveHour: number; sevenDay: number; fiveHourResetsAt?: number } | null = null;
  let lastAttempt = 0;
  let cachedTokenPrefix = "";
  if (existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(readFileSync(cacheFile, "utf-8"));
      staleData = cached.data ?? null;
      lastAttempt = cached.lastAttempt || 0;
      cachedTokenPrefix = cached.tokenPrefix || "";
    } catch { }
  }

  // Get current token (macOS only - skip on Windows)
  let accessToken = "";
  const platform = process.platform;
  if (platform !== "darwin") {
    return staleData;
  }
  try {
    const username = process.env.USER || process.env.USERNAME;
    const keychainCmd = `security find-generic-password -s "Claude Code-credentials" -a "${username}" -w 2>/dev/null`;
    const credentialsJSON = execSync(keychainCmd, { encoding: "utf-8", timeout: 2000 }).trim();
    if (!credentialsJSON) return staleData;
    const credentials = JSON.parse(credentialsJSON);
    accessToken = credentials.claudeAiOauth?.accessToken || "";
    if (!accessToken) return staleData;
    const expiresAt = credentials.claudeAiOauth?.expiresAt;
    if (expiresAt && now > expiresAt) return staleData;
  } catch {
    return staleData;
  }

  const currentTokenPrefix = accessToken.slice(-20);
  const tokenChanged = cachedTokenPrefix && currentTokenPrefix !== cachedTokenPrefix;

  if (!tokenChanged && lastAttempt && now - lastAttempt < API_RETRY_TTL_MS) return staleData;

  try { writeFileSync(cacheFile, JSON.stringify({ data: staleData, lastAttempt: now, tokenPrefix: currentTokenPrefix }), "utf-8"); } catch {}

  try {
    const apiUrl = "https://api.anthropic.com/api/oauth/usage";
    const curlCmd = `curl -sf "${apiUrl}" -H "Authorization: Bearer ${accessToken}" -H "anthropic-beta: oauth-2025-04-20"`;
    const response = execSync(curlCmd, { encoding: "utf-8", timeout: 5000 });
    if (!response) return staleData;
    const data = JSON.parse(response);
    try { writeFileSync(join(tmpdir(), "sl-claude-usage-raw"), JSON.stringify(data, null, 2), "utf-8"); } catch {}
    const parseUtil = (val: any): number => {
      if (typeof val === "number") return Math.round(val);
      if (typeof val === "string") return Math.round(parseFloat(val.replace("%", "")));
      return 0;
    };
    const fiveHour = parseUtil(data.five_hour?.utilization);
    const sevenDay = parseUtil(data.seven_day?.utilization);

    let fiveHourResetsAt: number | undefined;
    const resetsAtRaw = data.five_hour?.resets_at ?? data.five_hour?.reset_at ?? data.five_hour?.next_reset;
    if (resetsAtRaw) {
      const ts = typeof resetsAtRaw === "string" ? new Date(resetsAtRaw).getTime() : resetsAtRaw * 1000;
      if (!isNaN(ts) && ts > now) fiveHourResetsAt = ts;
    }

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
      try { if (existsSync(hitFile)) unlinkSync(hitFile); } catch {}
    }

    const result: { fiveHour: number; sevenDay: number; fiveHourResetsAt?: number } = { fiveHour, sevenDay };
    if (fiveHourResetsAt) result.fiveHourResetsAt = fiveHourResetsAt;
    writeFileSync(cacheFile, JSON.stringify({ data: result, lastAttempt: now, tokenPrefix: currentTokenPrefix }), "utf-8");
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
  const modelName = (data.model?.display_name ?? "—").replace(/\s*\((\d+[KMB])\s+context\)/i, " ($1)");
  const contextPct = Math.floor(data.context_window?.used_percentage ?? 0);

  // Calculate total tokens from context_window
  const totalInputTokens = data.context_window?.total_input_tokens ?? 0;
  const totalOutputTokens = data.context_window?.total_output_tokens ?? 0;
  const finalTokens = totalInputTokens + totalOutputTokens;

  const transcriptPath = data.transcript_path ?? "";

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

  // Refresh local cost cache if stale
  let cache = readCache();
  if (shouldRefreshLocalCostCache(cache, transcriptPath)) {
    try {
      const result = collectCosts();
      if (result.cost7d > 0 || result.cost30d > 0 || !cache) {
        const newCache = { cost7d: result.cost7d, cost30d: result.cost30d, updatedAt: new Date().toISOString() };
        writeCache(newCache);
        cache = newCache;
      }
    } catch {}
  }

  const config = readConfig();
  const g = FG_GRAY_DIM;
  const y = FG_YELLOW;
  const m = FG_MODEL;
  const r = RESET;
  const cx = pctColor(contextPct);

  // Line 1: [Model] │ Project │ Git
  const line1Parts: string[] = [];

  // Model badge
  line1Parts.push(`${FG_CYAN}[${modelName}]${r}`);

  // Project path (last directory only) - use cross-platform approach
  const projectPath = process.cwd().split(sep).pop() || ".";
  line1Parts.push(`${FG_YELLOW}${projectPath}${r}`);

  // Git status
  const git = getGitStatus();
  if (git) {
    const dirty = git.dirty ? `${FG_RED}*${r}` : "";
    line1Parts.push(`${g}git:(${FG_CYAN}${git.branch}${r}${dirty})`);
  }

  // Line 2: Context ███░░ 45% │ Balance │ Cost
  const line2Parts: string[] = [];

  // Context progress bar with token count
  const bar = formatBar(contextPct);
  const tokenStr = finalTokens > 0 ? formatTokens(finalTokens) : "";
  line2Parts.push(`${DIM}Context${r} ${cx}${bar}${r} ${cx}${contextPct}%${tokenStr ? ` ${cx}${tokenStr}${r}` : ""}`);

  // GLM Coding Plan usage (if using Zhipu proxy)
  if (isZhipuMode()) {
    const glmUsage = getGlmCodingPlanUsage();
    if (glmUsage) {
      // 5-hour rolling usage with progress bar
      const fiveBar = formatBar(glmUsage.fiveHourPercent, 8);
      const fiveColor = pctColor(glmUsage.fiveHourPercent);
      line2Parts.push(`${fiveColor}5h:${fiveBar} ${glmUsage.fiveHourPercent}%${r}`);

      // Weekly usage with progress bar
      const weeklyBar = formatBar(glmUsage.weeklyPercent, 8);
      const weeklyColor = pctColor(glmUsage.weeklyPercent);
      line2Parts.push(`${weeklyColor}7d:${weeklyBar} ${glmUsage.weeklyPercent}%${r}`);
    }

    // Zhipu token packages hidden (too long)
  } else {
    // Claude usage (only if not using Zhipu)
    const claudeUsage = getClaudeUsage();
    if (claudeUsage) {
      if (claudeUsage.fiveHour >= 100 && claudeUsage.fiveHourResetsAt) {
        const countdown = formatCountdown(claudeUsage.fiveHourResetsAt);
        line2Parts.push(`${FG_RED}5h:${countdown}${r}`);
      } else {
        const c5 = pctColor(claudeUsage.fiveHour);
        line2Parts.push(`${c5}5h:${claudeUsage.fiveHour}%${r}`);
      }
      const c7 = pctColor(claudeUsage.sevenDay);
      line2Parts.push(`${c7}7d:${claudeUsage.sevenDay}%${r}`);
    }
  }

  // Period cost hidden (too long)

  // ccclub rank (append to line 2)
  const ccclubRank = getCcclubRank();
  if (ccclubRank) {
    const rc = rankColor(ccclubRank.rank);
    line2Parts.push(`${rc}#${ccclubRank.rank} ${formatCost(ccclubRank.cost)}${r}`);
  }

  const line1 = " " + line1Parts.join(SEPARATOR);
  const line2 = " " + line2Parts.join(SEPARATOR);

  return line1 + "\n" + line2;
}
