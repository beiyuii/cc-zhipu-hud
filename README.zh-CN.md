[English](README.md) | [中文](README.zh-CN.md)

# cc-zhipu-hud

为 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 打造的增强状态栏 — 支持 **智谱 AI/GLM 余额追踪**。

从 [cc-costline](https://github.com/Ventuss-OvO/cc-costline) 分支而来，为使用 [智谱 AI](https://bigmodel.cn/) API 代理的用户增加了余额显示功能。

## 运行前提（缺一则无法正常执行）

> **本插件不能独立运行。** 只有 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 在每一轮对话里调用已配置的状态栏命令时，HUD 才会执行。以下任一项缺失，都会导致状态栏不生效或依赖接口的段落无法更新。

| 必须具备 | 原因 |
|----------|------|
| **已安装并使用 Claude Code** | 宿主环境；没有 Claude Code 就没有状态栏入口。 |
| **Node.js ≥ 22** | `cc-zhipu-hud` 命令由 Node 执行（见 `package.json` 的 `engines`）。 |
| **已安装本包且成功执行 `cc-zhipu-hud install`** | `install` 会写入 `~/.claude/settings.json`，Claude Code 才知道要调用哪个命令；跳过则插件永远不会被调用。 |
| **系统 `PATH` 中有 `curl`** | 智谱配额、Anthropic 用量、可选 ccclub 排行等请求均通过 `curl` 发起。 |
| **可访问外网** | 上述 API 需能从本机访问。 |
| **`ANTHROPIC_AUTH_TOKEN` 及对应模式下的环境变量** | 智谱代理：将 `ANTHROPIC_BASE_URL` 设为 bigmodel 地址，令牌填智谱 API Key；官方 Claude：由 Claude Code 提供 OAuth 令牌。没有有效令牌则用量/余额相关行无法刷新。 |

**可选：** 若需要排行榜段落，需另行安装 [ccclub](https://github.com/mazzzystar/ccclub)。

## 功能

```
[Model] │ Project │ git:(main)
 Context ░░░░░░░░░░ 45% │ 5h:████░░░░ 40% │ 7d:██░░░░░░ 20%
```

| 模块 | 示例 | 说明 |
|------|------|------|
| 模型 | `[Opus 4.6 (1M)]` | 当前使用的模型名称 |
| 项目 | `cc-zhipu-hud` | 当前项目目录 |
| Git | `git:(main)` | 当前分支（有未提交更改时显示 `*`） |
| 上下文 | `░░░░░░░░░░ 45%` | 上下文窗口使用率，带进度条 |
| 5小时使用率 | `5h:████░░░░ 40%` | 5小时滚动使用率（GLM Coding Plan 或 Claude） |
| 7天使用率 | `7d:██░░░░░░ 20%` | 7天滚动使用率 |
| 排行榜 | `#2/22 $67.0` | [ccclub](https://github.com/mazzzystar/ccclub) 排名（需安装） |

### 智能 API 检测

- **智谱 AI 用户**：显示 GLM Coding Plan 的 5h/7d 使用率
- **官方 API 用户**：显示 Claude 5h/7d 使用限额
- 根据配置的 `ANTHROPIC_BASE_URL` 自动检测

### 颜色规则

- **上下文和使用率** — 绿色（< 60%）→ 橙色（60-79%）→ 红色（≥ 80%）
- **排行榜排名** — 第 1 名金色，第 2 名白色，第 3 名橙色，其余青色

## 安装

任选下面 **一种** 方式。两种路径最终都要执行 `cc-zhipu-hud install`，并 **新开 Claude Code 会话** 才能看到状态栏。

### 1. AI 代理自动操作

适用于由 IDE / 助手（如 Cursor、Claude Code）代为在终端执行命令的场景。

1. **向代理说明目标**：从 `https://github.com/beiyuii/cc-zhipu-hud` 安装本仓库，执行构建与全局链接，再运行 `cc-zhipu-hud install`；并确认本机已满足 Node ≥ 22、`curl` 可用等 **运行前提**。
2. **由代理执行**（在存放仓库的目录下）：

```bash
git clone https://github.com/beiyuii/cc-zhipu-hud.git
cd cc-zhipu-hud
npm install
npm run build
npm link
cc-zhipu-hud install
```

3. **密钥不要进对话**：不要把 API Key 粘贴到聊天里。请 **自行** 编辑 `~/.claude/settings.json`（见下文 **配置**），或在本地编辑器里确认代理提议的修改范围后再保存。
4. **由你本人** 新开一个 Claude Code 会话，查看状态栏是否出现。

若包已发布到 npm，也可让代理改为执行：

```bash
npm i -g cc-zhipu-hud && cc-zhipu-hud install
```

（省略克隆与本地构建。）

### 2. 人类手动操作

1. **先核对** 上文 **运行前提**：Node.js ≥ 22、`curl`、已安装 Claude Code。
2. **在终端克隆并构建**：

```bash
git clone https://github.com/beiyuii/cc-zhipu-hud.git
cd cc-zhipu-hud
npm install
npm run build
npm link
```

3. **向 Claude Code 注册状态栏**：

```bash
cc-zhipu-hud install
```

4. **按需配置** `~/.claude/settings.json`（智谱用户见下文 **配置**）。
5. **重启** Claude Code 或 **新开会话**，使状态栏生效。

**从 npm 安装**（发布后）可将第 2–3 步替换为：

```bash
npm i -g cc-zhipu-hud && cc-zhipu-hud install
```

## 配置

### 智谱 AI 用户

确保你的 `~/.claude/settings.json` 包含：

```json
{
  "env": {
    "ANTHROPIC_AUTH_TOKEN": "your-zhipu-api-key",
    "ANTHROPIC_BASE_URL": "https://open.bigmodel.cn/api/anthropic"
  }
}
```

HUD 会自动检测智谱代理并显示你的余额。

## 命令

```bash
cc-zhipu-hud install    # 设置 Claude Code 集成
cc-zhipu-hud uninstall  # 从设置中移除
cc-zhipu-hud refresh    # 手动重新计算费用缓存
```

## 工作原理

1. `install` 配置 `~/.claude/settings.json` — 设置状态栏命令
2. `render` 在每次对话时被 Claude Code 调用：
   - 检测是否使用智谱 AI 代理（通过 `ANTHROPIC_BASE_URL`）
   - **智谱模式**：从 `open.bigmodel.cn/api/paas/v4/billing/quota` 获取 GLM Coding Plan 使用率
   - **Claude 模式**：从 `api.anthropic.com/api/oauth/usage` 获取使用量
   - 本地费用追踪扫描 `~/.claude/projects/**/*.jsonl`
3. 使用率数据缓存于 `/tmp/sl-*`，TTL 为 2-5 分钟。

## 开发

```bash
npm run build   # 编译 TypeScript
npm test        # 构建 + 运行单元测试
```

## 卸载

```bash
cc-zhipu-hud uninstall
npm unlink cc-zhipu-hud
```

## 路线图

- [ ] 支持更多 GLM 模型定价档位
- [ ] 添加 Windows/Linux 钥匙串支持以获取 OAuth 凭证
- [ ] 添加可配置的余额/费用阈值告警
- [ ] 支持自定义 API 端点
- [ ] 添加更多语言翻译

## 贡献

欢迎贡献！请随时提交 Pull Request。

## 致谢

- [cc-costline](https://github.com/Ventuss-OvO/cc-costline) by Ventuss — 原始项目
- [ccclub](https://github.com/mazzzystar/ccclub) by 碎瓜 — Claude Code 排行榜

## 许可证

MIT
