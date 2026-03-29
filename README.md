[English](README.md) | [中文](README.zh-CN.md)

# cc-zhipu-hud

> Enhanced statusline for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with **Zhipu AI/GLM balance tracking**

![cc-zhipu-hud screenshot](screenshot.png)

```
14.6k ~ $2.42 / 40% by GLM-5 | Zhipu ¥12.5 · 500k tokens | 30d: $866
```

## Why cc-zhipu-hud?

This is a fork of [cc-costline](https://github.com/Ventuss-OvO/cc-costline) specifically enhanced for users who access Claude API through [Zhipu AI](https://bigmodel.cn/) (智谱 AI) proxy.

### Key Differences from cc-costline

| Feature | cc-costline | **cc-zhipu-hud** |
|---------|-------------|------------------|
| Claude usage limits | ✅ 5h/7d limits | ✅ (official API only) |
| **Zhipu balance** | ❌ | ✅ **Cash + Token packages** |
| Local cost tracking | ✅ | ✅ |
| ccclub leaderboard | ✅ | ✅ |
| Smart API detection | ❌ | ✅ **Automatic mode switching** |

When using Zhipu AI's `bigmodel.cn` proxy, cc-zhipu-hud automatically switches to show your account balance instead of Claude usage limits — which are irrelevant for proxy users.

## Features

### Statusline Segments

| Segment | Example | Description |
|---------|---------|-------------|
| Tokens ~ Cost / Context | `14.6k ~ $2.42 / 40% by GLM-5` | Session token count, cost, context usage, and model |
| **Zhipu Balance** | `Zhipu ¥12.5 · 500k tokens` | Zhipu AI cash balance + token package balance (proxy mode) |
| Usage Limits | `5h: 45% / 7d: 8%` | Claude 5h/7d usage (official API mode only) |
| Period Cost | `30d: $866` | Rolling 7d/30d cost total (configurable) |
| Leaderboard | `#2/22 $67.0` | [ccclub](https://github.com/mazzzystar/ccclub) rank (if installed) |

### Smart Mode Detection

cc-zhipu-hud automatically detects your API configuration:

```bash
# ~/.claude/settings.json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-api-key",
    "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic"  # Zhipu mode
  }
}
```

- **Zhipu mode** (`bigmodel.cn`): Shows account balance
- **Claude mode** (default/official): Shows usage limits

### Color Indicators

- **Context & Usage** — Green (<60%) → Orange (60-79%) → Red (≥80%)
- **Zhipu Cash** — Cyan
- **Zhipu Token Packages** — Purple
- **Leaderboard** — #1 Gold, #2 White, #3 Orange, others Cyan
- **Cost** — Yellow

## Installation

```bash
# Clone and build
git clone https://github.com/beiyuii/cc-zhipu-hud.git
cd cc-zhipu-hud
npm install
npm run build
npm link

# Set up Claude Code integration
cc-zhipu-hud install
```

Or via npm (when published):

```bash
npm i -g cc-zhipu-hud && cc-zhipu-hud install
```

**Requirements**: Node.js >= 22

## Configuration

### For Zhipu AI Users

Set up your `~/.claude/settings.json`:

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-zhipu-api-key",
    "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic"
  }
}
```

The statusline will automatically show your Zhipu balance.

### Optional: ccclub Leaderboard

Install [ccclub](https://github.com/mazzzystar/ccclub) for friend rankings:

```bash
npm i -g ccclub && ccclub init
```

## Commands

```bash
cc-zhipu-hud install              # Set up Claude Code integration
cc-zhipu-hud uninstall            # Remove integration
cc-zhipu-hud refresh              # Refresh cost cache
cc-zhipu-hud config --period 7d   # Show 7-day cost (default)
cc-zhipu-hud config --period 30d  # Show 30-day cost
cc-zhipu-hud config --period both # Show both periods
```

## How It Works

1. **Install**: Configures `~/.claude/settings.json` with statusline command
2. **Render** (on every turn):
   - Detects API type via `ANTHROPIC_BASE_URL`
   - **Zhipu mode**: Fetches balance from `open.bigmodel.cn/api/paas/v4/billing/quota`
   - **Claude mode**: Fetches usage from `api.anthropic.com/api/oauth/usage`
   - Scans local `~/.claude/projects/**/*.jsonl` for cost tracking
3. **Cache**: Data cached with 1-5 min TTL in `/tmp/sl-*`

## Development

```bash
npm run build   # Compile TypeScript
npm test        # Run unit tests
```

## Uninstall

```bash
cc-zhipu-hud uninstall
npm unlink cc-zhipu-hud
# or: npm uninstall -g cc-zhipu-hud
```

## Acknowledgments

- [cc-costline](https://github.com/Ventuss-OvO/cc-costline) by Ventuss — Original project
- [ccclub](https://github.com/mazzzystar/ccclub) by 碎瓜 — Claude Code leaderboard

## Roadmap

- [ ] Support more GLM model pricing tiers
- [ ] Add Windows/Linux keychain support
- [ ] Configurable balance/cost threshold alerts
- [ ] Custom API endpoint support
- [ ] More language translations

## Contributing

Contributions welcome! Feel free to open a PR or issue.

## License

[MIT](LICENSE) © [beiyuii](https://github.com/beiyuii)
