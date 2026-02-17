# cc-costline

Enhanced statusline for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — adds 7-day and 30-day rolling cost tracking to your terminal.

```
 Token: ↑12.3k ↓45.6k | $2.34 (7d:$385) | Code: +12 -3 | 42% by Opus 4.6
```

## What it does

Claude Code's built-in statusline shows the current session cost. cc-costline extends it with:

- **Rolling cost totals** — see how much you've spent in the last 7 or 30 days
- **Token counts** — input/output token usage for the current session
- **Context window** — color-coded usage percentage (green → orange → red)
- **Code changes** — lines added/removed in the session

Cost calculation is self-contained — it reads your local transcript files and applies Anthropic's pricing table directly. No external API calls, no dependencies.

## Install

```bash
npm i -g cc-costline
cc-costline install
```

That's it. Open a new Claude Code session and you'll see the enhanced statusline.

Requires Node.js >= 22.

## What `install` does

1. Sets `statusLine.command` → `cc-costline render` in `~/.claude/settings.json`
2. Adds `SessionEnd` and `Stop` hooks to auto-refresh the cost cache
3. Creates `~/.cc-costline/` with default config
4. Runs initial cost calculation from your transcript history

Your existing hooks and settings are preserved.

## Commands

```bash
cc-costline install              # Set up Claude Code integration
cc-costline uninstall            # Remove from Claude Code settings
cc-costline refresh              # Manually recalculate cost cache
cc-costline config --period 7d   # Show 7-day cost (default)
cc-costline config --period 30d  # Show 30-day cost
cc-costline config --period both # Show both
```

## Output format

```
 Token: ↑{in} ↓{out} | ${session} ({period}:${total}) | Code: +{add} -{del} | {ctx}% by {model}
```

| Segment | Source | Color |
|---------|--------|-------|
| Token counts | Current session transcript | Gray |
| Session cost | Claude Code stdin | Yellow |
| Period cost | Cached calculation | Cyan |
| Lines changed | Claude Code stdin | Green / Gray |
| Context % | Claude Code stdin | Green (<60%) / Orange (60-80%) / Red (80%+) |
| Model name | Claude Code stdin | Brown |

## How cost is calculated

cc-costline scans all `.jsonl` files under `~/.claude/projects/`, extracts token usage from assistant messages, and applies per-model pricing:

| Model | Input | Output | Cache Write | Cache Read |
|-------|------:|-------:|------------:|-----------:|
| Opus 4.6 | $5 | $25 | $6.25 | $0.50 |
| Opus 4.5 | $5 | $25 | $6.25 | $0.50 |
| Opus 4.1 | $15 | $75 | $18.75 | $1.50 |
| Sonnet 4.5 | $3 | $15 | $3.75 | $0.30 |
| Sonnet 4 | $3 | $15 | $3.75 | $0.30 |
| Haiku 4.5 | $1 | $5 | $1.25 | $0.10 |
| Haiku 3.5 | $0.80 | $4 | $1.00 | $0.08 |

Prices are per million tokens in USD. Unknown models fall back by family name (opus/sonnet/haiku), defaulting to Sonnet pricing.

Entries are deduplicated by `sessionId:requestId` to avoid double-counting.

## Files

```
~/.cc-costline/
├── cache.json    # { cost7d, cost30d, updatedAt }
└── config.json   # { period: "7d" | "30d" | "both" }
```

## Uninstall

```bash
cc-costline uninstall
npm uninstall -g cc-costline
```

## License

MIT
