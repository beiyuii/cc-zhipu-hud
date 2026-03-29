# cc-zhipu-hud

Enhanced statusline for Claude Code with Zhipu AI/GLM balance tracking support.

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
├── cache.ts        # Read/write cost cache and config (~/.cc-zhipu-hud/)
└── zhipu.ts        # Zhipu AI/GLM balance fetching
test/
├── statusline.test.ts  # Unit tests for pure formatting/color functions
├── calculator.test.ts  # Unit tests for pricing lookup and cost calculation
├── cache.test.ts       # Cache/config read/write roundtrip tests
├── collector.test.ts   # Cost collection with mock jsonl files
└── render.test.ts      # Render output format and edge cases
```

## Key Design Decisions

- **Smart API detection**: Automatically detects Zhipu AI proxy via `ANTHROPIC_BASE_URL` and shows balance instead of usage limits
- **TTL-based caching**: All data sources use 2-5 min TTL, refreshed inline during render
- **No User-Agent header**: The Anthropic usage API rate-limits requests with `claude-code` User-Agent
- **Failure caching**: On API failure, stale data is preserved; `lastAttempt` updates separately from `data`
- **Deduplication**: Token cost collection deduplicates by requestId; fallback key includes model + all token types
- **Safe settings**: `readSettings()` aborts if `settings.json` exists but is invalid JSON, preventing config wipe

## Conventions

- Keep zero runtime dependencies
- All formatting functions should be pure and tested
- Cache files go to `/tmp/sl-*`, config to `~/.cc-zhipu-hud/`
