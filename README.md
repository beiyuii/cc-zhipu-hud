# cc-costline

Enhanced statusline for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — adds 7-day and 30-day rolling cost tracking to your terminal.

![cc-costline screenshot](screenshot.png)

## Install

```bash
npm i -g cc-costline && cc-costline install
```

Open a new Claude Code session and you'll see the enhanced statusline. Requires Node.js >= 22.

## What you get

- **Rolling cost totals** — 7-day and 30-day spend, updated automatically after each session
- **Token counts** — input/output tokens for the current session
- **Context window** — color-coded usage (green → orange at 60% → red at 80%)
- **Code changes** — lines added/removed

Cost is calculated locally from your transcript files using Anthropic's pricing table. No API calls, zero dependencies.

## Commands

```bash
cc-costline install              # Set up Claude Code integration
cc-costline uninstall            # Remove from settings
cc-costline refresh              # Manually recalculate cost cache
cc-costline config --period 7d   # Show 7-day cost (default)
cc-costline config --period 30d  # Show 30-day cost
cc-costline config --period both # Show both
```

## How it works

1. `install` configures `~/.claude/settings.json` — sets the statusline command and adds session-end hooks for auto-refresh. Your existing settings are preserved.
2. `render` reads Claude Code's stdin JSON and the cost cache, outputs the formatted statusline.
3. `refresh` scans `~/.claude/projects/**/*.jsonl`, extracts token usage, applies per-model pricing, and writes to `~/.cc-costline/cache.json`.

<details>
<summary>Pricing table</summary>

Prices per million tokens (USD):

| Model | Input | Output | Cache Write | Cache Read |
|-------|------:|-------:|------------:|-----------:|
| Opus 4.6 | $5 | $25 | $6.25 | $0.50 |
| Opus 4.5 | $5 | $25 | $6.25 | $0.50 |
| Opus 4.1 | $15 | $75 | $18.75 | $1.50 |
| Sonnet 4.5 | $3 | $15 | $3.75 | $0.30 |
| Sonnet 4 | $3 | $15 | $3.75 | $0.30 |
| Haiku 4.5 | $1 | $5 | $1.25 | $0.10 |
| Haiku 3.5 | $0.80 | $4 | $1.00 | $0.08 |

Unknown models fall back by family name, defaulting to Sonnet pricing.

</details>

## Uninstall

```bash
cc-costline uninstall
npm uninstall -g cc-costline
```

## License

MIT
