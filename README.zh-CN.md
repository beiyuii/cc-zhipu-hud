[English](README.md) | [中文](README.zh-CN.md)

# cc-zhipu-hud

<p align="center">
  <img src="screenshot.png" alt="cc-zhipu-hud 截图" width="720" />
</p>

<p align="center">
  <strong>Claude Code 增强状态栏，支持智谱 AI / GLM 余额追踪。</strong>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/cc-zhipu-hud"><img src="https://img.shields.io/npm/v/cc-zhipu-hud" alt="npm version" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/npm/l/cc-zhipu-hud" alt="license" /></a>
  <a href="https://nodejs.org/"><img src="https://img.shields.io/node/v/cc-zhipu-hud" alt="node version" /></a>
</p>

---

**cc-zhipu-hud** 替代 Claude Code 的默认状态栏，提供一个丰富的信息面板，展示上下文使用率、Token 消耗、API 费用，以及为智谱 AI / GLM 用户定制的 Coding Plan 配额和余额实时追踪。

基于 [cc-costline](https://github.com/Ventuss-OvO/cc-costline) 分支而来，并深度集成智谱平台能力。

## 功能一览

```
[Opus 4.6 (1M)] │ cc-zhipu-hud │ git:(main)
Context ░░░░░░░░░░ 45% │ 5h:████░░░░ 40% │ 7d:██░░░░░░ 20%
```

### 状态栏模块

| 模块 | 示例 | 说明 |
|--------|---------|-------------|
| **模型** | `[Opus 4.6 (1M)]` | 当前模型（自动缩短显示名） |
| **项目** | `cc-zhipu-hud` | 当前工作目录名 |
| **Git** | `git:(main)*` | 当前分支（`*` 表示有未提交更改） |
| **上下文** | `░░░░░░░░░░ 45%` | 上下文窗口使用率 + 进度条 |
| **5h 用量** | `5h:████░░░░ 40%` | 5 小时滚动限额使用率 |
| **7d 用量** | `7d:██░░░░░░ 20%` | 7 天累计使用率 |
| **余额** | `¥142.50` | 剩余 Token 余额（智谱模式） |
| **排行榜** | `#2/22 $67.0` | [ccclub](https://github.com/mazzzystar/ccclub) 排名 |

### 智能 API 检测

无需手动配置 — HUD 会在启动时检查 `ANTHROPIC_BASE_URL`：

- **智谱 AI 代理**（`*.bigmodel.cn`）→ 显示 GLM Coding Plan 配额 + Token 余额
- **Anthropic 官方 API** → 显示 Claude 使用限额，自动处理 OAuth Token 刷新

### 颜色规则

- **上下文与用量**：绿色（<60%）→ 橙色（60–79%）→ 红色（≥80%）
- **排行榜**：第 1 名金色，第 2 名白色，第 3 名橙色，其余青色

### 可靠缓存

所有外部 API 数据均缓存于 `/tmp/sl-*`，带智能重试机制：

- **本地费用**：2 分钟 TTL（检测到新对话记录时立即刷新）
- **API 配额**：5 分钟重试间隔（请求失败时保留旧数据，不作废）
- **Token 感知**：OAuth Token 轮换时自动触发即时刷新

## 运行前提

| 必须满足 | 原因 |
|----------|------|
| **已安装 Claude Code** | 宿主环境，没有它则没有状态栏入口 |
| **Node.js ≥ 22** | 运行时要求（见 `package.json` → `engines`） |
| **系统 PATH 中有 `curl`** | API 请求通过 `curl` 发起（配额、用量、排行榜） |
| **可访问外网** | 智谱 / Anthropic 接口需要能连通 |
| **`ANTHROPIC_AUTH_TOKEN`** | 两种模式下都需要，否则用量/余额无法刷新 |

**可选：** 如需排行榜功能，请安装 [ccclub](https://github.com/mazzzystar/ccclub)。

## 安装

### 快速安装（npm）

```bash
npm i -g cc-zhipu-hud && cc-zhipu-hud install
```

然后**新开一个** Claude Code 会话即可看到状态栏。

### 从源码安装

```bash
git clone https://github.com/beiyuii/cc-zhipu-hud.git
cd cc-zhipu-hud
npm install && npm run build
npm link
cc-zhipu-hud install
```

### 作为 Claude Code 插件安装

也可以通过 Claude Code 的 `/plugin` 命令安装：

1. 添加插件市场：
   ```
   /plugin marketplace add beiyuii/cc-zhipu-hud
   ```
2. 安装插件：
   ```
   /plugin install cc-zhipu-hud
   ```

## 配置

### 智谱 AI 用户

在 `~/.claude/settings.json` 中设置：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "你的智谱-API-Key",
    "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic"
  }
}
```

HUD 会自动检测智谱代理，显示 GLM Coding Plan 配额和 Token 余额。

### Claude 官方 API 用户

无需额外配置 — Claude Code 自动管理 OAuth Token，状态栏会直接显示 Claude 使用限额。

### 费用统计周期

```bash
cc-zhipu-hud config --period 7d    # 最近 7 天（默认）
cc-zhipu-hud config --period 30d   # 最近 30 天
cc-zhipu-hud config --period both  # 同时显示两个周期
```

## 命令

```bash
cc-zhipu-hud install          # 注册到 Claude Code 设置
cc-zhipu-hud uninstall        # 从设置中移除
cc-zhipu-hud config --period  # 查看/修改费用统计周期
cc-zhipu-hud refresh          # 手动重新计算本地费用缓存
```

## 工作原理

```
┌─────────────┐   render (stdin JSON)    ┌──────────────┐
│  Claude Code │ ──────────────────────> │ cc-zhipu-hud │
│   (每次      │                         │   状态栏      │
│    对话)     │ <────────────────────── │   渲染器      │
└─────────────┘   格式化状态栏输出        └──────┬───────┘
                                                │
                ┌───────────────────────────────┼───────────────┐
                │                               │               │
                ▼                               ▼               ▼
        ┌─────────────┐               ┌──────────────┐ ┌────────────┐
        │ 本地费用     │               │ 智谱配额     │ │ Claude     │
        │ (~/...jsonl)│               │ (bigmodel.cn)│ │ 用量 API   │
        └─────────────┘               └──────────────┘ └────────────┘
                │                               │               │
                └───────────────────────────────┼───────────────┘
                                                ▼
                                       ┌────────────────┐
                                       │  /tmp/sl-*     │
                                       │  (TTL 缓存)    │
                                       └────────────────┘
```

1. Claude Code 每次对话时调用 `cc-zhipu-hud render`，通过 stdin 传入会话 JSON
2. `render()` 读取 stdin 获取会话元数据（费用、模型、上下文百分比）和对话记录以统计 Token 数
3. 三个数据源以独立 TTL 行内刷新：
   - **本地费用**：`collectCosts()` 扫描 `~/.claude/projects/` 下的所有 `.jsonl` 文件（2 分钟 TTL）
   - **智谱配额**：`getGlmCodingPlanUsage()` 从 `open.bigmodel.cn` 获取 5 小时/每周限额（5 分钟重试间隔）
   - **智谱余额**：`getZhipuBalance()` 从 `bigmodel.cn/api/biz/tokenAccounts` 获取 Token 资源包（5 分钟重试间隔）
   - **Claude 用量**：从 `api.anthropic.com/api/oauth/usage` 获取（5 分钟重试间隔，OAuth Token 感知）
   - **ccclub 排名**：若已安装，从 `ccclub.dev/api/rank` 获取（5 分钟重试间隔）
4. 会话结束时，`SessionEnd` Hook 触发 `cc-zhipu-hud refresh` 预热费用缓存

## 开发

```bash
npm install          # 安装依赖
npm run build        # 编译 TypeScript（→ dist/）
npm test             # 编译 + 运行 63 个单元测试
npm link             # 创建符号链接用于本地调试
```

### 项目结构

```
src/
├── cli.ts          # CLI 入口（install, uninstall, config, refresh, render）
├── statusline.ts   # 渲染逻辑，统一 TTL 缓存数据刷新
├── collector.ts    # 扫描 ~/.claude/projects/**/*.jsonl 统计 Token
├── calculator.ts   # 按模型定价查询与费用计算
├── cache.ts        # 缓存/配置读写（~/.cc-zhipu-hud/）
└── zhipu.ts        # 智谱 AI 余额 + GLM Coding Plan 配额获取
test/
├── statusline.test.ts   # 格式化、颜色、倒计时函数
├── calculator.test.ts   # 定价查询、费用计算
├── cache.test.ts        # 缓存/配置读写、异常场景
├── collector.test.ts    # 基于 mock jsonl 的费用统计
└── render.test.ts       # 渲染输出格式、ANSI 颜色
```

### 测试

63 个测试覆盖 5 个文件（~79% 行覆盖率，~89% 函数覆盖率），使用 `node:test` + `node:assert/strict`。

## 路线图

- [ ] 支持 GLM 多 Token 计价模型档位
- [ ] 可配置的余额/费用阈值告警
- [ ] Windows / Linux 钥匙串凭据支持
- [ ] 自定义 API 端点支持
- [ ] 更多语言翻译

## 贡献者

感谢以下开发者：

- [Ventuss-OvO](https://github.com/Ventuss-OvO) — 原作者，创建了 [cc-costline](https://github.com/Ventuss-OvO/cc-costline)，本项目的基础
- [beiyuii](https://github.com/beiyuii) — 智谱 AI / GLM 集成、插件系统、缓存、项目维护
- [yinyajiang](https://github.com/yinyajiang) — Windows 跨平台支持

## 贡献

欢迎提交 Issue 和 Pull Request。提交 PR 前请：

1. 运行 `npm test` 确保所有测试通过
2. 保持零运行时依赖的约束
3. 格式化/颜色函数保持纯函数并编写测试

## 致谢

- [cc-costline](https://github.com/Ventuss-OvO/cc-costline) by Ventuss — Claude Code 状态栏原始项目
- [ccclub](https://github.com/mazzzystar/ccclub) by 碎瓜 — Claude Code 费用排行榜
- [智谱 AI](https://bigmodel.cn/) — GLM 模型 API 和 Coding Plan

## 许可证

[MIT](LICENSE)
