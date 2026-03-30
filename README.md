[English](README.md) | [中文](README.zh-CN.md)

# cc-zhipu-hud

> Enhanced statusline for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with **Zhipu AI/GLM balance tracking**

![cc-zhipu-hud screenshot](screenshot.png)

```
[Model] │ Project │ git:(main)
 Context ░░░░░░░░░░ 45% │ 5h:████░░░░ 40% │ 7d:██░░░░░░ 20%
```

## Why cc-zhipu-hud?

This is a fork of [cc-costline](https://github.com/Ventuss-OvO/cc-costline) specifically enhanced for users who access Claude API through [Zhipu AI](https://bigmodel.cn/) (智谱 AI) proxy.

### Key Differences from cc-costline

| Feature | cc-costline | **cc-zhipu-hud** |
|---------|-------------|------------------|
| Claude usage limits | ✅ 5h/7d limits | ✅ (official API only) |
| **GLM Coding Plan** | ❌ | ✅ **5h/7d usage with progress bars** |
| Local cost tracking | ✅ | ✅ |
| ccclub leaderboard | ✅ | ✅ |
| Smart API detection | ❌ | ✅ **Automatic mode switching** |

When using Zhipu AI's `bigmodel.cn` proxy, cc-zhipu-hud automatically shows your GLM Coding Plan usage instead of Claude usage limits.

## Features

### Statusline Segments

| Segment | Example | Description |
|---------|---------|-------------|
| Model | `[Opus 4.6 (1M)]` | Current model name |
| Project | `cc-zhipu-hud` | Current project directory |
| Git | `git:(main)` | Current branch (with `*` if dirty) |
| Context | `░░░░░░░░░░ 45%` | Context window usage with progress bar |
| 5h Usage | `5h:████░░░░ 40%` | 5-hour rolling usage (GLM Coding Plan or Claude) |
| 7d Usage | `7d:██░░░░░░ 20%` | 7-day rolling usage |
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
- **Leaderboard** — #1 Gold, #2 White, #3 Orange, others Cyan

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
cc-zhipu-hud install    # Set up Claude Code integration
cc-zhipu-hud uninstall  # Remove integration
cc-zhipu-hud refresh    # Refresh cost cache
```

## How It Works

1. **Install**: Configures `~/.claude/settings.json` with statusline command
2. **Render** (on every turn):
   - Detects API type via `ANTHROPIC_BASE_URL`
   - **Zhipu mode**: Fetches GLM Coding Plan usage from `open.bigmodel.cn/api/paas/v4/billing/quota`
   - **Claude mode**: Fetches usage from `api.anthropic.com/api/oauth/usage`
   - Scans local `~/.claude/projects/**/*.jsonl` for cost tracking
3. **Cache**: Data cached with 2-5 min TTL in `/tmp/sl-*`

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
