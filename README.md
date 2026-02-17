[中文](README.zh-CN.md) | [日本語](README.ja.md) | [Français](README.fr.md) | [Español](README.es.md)

# cc-costline

Enhanced statusline for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — adds cost tracking, usage limits, and leaderboard rank to your terminal.

![cc-costline screenshot](screenshot.png)

```
14.6k ~ $2.42 / 40% by Opus 4.6 | 5h: 45% / 7d: 8% | 30d: $866 | #2/22 $67.0
```

## Install

```bash
npm i -g cc-costline && cc-costline install
```

Open a new Claude Code session and you'll see the enhanced statusline. Requires Node.js >= 22.

## What you get

| Segment | Example | Description |
|---------|---------|-------------|
| Tokens ~ Cost / Context | `14.6k ~ $2.42 / 40% by Opus 4.6` | Session token count, cost, context usage, and model |
| Usage limits | `5h: 45% / 7d: 8%` | Claude 5-hour and 7-day utilization (auto-colored like context) |
| Period cost | `30d: $866` | Rolling cost total (configurable: 7d or 30d) |
| Leaderboard | `#2/22 $67.0` | [ccclub](https://github.com/mazzzystar/ccclub) rank (if installed) |

### Colors

- **Context & usage limits** — green (< 60%) → orange (60-79%) → red (≥ 80%)
- **Leaderboard rank** — #1 gold, #2 white, #3 orange, others blue
- **Period cost** — yellow

### Optional integrations

- **Claude usage limits** — reads OAuth credentials from macOS Keychain automatically. Just `claude login` and it works.
- **ccclub leaderboard** — install [ccclub](https://github.com/mazzzystar/ccclub) (`npm i -g ccclub && ccclub init`). Rank appears automatically.

Both are zero-config: if not available, the segment is silently omitted.

## Commands

```bash
cc-costline install              # Set up Claude Code integration
cc-costline uninstall            # Remove from settings
cc-costline refresh              # Manually recalculate cost cache
cc-costline config --period 30d  # Show 30-day cost (default)
cc-costline config --period 7d   # Show 7-day cost
```

## How it works

1. `install` configures `~/.claude/settings.json` — sets the statusline command and adds session-end hooks for auto-refresh. Your existing settings are preserved.
2. `render` reads Claude Code's stdin JSON and the cost cache, outputs the formatted statusline.
3. `refresh` scans `~/.claude/projects/**/*.jsonl`, extracts token usage, applies per-model pricing, and writes to `~/.cc-costline/cache.json`.
4. Claude usage is fetched from `api.anthropic.com/api/oauth/usage` with a 60s file cache at `/tmp/sl-claude-usage`.
5. ccclub rank is fetched from `ccclub.dev/api/rank` with a 120s file cache at `/tmp/sl-ccclub-rank`.

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

## Acknowledgments

- [ccclub](https://github.com/mazzzystar/ccclub) by 碎瓜 ([@mazzzystar](https://github.com/mazzzystar)) — Claude Code leaderboard among friends

## License

MIT
