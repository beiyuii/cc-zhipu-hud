import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

const CACHE_DIR = join(homedir(), ".cc-costline");

export interface CacheData {
  cost7d: number;
  cost30d: number;
  updatedAt: string;
}

export interface ConfigData {
  period: "7d" | "30d" | "both";
}

export function readCache(dir?: string): CacheData | null {
  try {
    const raw = readFileSync(join(dir || CACHE_DIR, "cache.json"), "utf-8");
    return JSON.parse(raw) as CacheData;
  } catch {
    return null;
  }
}

export function writeCache(data: CacheData, dir?: string): void {
  const d = dir || CACHE_DIR;
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, "cache.json"), JSON.stringify(data, null, 2) + "\n");
}

export function readConfig(dir?: string): ConfigData {
  try {
    const raw = readFileSync(join(dir || CACHE_DIR, "config.json"), "utf-8");
    return JSON.parse(raw) as ConfigData;
  } catch {
    return { period: "7d" };
  }
}

export function writeConfig(data: ConfigData, dir?: string): void {
  const d = dir || CACHE_DIR;
  mkdirSync(d, { recursive: true });
  writeFileSync(join(d, "config.json"), JSON.stringify(data, null, 2) + "\n");
}

export { CACHE_DIR };
