[English](README.md) | [中文](README.zh-CN.md)

# cc-zhipu-hud

为 [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 打造的增强状态栏 — 支持 **智谱 AI/GLM 余额追踪**。

从 [cc-costline](https://github.com/Ventuss-OvO/cc-costline) 分支而来，为使用 [智谱 AI](https://bigmodel.cn/) API 代理的用户增加了余额显示功能。

## 功能

```
14.6k ~ $2.42 / 40% by GLM-5 | Zhipu ¥12.5 · 500k tokens | 30d: $866
```

| 模块 | 示例 | 说明 |
|------|------|------|
| Token ~ 费用 / 上下文 | `14.6k ~ $2.42 / 40% by GLM-5` | 会话 token 数量、费用、上下文使用率和模型 |
| **智谱余额** | `Zhipu ¥12.5 · 500k tokens` | **新增！** 使用 bigmodel.cn 代理时显示智谱账户余额 |
| 使用限额 | `5h: 45% / 7d: 8%` | Claude 5 小时和 7 天使用率（仅官方 API 显示） |
| 周期费用 | `30d: $866` | 滚动费用合计（可配置：7d、30d 或 both） |
| 排行榜 | `#2/22 $67.0` | [ccclub](https://github.com/mazzzystar/ccclub) 排名（需安装） |

### 智能 API 检测

- **智谱 AI 用户**：显示账户余额（现金 + 资源包），而非使用限额
- **官方 API 用户**：照常显示 Claude 5h/7d 使用限额
- 根据配置的 `ANTHROPIC_BASE_URL` 自动检测

### 颜色规则

- **上下文和使用限额** — 绿色（< 60%）→ 橙色（60-79%）→ 红色（≥ 80%）
- **智谱余额** — 现金青色，资源包紫色
- **排行榜排名** — 第 1 名金色，第 2 名白色，第 3 名橙色，其余青色
- **周期费用** — 黄色

## 安装

```bash
# 克隆并安装
git clone https://github.com/beiyuii/cc-zhipu-hud.git
cd cc-zhipu-hud
npm install
npm run build
npm link

# 设置 Claude Code 集成
cc-zhipu-hud install
```

或从 npm 安装（发布后）：

```bash
npm i -g cc-zhipu-hud && cc-zhipu-hud install
```

打开新的 Claude Code 会话即可看到增强状态栏。需要 Node.js >= 22。

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
cc-zhipu-hud install              # 设置 Claude Code 集成
cc-zhipu-hud uninstall            # 从设置中移除
cc-zhipu-hud refresh              # 手动重新计算费用缓存
cc-zhipu-hud config --period 7d   # 显示 7 天费用（默认）
cc-zhipu-hud config --period 30d  # 显示 30 天费用
cc-zhipu-hud config --period both # 同时显示两个周期
```

## 工作原理

1. `install` 配置 `~/.claude/settings.json` — 设置状态栏命令并添加会话结束 hook。
2. `render` 在每次对话时被 Claude Code 调用：
   - 检测是否使用智谱 AI 代理（通过 `ANTHROPIC_BASE_URL`）
   - **智谱模式**：从 `open.bigmodel.cn/api/paas/v4/billing/quota` 获取余额
   - **Claude 模式**：从 `api.anthropic.com/api/oauth/usage` 获取使用量
   - 本地费用追踪扫描 `~/.claude/projects/**/*.jsonl`
3. 余额/使用量数据缓存于 `/tmp/sl-*`，TTL 为 1-5 分钟。

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
