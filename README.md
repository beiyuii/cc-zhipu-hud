# cc-zhipu-hud

[English](README.md) | [中文](README.zh-CN.md)

Enhanced statusline for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) — with **Zhipu AI/GLM balance tracking** support.

Forked from [cc-costline](https://github.com/Ventuss-OvO/cc-costline) with added support for [Zhipu AI](https://bigmodel.cn/) API proxy users.

## Features

```
14.6k ~ $2.42 / 40% by GLM-5 | Zhipu ¥12.5 · 500k tokens | 30d: $866
```

| Segment | Example | Description |
|---------|---------|-------------|
| Tokens ~ Cost / Context | `14.6k ~ $2.42 / 40% by GLM-5` | Session token count, cost, context usage, and model |
| **Zhipu Balance** | `Zhipu ¥12.5 · 500k tokens` | **NEW!** Zhipu AI account balance when using bigmodel.cn proxy |
| ~~Usage limits~~ | ~~`5h: 45% / 7d: 8%`~~ | Claude usage limits (only shown for official API) |
| Period cost | `30d: $866` | Rolling cost total (configurable: 7d, 30d, or both) |
| Leaderboard | `#2/22 $67.0` | [ccclub](https://github.com/mazzzystar/ccclub) rank (if installed) |

### Smart API Detection

- **Zhipu AI users**: Shows account balance (cash + resource packages) instead of usage limits
- **Official API users**: Shows Claude 5h/7d usage limits as before
- Detection is automatic based on `ANTHROPIC_BASE_URL` setting

### Colors

- **Context & usage limits** — green (< 60%) → orange (60-79%) → red (≥ 80%)
- **Zhipu balance** — cyan for cash, purple for resource tokens
- **Leaderboard rank** — #1 gold, #2 white, #3 orange, others cyan
- **Period cost** — yellow

## Install

```bash
# Clone and install
git clone https://github.com/beiyuii/cc-zhipu-hud.git
cd cc-zhipu-hud
npm install
npm run build
npm link

# Set up Claude Code integration
cc-zhipu-hud install
```

Or install from npm (when published):

```bash
npm i -g cc-zhipu-hud && cc-zhipu-hud install
```

Open a new Claude Code session and you'll see the enhanced statusline. Requires Node.js >= 22.

## Configuration

### For Zhipu AI Users

Make sure your `~/.claude/settings.json` has:

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-zhipu-api-key",
    "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic"
  }
}
```

The HUD will automatically detect Zhipu proxy and show your balance.

## Commands

```bash
cc-zhipu-hud install              # Set up Claude Code integration
cc-zhipu-hud uninstall            # Remove from settings
cc-zhipu-hud refresh              # Manually recalculate cost cache
cc-zhipu-hud config --period 7d   # Show 7-day cost (default)
cc-zhipu-hud config --period 30d  # Show 30-day cost
cc-zhipu-hud config --period both # Show both periods
```

## How it works

1. `install` configures `~/.claude/settings.json` — sets the statusline command and adds session-end hooks.
2. `render` is called by Claude Code on every turn:
   - Detects if using Zhipu AI proxy (via `ANTHROPIC_BASE_URL`)
   - **Zhipu mode**: Fetches balance from `open.bigmodel.cn/api/paas/v4/billing/quota`
   - **Claude mode**: Fetches usage from `api.anthropic.com/api/oauth/usage`
   - Local cost tracking scans `~/.claude/projects/**/*.jsonl`
3. Balance/usage data is cached in `/tmp/sl-*` with 1-5 min TTL.

## Development

```bash
npm run build   # Compile TypeScript
npm test        # Build + run unit tests
```

## Uninstall

```bash
cc-zhipu-hud uninstall
npm unlink cc-zhipu-hud
```

## Acknowledgments

- [cc-costline](https://github.com/Ventuss-OvO/cc-costline) by Ventuss — Original project
- [ccclub](https://github.com/mazzzystar/ccclub) by 碎瓜 — Claude Code leaderboard

## Roadmap

- [ ] Support more GLM model pricing tiers
- [ ] Add Windows/Linux keychain support for OAuth credentials
- [ ] Add configurable balance/cost thresholds with alerts
- [ ] Support custom API endpoints
- [ ] Add more language translations

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT
