# AnyRouter AutoSignIn

[AnyRouter](https://anyrouter.top) 每日自动签到脚本，基于 Playwright 无头浏览器实现，支持多账号批量处理。

## 功能

- 多账号批量自动登录签到
- 自动处理公告弹窗与 WAF 验证
- 登录后自动读取当前余额与历史消耗
- 反检测：隐藏 `navigator.webdriver`、模拟 `window.chrome` 等浏览器指纹
- 随机延迟：启动前随机等待 1~10 分钟，多账号间随机间隔 30~90 秒
- 当日去重：同一天内不会重复签到
- 失败自动重试：签到失败的账号自动重试最多 3 次，每次间隔 5~10 分钟
- 签到成功时推送本地通知（优先 `terminal-notifier`，失败自动回退 `osascript`）
- GitHub Actions 跑完后可选发送一条 Telegram 汇总消息
- 失败时自动截图保存，便于排查问题
- 带时间戳的日志记录

## 环境要求

- Node.js >= 18
- npm

## 安装

```bash
git clone git@github.com:RobertWang4/anyrouter-autosignin.git
cd anyrouter-autosignin
npm install
```

首次安装后 Playwright 会自动下载 Chromium 浏览器。如未自动下载，可手动执行：

```bash
npx playwright install chromium
```

## 配置

编辑项目根目录下的 `config.json`，按以下格式添加账号：

```json
{
  "accounts": [
    {
      "name": "显示名称",
      "username": "登录用户名或邮箱",
      "password": "登录密码"
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `name` | 日志中显示的账号别名（可选，缺省时使用 `username`） |
| `username` | AnyRouter 登录用户名或邮箱 |
| `password` | AnyRouter 登录密码 |

> **注意：** `config.json` 包含敏感信息，请勿提交到公开仓库。建议将其加入 `.gitignore`。

## 使用

```bash
node checkin.js
```

执行后脚本会依次处理每个账号，输出示例：

```
[2026/2/22 10:00:00] ==================================================
[2026/2/22 10:00:00] 开始执行 AnyRouter 每日签到
[2026/2/22 10:00:15] [robert] 签到成功 | 当前余额: $12.34 | 历史消耗: $5.67
[2026/2/22 10:00:30] 全部账号处理完毕
```

### 运行测试

项目包含 Node.js 原生测试，可执行：

```bash
npm test
```

### 定时执行

本地优先，云端兜底。脚本内置当日去重逻辑，同一天不会重复签到。

#### 1. macOS launchd（本地优先，每天 20:00）

与 cron 不同，launchd 在电脑睡眠/关机期间错过的任务会在唤醒后自动补跑。

```bash
# 安装到系统
cp com.anyrouter.checkin.plist ~/Library/LaunchAgents/

# 加载并启用
launchctl load ~/Library/LaunchAgents/com.anyrouter.checkin.plist
```

管理命令：

```bash
# 查看状态
launchctl list | grep anyrouter

# 手动触发一次
launchctl start com.anyrouter.checkin

# 停用
launchctl unload ~/Library/LaunchAgents/com.anyrouter.checkin.plist
```

> **注意：** 使用前需要修改 `com.anyrouter.checkin.plist` 中的两个路径：
> 1. node 路径 — 运行 `which node` 查看你的实际路径
> 2. `WorkingDirectory` — 改为你本机的项目目录

#### 2. GitHub Actions（云端兜底，每天 UTC 14:00）

当电脑整天未开机时，GitHub Actions 在云端兜底执行。按多伦多时区换算：

- 夏令时：每天 `10:00 EDT`
- 冬令时：每天 `09:00 EST`

1. 将项目推送到 GitHub（**建议使用私有仓库**）
2. 在仓库 **Settings → Secrets and variables → Actions** 中添加必需的 Secret：
   - 名称：`CONFIG_JSON`
   - 值：你的 `config.json` 完整内容
3. 如果希望工作流跑完后收到 Telegram 汇总，再额外添加两个 Secret：
   - 名称：`TELEGRAM_BOT_TOKEN`
   - 值：你的 Telegram Bot Token
   - 名称：`TELEGRAM_CHAT_ID`
   - 值：接收消息的个人或群组 Chat ID
4. 工作流已配置在 `.github/workflows/checkin.yml`，每天 `UTC 14:00` 自动执行，也可以在 Actions 页面手动点击 **Run workflow** 触发

##### Telegram 配置步骤

1. 在 Telegram 搜索 `@BotFather`
2. 发送 `/newbot`，按提示创建一个 Bot
3. 记录 BotFather 返回的 HTTP API Token，把它填到 `TELEGRAM_BOT_TOKEN`
4. 打开你刚创建的 Bot，对它发送一条任意消息
5. 在浏览器打开：

```text
https://api.telegram.org/bot<你的BotToken>/getUpdates
```

6. 在返回 JSON 里找到 `message.chat.id`
7. 把这个值填到 `TELEGRAM_CHAT_ID`

> 如果你想发到群组，先把 Bot 拉进群并在群里发一条消息，再从 `getUpdates` 里取对应的 `chat.id`。群组 ID 通常是负数。

##### Telegram 汇总消息内容

配置完成后，GitHub Actions 每次执行结束会发一条汇总消息，内容包括：

- 执行完成时间
- 成功/失败账号数量
- 每个账号的最终签到结果
- 成功账号的当前余额
- 失败账号的错误原因

> **注意：** GitHub Actions 与本地不共享去重状态。如果本地当天已经签到，Actions 仍会再执行一次。
> 这意味着同一天可能出现两次登录（不同 IP）。如果你对此敏感，可以只使用 launchd，不启用 Actions。
>
> `TELEGRAM_BOT_TOKEN` 和 `TELEGRAM_CHAT_ID` 没配置时，工作流会正常执行，只是不发送 Telegram。
>
> 失败时日志、结构化汇总和截图会作为 Artifact 上传，可在 Actions 页面下载查看。

## 日志与排错

- 运行日志追加写入项目根目录下的 `checkin.log`
- GitHub Actions 每次运行结束会生成 `checkin-summary.json`
- 登录失败时自动保存截图为 `error-{账号名}.png`，可据此排查页面变化或网络问题
- `launchd.log` 记录 macOS 定时任务执行输出（如果使用 launchd）
- `.last-checkin` 用于本地当日去重标记（自动生成）

## 项目结构

```
.
├── .github/workflows/
│   └── checkin.yml             # GitHub Actions 工作流
├── checkin-report.js           # 汇总生成与 Telegram 文案格式化
├── checkin.js                  # 主签到脚本
├── notifier.js                 # 本地通知实现（terminal-notifier + osascript 回退）
├── telegram-report.js          # Telegram 汇总发送脚本
├── config.json                 # 账号配置文件（不提交）
├── config.example.json         # 配置模板
├── com.anyrouter.checkin.plist # macOS launchd 定时任务
├── tests/                      # Node.js 原生测试
├── checkin.log                 # 运行日志（自动生成）
├── checkin-summary.json        # 结构化运行汇总（自动生成）
├── launchd.log                 # launchd 输出日志（自动生成）
├── .last-checkin               # 当日去重状态（自动生成）
├── error-*.png                 # 失败截图（自动生成）
└── package.json
```

## License

ISC
