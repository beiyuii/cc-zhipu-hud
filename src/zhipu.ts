import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

const ZHIPU_CACHE_FILE = "/tmp/sl-zhipu-balance";
const GLM_USAGE_CACHE_FILE = "/tmp/sl-glm-usage";
const API_RETRY_TTL_MS = 300_000; // 5 minutes

/**
 * Detect if user is using Zhipu AI proxy by checking ANTHROPIC_BASE_URL
 */
export function isZhipuMode(): boolean {
  const baseUrl = process.env.ANTHROPIC_BASE_URL || "";
  return baseUrl.includes("bigmodel.cn");
}

/**
 * Fetch Zhipu AI token packages from bigmodel.cn API
 * @returns Array of token packages or null if unavailable
 */
export interface ZhipuTokenPackage {
  tokenBalance: number;
  tokensMagnitude: number;
  status: string;
  resourcePackageName: string;
  suitableModel: string;
}

/**
 * GLM Coding Plan quota limits response
 */
export interface GlmCodingPlanUsage {
  fiveHourPercent: number;  // 5-hour rolling window usage percentage
  weeklyPercent: number;     // Weekly usage percentage
  fiveHourResetsAt?: number; // Unix timestamp when 5h window resets
  weeklyResetsAt?: number;   // Unix timestamp when week resets
}

export function getZhipuBalance(): ZhipuTokenPackage[] | null {
  const now = Date.now();
  let staleData: ZhipuTokenPackage[] | null = null;
  let lastAttempt = 0;

  // Read cached data
  if (existsSync(ZHIPU_CACHE_FILE)) {
    try {
      const cached = JSON.parse(readFileSync(ZHIPU_CACHE_FILE, "utf-8"));
      staleData = cached.data ?? null;
      lastAttempt = cached.lastAttempt || cached.timestamp || 0;
      if (now - lastAttempt < API_RETRY_TTL_MS) return staleData;
    } catch { }
  }

  // Mark attempt (preserve stale data)
  try {
    writeFileSync(
      ZHIPU_CACHE_FILE,
      JSON.stringify({ data: staleData, lastAttempt: now }),
      "utf-8"
    );
  } catch { }

  // Get API key from environment
  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || "";
  if (!apiKey) return staleData;

  try {
    // Correct API endpoint for querying token packages
    const url = "https://bigmodel.cn/api/biz/tokenAccounts/list/my?pageNum=1&pageSize=50";
    const curlCmd = `curl -sf "${url}" -H "Authorization: Bearer ${apiKey}"`;
    const response = execSync(curlCmd, { encoding: "utf-8", timeout: 5000 });

    if (!response) return staleData;

    const data = JSON.parse(response);

    // Check if API returned success
    if (data.code !== 200) return staleData;

    // Extract token packages
    const packages: ZhipuTokenPackage[] = (data.rows || []).map((pkg: any) => ({
      tokenBalance: pkg.tokenBalance || 0,
      tokensMagnitude: pkg.tokensMagnitude || 0,
      status: pkg.status || "UNKNOWN",
      resourcePackageName: pkg.resourcePackageName || "Unknown Package",
      suitableModel: pkg.suitableModel || "",
    }));

    // Prefer effective packages, but fall back to all packages if none effective
    const effectivePackages = packages.filter(p => p.status === "EFFECTIVE");
    const result = effectivePackages.length > 0 ? effectivePackages : packages;

    writeFileSync(
      ZHIPU_CACHE_FILE,
      JSON.stringify({ data: result, lastAttempt: now }),
      "utf-8"
    );
    return result;
  } catch {
    return staleData;
  }
}

/**
 * Fetch GLM Coding Plan usage quota (5h rolling and weekly limits)
 * @returns GLM Coding Plan usage data or null if unavailable
 */
export function getGlmCodingPlanUsage(): GlmCodingPlanUsage | null {
  const now = Date.now();
  let staleData: GlmCodingPlanUsage | null = null;
  let lastAttempt = 0;

  // Read cached data
  if (existsSync(GLM_USAGE_CACHE_FILE)) {
    try {
      const cached = JSON.parse(readFileSync(GLM_USAGE_CACHE_FILE, "utf-8"));
      staleData = cached.data ?? null;
      lastAttempt = cached.lastAttempt || cached.timestamp || 0;
      if (now - lastAttempt < API_RETRY_TTL_MS) return staleData;
    } catch { }
  }

  // Mark attempt (preserve stale data)
  try {
    writeFileSync(
      GLM_USAGE_CACHE_FILE,
      JSON.stringify({ data: staleData, lastAttempt: now }),
      "utf-8"
    );
  } catch { }

  // Get API key from environment
  const apiKey = process.env.ANTHROPIC_AUTH_TOKEN || process.env.ANTHROPIC_API_KEY || "";
  if (!apiKey) return staleData;

  try {
    const url = "https://open.bigmodel.cn/api/monitor/usage/quota/limit";
    const curlCmd = `curl -sf "${url}" -H "Authorization: ${apiKey}" -H "Accept-Language: en-US,en" -H "Content-Type: application/json"`;
    const response = execSync(curlCmd, { encoding: "utf-8", timeout: 10000 });

    if (!response) return staleData;

    const data = JSON.parse(response);

    // Extract quota data - API returns percentages
    // Expected response format: { five_hour_percent: number, weekly_percent: number, ... }
    const fiveHourPercent = Math.round(data.five_hour_percent ?? data.fiveHourPercent ?? 0);
    const weeklyPercent = Math.round(data.weekly_percent ?? data.weeklyPercent ?? 0);

    // Calculate reset times if available in response
    let fiveHourResetsAt: number | undefined;
    let weeklyResetsAt: number | undefined;

    if (data.five_hour_resets_at || data.fiveHourResetsAt) {
      const resetAt = data.five_hour_resets_at || data.fiveHourResetsAt;
      const ts = typeof resetAt === "string" ? new Date(resetAt).getTime() : resetAt * 1000;
      if (!isNaN(ts) && ts > now) fiveHourResetsAt = ts;
    }

    if (data.weekly_resets_at || data.weeklyResetsAt) {
      const resetAt = data.weekly_resets_at || data.weeklyResetsAt;
      const ts = typeof resetAt === "string" ? new Date(resetAt).getTime() : resetAt * 1000;
      if (!isNaN(ts) && ts > now) weeklyResetsAt = ts;
    }

    const result: GlmCodingPlanUsage = {
      fiveHourPercent,
      weeklyPercent,
    };

    if (fiveHourResetsAt) result.fiveHourResetsAt = fiveHourResetsAt;
    if (weeklyResetsAt) result.weeklyResetsAt = weeklyResetsAt;

    writeFileSync(
      GLM_USAGE_CACHE_FILE,
      JSON.stringify({ data: result, lastAttempt: now }),
      "utf-8"
    );
    return result;
  } catch {
    return staleData;
  }
}
