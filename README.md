# AnyRouter AutoSignIn

[AnyRouter](https://anyrouter.top) 每日自动签到脚本，基于 Playwright 无头浏览器实现，支持多账号批量处理。

## 功能

- 多账号批量自动登录签到
- 自动处理公告弹窗与 WAF 验证
- 登录后自动读取当前余额与历史消耗
- 反检测：隐藏 `navigator.webdriver`、模拟 `window.chrome` 等浏览器指纹
- 随机延迟：启动前随机等待 1~10 分钟，多账号间随机间隔 30~90 秒
- 当日去重：同一天内不会重复签到
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

### 定时执行

本地优先，云端兜底。脚本内置当日去重逻辑，同一天不会重复签到。

#### 1. macOS launchd（本地优先，每天 08:00）

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

> **注意：** 如果你的 node 不在 `/usr/local/bin/node`，需要修改 plist 文件中的路径。
> 运行 `which node` 查看实际路径。

#### 2. GitHub Actions（云端兜底，每天 22:00）

当电脑整天未开机时，GitHub Actions 在北京时间 22:00 兜底执行。

1. 将项目推送到 GitHub（**建议使用私有仓库**）
2. 在仓库 **Settings → Secrets and variables → Actions** 中添加一个 Secret：
   - 名称：`CONFIG_JSON`
   - 值：你的 `config.json` 完整内容
3. 工作流已配置在 `.github/workflows/checkin.yml`，每天北京时间 22:00 自动执行
4. 也可以在 Actions 页面手动点击 **Run workflow** 触发

> **注意：** GitHub Actions 与本地不共享去重状态。如果本地当天已经签到，Actions 仍会再执行一次。
> 这意味着同一天可能出现两次登录（不同 IP）。如果你对此敏感，可以只使用 launchd，不启用 Actions。
>
> 失败时日志和截图会作为 Artifact 上传，可在 Actions 页面下载查看。

## 日志与排错

- 运行日志追加写入项目根目录下的 `checkin.log`
- 登录失败时自动保存截图为 `error-{账号名}.png`，可据此排查页面变化或网络问题

## 项目结构

```
.
├── .github/workflows/
│   └── checkin.yml             # GitHub Actions 工作流
├── checkin.js                  # 主签到脚本
├── config.json                 # 账号配置文件（不提交）
├── config.example.json         # 配置模板
├── com.anyrouter.checkin.plist # macOS launchd 定时任务
├── checkin.log                 # 运行日志（自动生成）
├── error-*.png                 # 失败截图（自动生成）
└── package.json
```

## License

ISC
