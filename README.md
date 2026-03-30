[English](README.md) | [中文](README.zh-CN.md)

# cc-zhipu-hud

An enhanced statusline for [Claude Code](https://docs.anthropic.com/en/docs/claude-code) with **Zhipu AI/GLM balance tracking**.

Forked from [cc-costline](https://github.com/Ventuss-OvO/cc-costline) to add balance display for users who access Claude through the [Zhipu AI](https://bigmodel.cn/) API proxy.

## Prerequisites (required for this to work)

> **This plugin is not a standalone app.** It only runs when [Claude Code](https://docs.anthropic.com/en/docs/claude-code) calls the configured statusline command on every turn. If anything below is missing, the HUD will not run or API-backed segments will stay empty.

| You must have | Why |
|---------------|-----|
| **Claude Code** | Host application; there is no statusline without it. |
| **Node.js ≥ 22** | The `cc-zhipu-hud` CLI is executed by Node (`package.json` → `engines`). |
| **Package installed + `cc-zhipu-hud install` completed** | `install` writes `~/.claude/settings.json` so Claude Code knows the command to run; skipping this step means the plugin is never invoked. |
| **`curl` on `PATH`** | Billing/usage requests use `curl` (Zhipu quota, Anthropic usage, optional ccclub rank). |
| **Outbound network** | Those endpoints must be reachable from your machine. |
| **`ANTHROPIC_AUTH_TOKEN` (and mode-specific env)** | Zhipu proxy: set `ANTHROPIC_BASE_URL` to the bigmodel endpoint and use your Zhipu API key as the token. Official Claude: Claude Code supplies the OAuth token. Without a valid token, usage/balance lines cannot refresh. |

**Optional:** install [ccclub](https://github.com/mazzzystar/ccclub) separately if you want the leaderboard segment.

## Features

```
[Model] │ Project │ git:(main)
 Context ░░░░░░░░░░ 45% │ 5h:████░░░░ 40% │ 7d:██░░░░░░ 20%
```

| Module | Example | Description |
|--------|---------|-------------|
| Model | `[Opus 4.6 (1M)]` | Current model name |
| Project | `cc-zhipu-hud` | Current project directory |
| Git | `git:(main)` | Current branch (with `*` if dirty) |
| Context | `░░░░░░░░░░ 45%` | Context window usage with progress bar |
| 5h usage | `5h:████░░░░ 40%` | 5-hour rolling usage (GLM Coding Plan or Claude) |
| 7d usage | `7d:██░░░░░░ 20%` | 7-day rolling usage |
| Leaderboard | `#2/22 $67.0` | [ccclub](https://github.com/mazzzystar/ccclub) rank (requires installation) |

### Smart API detection

- **Zhipu AI**: shows GLM Coding Plan 5h/7d usage
- **Official API**: shows Claude 5h/7d usage limits
- Detected automatically from your configured `ANTHROPIC_BASE_URL`

### Color indicators

- **Context & usage** — green (< 60%) → orange (60–79%) → red (≥ 80%)
- **Leaderboard** — #1 gold, #2 white, #3 orange, others cyan

## Installation

Pick **one** path below. Both end with `cc-zhipu-hud install` and a **new Claude Code session**.

### 1. AI agent (automated)

Use this when an IDE agent (e.g. Cursor, Claude Code) can run shell commands for you.

1. **Tell the agent** the goal: install `cc-zhipu-hud` from `https://github.com/beiyuii/cc-zhipu-hud`, build it, link it globally, then run `cc-zhipu-hud install`, and confirm Node ≥ 22 and `curl` exist.
2. **Agent runs** (from a directory where you keep repos):

```bash
git clone https://github.com/beiyuii/cc-zhipu-hud.git
cd cc-zhipu-hud
npm install
npm run build
npm link
cc-zhipu-hud install
```

3. **Secrets stay with you:** do **not** paste API keys into chat. Either edit `~/.claude/settings.json` yourself (see **Configuration**), or approve a single scoped edit the agent proposes after you paste keys only in the editor / local file.
4. **You open** a new Claude Code session and check the statusline.

Or, after the package is published to npm, the agent can run:

```bash
npm i -g cc-zhipu-hud && cc-zhipu-hud install
```

(skips clone/build/link.)

### 2. Human (manual)

1. **Check** [Prerequisites](#prerequisites-required-for-this-to-work): Node.js ≥ 22, `curl`, Claude Code installed.
2. **Clone and build** in a terminal:

```bash
git clone https://github.com/beiyuii/cc-zhipu-hud.git
cd cc-zhipu-hud
npm install
npm run build
npm link
```

3. **Register the statusline** with Claude Code:

```bash
cc-zhipu-hud install
```

4. **Configure** `~/.claude/settings.json` for Zhipu if needed (see **Configuration**).
5. **Restart** Claude Code or start a **new session** so the statusline loads.

**From npm** (after publish), replace steps 2–3 with:

```bash
npm i -g cc-zhipu-hud && cc-zhipu-hud install
```

## Configuration

### For Zhipu AI users

Ensure your `~/.claude/settings.json` contains:

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-zhipu-api-key",
    "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic"
  }
}
```

The HUD automatically detects the Zhipu proxy and displays your balance.

## Commands

```bash
cc-zhipu-hud install    # Set up Claude Code integration
cc-zhipu-hud uninstall  # Remove from settings
cc-zhipu-hud refresh    # Manually recalculate cost cache
```

## How it works

1. `install` configures `~/.claude/settings.json` — sets the statusline command
2. `render` is invoked by Claude Code on every turn:
   - Detects whether the Zhipu AI proxy is used (via `ANTHROPIC_BASE_URL`)
   - **Zhipu mode**: fetches GLM Coding Plan usage from `open.bigmodel.cn/api/paas/v4/billing/quota`
   - **Claude mode**: fetches usage from `api.anthropic.com/api/oauth/usage`
   - Local cost tracking scans `~/.claude/projects/**/*.jsonl`
3. Usage data is cached under `/tmp/sl-*` with a 2–5 minute TTL.

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

## Roadmap

- [ ] Support more GLM model pricing tiers
- [ ] Add Windows/Linux keychain support for OAuth credentials
- [ ] Configurable balance/cost threshold alerts
- [ ] Custom API endpoint support
- [ ] More language translations

## Contributing

Contributions welcome — feel free to open a pull request.

## Acknowledgments

- [cc-costline](https://github.com/Ventuss-OvO/cc-costline) by Ventuss — original project
- [ccclub](https://github.com/mazzzystar/ccclub) by 碎瓜 — Claude Code leaderboard

## License

MIT
