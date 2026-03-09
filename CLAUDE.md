# cc-costline

Enhanced statusline for Claude Code — adds cost tracking, usage limits, and leaderboard rank.

## Tech Stack

- TypeScript (ESM), Node.js >= 22
- Zero runtime dependencies
- Tests: `node:test` + `node:assert/strict`

## Commands

```bash
npm test        # Build + run unit tests
npx tsc         # Build only
npm link        # Install locally for testing
npm publish     # Publish to npm
```

## Project Structure

```
src/
├── cli.ts          # CLI entry point (install/uninstall/config/refresh/render)
├── statusline.ts   # Render logic, usage/rank fetchers with session-based caching
├── collector.ts    # Scan ~/.claude/projects/**/*.jsonl for token usage
├── calculator.ts   # Per-model pricing and cost calculation
└── cache.ts        # Read/write cost cache and config (~/.cc-costline/)
test/
└── statusline.test.ts  # Unit tests for pure functions
```

## Key Design Decisions

- **Session-based caching**: Usage API and ccclub rank are cached per sessionId with 10-min TTL fallback to avoid rate limits
- **No User-Agent header**: The Anthropic usage API rate-limits requests with `claude-code` User-Agent
- **Failure caching**: On API failure, a cache entry with null data is written to prevent retry floods
- **Deduplication**: Token cost collection deduplicates by requestId to avoid double-counting

## Conventions

- Keep zero runtime dependencies
- All formatting functions should be pure and tested
- Cache files go to `/tmp/sl-*`, config to `~/.cc-costline/`
