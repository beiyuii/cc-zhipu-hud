import { readFileSync, existsSync, statSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { execSync } from "node:child_process";
import { readCache, writeCache, readConfig } from "./cache.js";
import type { CacheData } from "./cache.js";
import { collectCosts } from "./collector.js";

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
const FG_PURPLE    = "\x1b[38;5;141m";
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

// ccclub rank fetcher
function getCcclubRank(): { rank: number; total: number; cost: number } | null {
  const configPath = join(homedir(), ".ccclub", "config.json");
  if (!existsSync(configPath)) return null;
  const cacheFile = "/tmp/sl-ccclub-rank";
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

// Claude usage fetcher (for official API)
function getClaudeUsage(): { fiveHour: number; sevenDay: number; fiveHourResetsAt?: number } | null {
  const cacheFile = "/tmp/sl-claude-usage";
  const hitFile = "/tmp/sl-claude-usage-hit";
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

  let accessToken = "";
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
    try { writeFileSync("/tmp/sl-claude-usage-raw", JSON.stringify(data, null, 2), "utf-8"); } catch {}
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

// ─── Zhipu AI Balance Fetcher ──────────────────────────────────────────────

interface ZhipuBalance {
  totalBalance: number;      // 总余额（元）
  cashBalance: number;       // 现金余额
  resourceBalance: number;   // 资源包余额
  resourcePackages: Array<{
    name: string;
    balance: number;
    unit: string;
  }>;
}

/**
 * 从 settings.json 获取 API Key
 */
function getZhipuApiKey(): string | null {
  try {
    const settingsPath = join(homedir(), ".claude", "settings.json");
    if (!existsSync(settingsPath)) return null;
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    // ANTHROPIC_AUTH_TOKEN 环境变量或直接配置
    const envToken = settings.env?.ANTHROPIC_AUTH_TOKEN;
    if (envToken) return envToken;
    return null;
  } catch {
    return null;
  }
}

/**
 * 检测是否使用智谱 AI 代理
 */
function isZhipuProxy(): boolean {
  try {
    const settingsPath = join(homedir(), ".claude", "settings.json");
    if (!existsSync(settingsPath)) return false;
    const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
    const baseUrl = settings.env?.ANTHROPIC_BASE_URL || "";
    return baseUrl.includes("bigmodel.cn") || baseUrl.includes("zhipu");
  } catch {
    return false;
  }
}

/**
 * 获取智谱 AI 账户余额
 */
function getZhipuBalance(): ZhipuBalance | null {
  const cacheFile = "/tmp/sl-zhipu-balance";
  const now = Date.now();
  let staleData: ZhipuBalance | null = null;
  let lastAttempt = 0;

  // Read cache
  if (existsSync(cacheFile)) {
    try {
      const cached = JSON.parse(readFileSync(cacheFile, "utf-8"));
      staleData = cached.data ?? null;
      lastAttempt = cached.lastAttempt || 0;
      // Use shorter TTL for balance (1 min) since it changes more frequently
      if (now - lastAttempt < 60_000) return staleData;
    } catch { }
  }

  const apiKey = getZhipuApiKey();
  if (!apiKey) return staleData;

  // Mark attempt
  try { writeFileSync(cacheFile, JSON.stringify({ data: staleData, lastAttempt: now }), "utf-8"); } catch {}

  try {
    // Zhipu balance API endpoint
    const apiUrl = "https://open.bigmodel.cn/api/paas/v4/billing/quota";
    const curlCmd = `curl -sf "${apiUrl}" -H "Authorization: Bearer ${apiKey}" -H "Content-Type: application/json"`;
    const response = execSync(curlCmd, { encoding: "utf-8", timeout: 5000 });

    if (!response) return staleData;

    const data = JSON.parse(response);

    // Parse the response - Zhipu returns balance in various formats
    // Try to extract meaningful balance information
    let totalBalance = 0;
    let cashBalance = 0;
    let resourceBalance = 0;
    const resourcePackages: ZhipuBalance["resourcePackages"] = [];

    // Handle different response formats
    if (data.data) {
      // New API format
      const quotaData = data.data;
      if (Array.isArray(quotaData)) {
        for (const item of quotaData) {
          if (item.type === "CASH") {
            cashBalance = item.balance || 0;
          } else if (item.resourcePackageType) {
            resourcePackages.push({
              name: item.resourcePackageType || item.name || "Resource",
              balance: item.balance || 0,
              unit: item.unit || "tokens",
            });
            resourceBalance += (item.balance || 0);
          }
        }
      } else if (quotaData.cashBalance !== undefined) {
        cashBalance = quotaData.cashBalance || 0;
        resourceBalance = quotaData.resourceBalance || 0;
      }
    } else if (data.balance !== undefined) {
      // Simple format
      totalBalance = data.balance || 0;
    }

    totalBalance = totalBalance || cashBalance + resourceBalance;

    const result: ZhipuBalance = {
      totalBalance,
      cashBalance,
      resourceBalance,
      resourcePackages,
    };

    // Debug: save raw response
    try { writeFileSync("/tmp/sl-zhipu-balance-raw", JSON.stringify(data, null, 2), "utf-8"); } catch {}

    writeFileSync(cacheFile, JSON.stringify({ data: result, lastAttempt: now }), "utf-8");
    return result;
  } catch (error) {
    // Try alternative endpoint
    try {
      const altApiUrl = "https://www.bigmodel.cn/api/biz/account/query-customer-account-report";
      const curlCmd = `curl -sf "${altApiUrl}" -H "Authorization: Bearer ${apiKey}" -H "Content-Type: application/json"`;
      const response = execSync(curlCmd, { encoding: "utf-8", timeout: 5000 });

      if (!response) return staleData;

      const data = JSON.parse(response);
      try { writeFileSync("/tmp/sl-zhipu-balance-raw", JSON.stringify(data, null, 2), "utf-8"); } catch {}

      // Parse alternative format
      let totalBalance = 0;
      let cashBalance = 0;
      let resourceBalance = 0;

      if (data.data) {
        const accountData = data.data;
        cashBalance = accountData.cashBalance || accountData.cash_balance || 0;
        resourceBalance = accountData.resourceBalance || accountData.resource_balance || 0;
        totalBalance = cashBalance + resourceBalance;
      } else if (data.balance !== undefined) {
        totalBalance = data.balance;
      }

      const result: ZhipuBalance = {
        totalBalance,
        cashBalance,
        resourceBalance,
        resourcePackages: [],
      };

      writeFileSync(cacheFile, JSON.stringify({ data: result, lastAttempt: now }), "utf-8");
      return result;
    } catch {
      return staleData;
    }
  }
}

/**
 * 格式化智谱余额显示
 */
function formatZhipuBalance(balance: ZhipuBalance | null): string {
  if (!balance) return "";

  const parts: string[] = [];

  // 显示现金余额（转换为元）
  if (balance.cashBalance > 0) {
    const yuan = balance.cashBalance / 10000; // 假设单位是万分之一元
    if (yuan >= 1) {
      parts.push(`${FG_YELLOW}¥${yuan.toFixed(1)}${RESET}`);
    } else {
      parts.push(`${FG_YELLOW}¥${yuan.toFixed(2)}${RESET}`);
    }
  }

  // 显示资源包
  if (balance.resourcePackages.length > 0) {
    const pkg = balance.resourcePackages[0];
    const formattedBalance = pkg.balance >= 1000000
      ? (pkg.balance / 1000000).toFixed(1) + "M"
      : pkg.balance >= 1000
        ? (pkg.balance / 1000).toFixed(1) + "k"
        : String(pkg.balance);
    parts.push(`${FG_PURPLE}${formattedBalance} tokens${RESET}`);
  } else if (balance.resourceBalance > 0) {
    const formatted = balance.resourceBalance >= 1000000
      ? (balance.resourceBalance / 1000000).toFixed(1) + "M"
      : balance.resourceBalance >= 1000
        ? (balance.resourceBalance / 1000).toFixed(1) + "k"
        : String(balance.resourceBalance);
    parts.push(`${FG_PURPLE}${formatted} res${RESET}`);
  }

  return parts.join(` ${FG_GRAY_DIM}·${RESET} `);
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
  const model = (data.model?.display_name ?? "—").replace(/\s*\((\d+[KMB])\s+context\)/i, " ($1)");
  const contextPct = Math.floor(data.context_window?.used_percentage ?? 0);

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
  const gr = FG_GRAY;
  const r = RESET;
  const cx = ctxColor(contextPct);

  const segments: string[] = [];

  // tokens $cost · ctx% Model
  segments.push(`${formatTokens(totalTokens)} ${y}${formatCost(cost)}${r} ${g}·${r} ${cx}${contextPct}%${r} ${m}${model}${r}`);

  // Check if using Zhipu proxy
  const usingZhipu = isZhipuProxy();

  // Usage/Balance section
  const usageParts: string[] = [];

  if (usingZhipu) {
    // Show Zhipu balance instead of Claude usage limits
    const zhipuBalance = getZhipuBalance();
    const balanceStr = formatZhipuBalance(zhipuBalance);
    if (balanceStr) {
      usageParts.push(`${FG_CYAN}Zhipu${RESET} ${balanceStr}`);
    }
  } else {
    // Show Claude usage limits (original behavior)
    const claudeUsage = getClaudeUsage();
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
  }

  // Period cost
  if (cache) {
    const period = config.period || "30d";
    if (period === "both") {
      usageParts.push(`${y}7d:${formatCost(cache.cost7d)}${r}`);
      usageParts.push(`${y}30d:${formatCost(cache.cost30d)}${r}`);
    } else {
      const periodCost = period === "7d" ? cache.cost7d : cache.cost30d;
      usageParts.push(`${y}${period}:${formatCost(periodCost)}${r}`);
    }
  }

  if (usageParts.length > 0) {
    segments.push(usageParts.join(` ${g}·${r} `));
  }

  // #2 $53.6 (ccclub rank)
  const ccclubRank = getCcclubRank();
  if (ccclubRank) {
    const rc = rankColor(ccclubRank.rank);
    segments.push(`${rc}#${ccclubRank.rank} ${formatCost(ccclubRank.cost)}${r}`);
  }

  return " " + segments.join(` ${gr}/${r} `);
}
