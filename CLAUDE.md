# cc-costline

Enhanced statusline for Claude Code — adds cost tracking, usage limits, and leaderboard rank.

## Tech Stack

- TypeScript (ESM), Node.js >= 22
- Zero runtime dependencies (devDep: `typescript`)
- Tests: `node:test` + `node:assert/strict`
- Publishing: `npm publish` (manual, no CI/CD)

## Commands

```bash
npm test        # Build (tsc) + run unit tests
npx tsc         # Build only
npm link        # Install locally for testing
npm publish     # Publish to npm
```

## Project Structure

```
src/
├── cli.ts          # CLI entry point (install/uninstall/config/refresh/render)
├── statusline.ts   # Render logic, inline data refresh with unified TTL caching
├── collector.ts    # Scan ~/.claude/projects/**/*.jsonl for token usage
├── calculator.ts   # Per-model pricing and cost calculation
└── cache.ts        # Read/write cost cache and config (~/.cc-costline/)
test/
├── statusline.test.ts  # Unit tests for pure formatting/color functions
├── calculator.test.ts  # Unit tests for pricing lookup and cost calculation
├── cache.test.ts       # Cache/config read/write roundtrip tests
├── collector.test.ts   # Cost collection with mock jsonl files
└── render.test.ts      # Render output format and edge cases
```

## Data Flow

1. Claude Code calls `cc-costline render` on every turn, passing session JSON via stdin
2. `render()` reads stdin JSON for session cost/model/context, reads transcript for token count
3. Three data sources are refreshed inline when their cache expires (unified 2-min TTL):
   - **Local cost** (`~/.cc-costline/cache.json`): `collectCosts()` scans all `.jsonl` files
   - **Usage API** (`/tmp/sl-claude-usage`): fetches `api.anthropic.com/api/oauth/usage` via curl
   - **ccclub rank** (`/tmp/sl-ccclub-rank`): fetches `ccclub.dev/api/rank` via curl
4. `install` also sets `SessionEnd`/`Stop` hooks to run `cc-costline refresh` (legacy, kept for cache warmth)

## Key Design Decisions

- **TTL-based caching**: All data sources use a unified 2-minute TTL (`CACHE_TTL_MS`), refreshed inline during render; local cost cache also refreshes immediately when transcript mtime is newer than cache
- **Model name shortening**: `display_name` is shortened (e.g. "Opus 4.6 (1M context)" → "Opus 4.6 (1M)")
- **No User-Agent header**: The Anthropic usage API rate-limits requests with `claude-code` User-Agent
- **Failure caching**: On API failure, a cache entry with null data is written to prevent retry floods
- **Deduplication**: Token cost collection deduplicates by requestId; fallback key includes model + all token types to avoid false dedup
- **Stale fallback**: If API fetch fails or collectCosts returns 0 with existing non-zero cache, retains stale data
- **Safe settings**: `readSettings()` aborts if `settings.json` exists but is invalid JSON, preventing config wipe

## Tests

63 tests across 5 files (~79% line coverage, ~89% function coverage):
- `statusline.test.ts`: formatTokens, formatCost, ctxColor, formatCountdown, rankColor, shouldRefreshLocalCostCache
- `calculator.test.ts`: getPricing (exact/family/unknown fallback), calculateCost
- `cache.test.ts`: readCache/writeCache/readConfig/writeConfig roundtrip, missing file, invalid JSON
- `collector.test.ts`: collectCosts with mock jsonl — dedup (with/without requestId), 7d/30d split, nested dirs, cache tokens, model pricing, error handling
- `render.test.ts`: render() output format, edge cases, transcript token counting, ANSI colors, period=both

Not tested: getClaudeUsage, getCcclubRank (external API + keychain), CLI commands (hardcoded paths).

## Conventions

- Keep zero runtime dependencies
- All formatting functions should be pure and tested
- Cache files go to `/tmp/sl-*`, config to `~/.cc-costline/`
