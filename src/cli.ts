#!/usr/bin/env node

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf-8"));
import { collectCosts } from "./collector.js";
import { writeCache, writeConfig, readConfig, CACHE_DIR } from "./cache.js";
import { render } from "./statusline.js";

const SETTINGS_PATH = join(homedir(), ".claude", "settings.json");
const RENDER_COMMAND = "cc-zhipu-hud render";
const REFRESH_COMMAND = "cc-zhipu-hud refresh";

// ─── Helpers ──────────────────────────────────────────────

function readSettings(): any {
  if (!existsSync(SETTINGS_PATH)) return {};
  const raw = readFileSync(SETTINGS_PATH, "utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    console.error(`✗ Failed to parse ${SETTINGS_PATH} — aborting to avoid overwriting your config.`);
    console.error("  Please fix the JSON syntax and retry.");
    process.exit(1);
  }
}

function saveSettings(settings: any): void {
  writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n");
}

function readStdin(): string {
  const chunks: Buffer[] = [];
  let chunk: Buffer;
  // Node 22+ supports readable iterator on process.stdin
  for (chunk of process.stdin as unknown as Iterable<Buffer>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

// ─── Commands ──────────────────────────────────────────────

function install(): void {
  const settings = readSettings();

  // Set statusLine command
  settings.statusLine = {
    type: "command",
    command: RENDER_COMMAND,
  };

  // Add hooks for cache refresh on session end
  if (!settings.hooks) settings.hooks = {};
  if (!settings.hooks.SessionEnd) settings.hooks.SessionEnd = [];
  if (!settings.hooks.SessionEnd.includes(REFRESH_COMMAND)) {
    settings.hooks.SessionEnd.push(REFRESH_COMMAND);
  }
  if (!settings.hooks.Stop) settings.hooks.Stop = [];
  if (!settings.hooks.Stop.includes(REFRESH_COMMAND)) {
    settings.hooks.Stop.push(REFRESH_COMMAND);
  }

  saveSettings(settings);

  // Ensure cache directory exists
  mkdirSync(CACHE_DIR, { recursive: true });

  console.log("✓ cc-zhipu-hud installed!");
  console.log("");
  console.log("  Open a new Claude Code session to see the enhanced statusline.");
  console.log("");
  console.log("  Features:");
  console.log("    • Session tokens, cost, context usage, model");
  console.log("    • Zhipu AI/GLM balance (when using bigmodel.cn proxy)");
  console.log("    • Claude usage limits (5h/7d) for official API");
  console.log("    • 7d/30d cost tracking");
  console.log("");
  console.log("  Commands:");
  console.log("    cc-zhipu-hud config --period 7d   # Show 7-day cost");
  console.log("    cc-zhipu-hud config --period 30d  # Show 30-day cost");
  console.log("    cc-zhipu-hud config --period both # Show both periods");
  console.log("    cc-zhipu-hud refresh             # Recalculate cost cache");
}

function uninstall(): void {
  const settings = readSettings();

  if (settings.statusLine?.command === RENDER_COMMAND) {
    delete settings.statusLine;
  }

  if (Array.isArray(settings.hooks?.SessionEnd)) {
    settings.hooks.SessionEnd = settings.hooks.SessionEnd.filter(
      (cmd: string) => cmd !== REFRESH_COMMAND
    );
  }
  if (Array.isArray(settings.hooks?.Stop)) {
    settings.hooks.Stop = settings.hooks.Stop.filter(
      (cmd: string) => cmd !== REFRESH_COMMAND
    );
  }

  saveSettings(settings);
  console.log("✓ cc-zhipu-hud uninstalled.");
}

function refresh(): void {
  try {
    const result = collectCosts();
    const cache = { cost7d: result.cost7d, cost30d: result.cost30d, updatedAt: new Date().toISOString() };
    writeCache(cache);
    console.log(`✓ Cost cache refreshed: 7d=$${result.cost7d.toFixed(2)}, 30d=$${result.cost30d.toFixed(2)}`);
  } catch (error) {
    console.error("✗ Failed to refresh cost cache:", error);
  }
}

function config(args: string[]): void {
  const arg = args[0];
  if (arg === "--period") {
    const period = args[1];
    if (period === "7d" || period === "30d" || period === "both") {
      writeConfig({ period });
      console.log(`✓ Period set to ${period}`);
    } else {
      console.error("✗ Period must be 7d, 30d, or both");
    }
  } else {
    const currentConfig = readConfig();
    console.log("Current config:");
    console.log(`  period: ${currentConfig.period}`);
  }
}

function renderCmd(): void {
  const input = readStdin();
  if (!input.trim()) return;
  const output = render(input);
  if (output) console.log(output);
}

// ─── Main ──────────────────────────────────────────────

const [cmd, ...args] = process.argv.slice(2);

switch (cmd) {
  case "install":
    install();
    break;
  case "uninstall":
    uninstall();
    break;
  case "refresh":
    refresh();
    break;
  case "config":
    config(args);
    break;
  case "render":
    renderCmd();
    break;
  case "version":
  case "-v":
  case "--version":
    console.log(`cc-zhipu-hud v${pkg.version}`);
    break;
  case "help":
  case "-h":
  case "--help":
    console.log(`cc-zhipu-hud v${pkg.version} - Enhanced statusline for Claude Code with Zhipu AI support`);
    console.log("");
    console.log("Usage:");
    console.log("  cc-zhipu-hud install              Set up Claude Code integration");
    console.log("  cc-zhipu-hud uninstall            Remove from settings");
    console.log("  cc-zhipu-hud refresh              Manually recalculate cost cache");
    console.log("  cc-zhipu-hud config --period 7d   Show 7-day cost (default)");
    console.log("  cc-zhipu-hud config --period 30d  Show 30-day cost");
    console.log("  cc-zhipu-hud config --period both Show both periods");
    console.log("  cc-zhipu-hud render               Render statusline (called by Claude Code)");
    break;
  default:
    if (!cmd) {
      console.log(`cc-zhipu-hud v${pkg.version}`);
      console.log("Run `cc-zhipu-hud help` for usage.");
    } else {
      console.error(`Unknown command: ${cmd}`);
      console.error("Run `cc-zhipu-hud help` for usage.");
      process.exit(1);
    }
}
