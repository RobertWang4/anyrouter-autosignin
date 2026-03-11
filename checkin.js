#!/usr/bin/env node
/**
 * AnyRouter 每日自动签到脚本（Playwright 版，多账号）
 * 使用无头浏览器登录，自动处理 WAF，直接读取页面余额
 */

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { buildRunSummary } = require("./checkin-report");
const { notifyWithFallback } = require("./notifier");

const SCRIPT_DIR = __dirname;
const CONFIG_FILE = path.join(SCRIPT_DIR, "config.json");
const LOG_FILE = path.join(SCRIPT_DIR, "checkin.log");
const SUMMARY_FILE = path.join(SCRIPT_DIR, "checkin-summary.json");
const LAUNCHD_LOG_FILE = path.join(SCRIPT_DIR, "launchd.log");
const MARKER_FILE = path.join(SCRIPT_DIR, ".last-checkin");
const BASE_URL = "https://anyrouter.top";

function todayStr() {
  return new Date().toISOString().slice(0, 10); // "2026-02-22"
}

function alreadyCheckedInToday() {
  try {
    return fs.readFileSync(MARKER_FILE, "utf-8").trim() === todayStr();
  } catch {
    return false;
  }
}

function markCheckedIn() {
  fs.writeFileSync(MARKER_FILE, todayStr(), "utf-8");
}

function randomDelay(minMs, maxMs) {
  const ms = Math.floor(Math.random() * (maxMs - minMs)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(message) {
  const timestamp = new Date().toLocaleString("zh-CN", { hour12: false });
  const line = `[${timestamp}] ${message}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + "\n", "utf-8");
}

function notify(title, message) {
  notifyWithFallback(title, message, LAUNCHD_LOG_FILE);
}

function writeRunSummary(summaryInput) {
  const summary = buildRunSummary(summaryInput);
  fs.writeFileSync(SUMMARY_FILE, JSON.stringify(summary, null, 2) + "\n", "utf-8");
  return summary;
}

function accountKey(account) {
  return account.name || account.username;
}

function collectFinalResults(accounts, finalResults) {
  return accounts.map((account) => {
    const key = accountKey(account);
    return finalResults.get(key) || {
      name: key,
      success: false,
      error: "未执行",
    };
  });
}

function loadConfig() {
  const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
  const config = JSON.parse(raw);
  if (!config.accounts || config.accounts.length === 0) {
    throw new Error("config.json 中没有配置任何账号");
  }
  return config.accounts;
}

const REAL_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// 注入脚本：隐藏自动化痕迹
const STEALTH_SCRIPT = `
  // 隐藏 navigator.webdriver
  Object.defineProperty(navigator, 'webdriver', { get: () => false });

  // 模拟 window.chrome
  window.chrome = {
    runtime: {
      onMessage: { addListener() {}, removeListener() {} },
      sendMessage() {},
      connect() { return { onMessage: { addListener() {} }, postMessage() {} }; }
    },
    app: { isInstalled: false },
    csi() {},
    loadTimes() {}
  };

  // 模拟浏览器插件列表
  Object.defineProperty(navigator, 'plugins', {
    get: () => {
      const p = [
        { name: 'Chrome PDF Plugin', filename: 'internal-pdf-viewer', description: 'Portable Document Format' },
        { name: 'Chrome PDF Viewer', filename: 'mhjfbmdgcfjbbpaeojofohoefgiehjai', description: '' },
        { name: 'Native Client', filename: 'internal-nacl-plugin', description: '' }
      ];
      p.length = 3;
      return p;
    }
  });

  // 模拟 permissions API
  const origQuery = window.navigator.permissions?.query?.bind(window.navigator.permissions);
  if (origQuery) {
    window.navigator.permissions.query = (params) =>
      params.name === 'notifications'
        ? Promise.resolve({ state: Notification.permission })
        : origQuery(params);
  }
`;

async function checkinAccount(browser, account) {
  const name = account.name || account.username;
  const context = await browser.newContext({
    locale: "zh-CN",
    userAgent: REAL_UA,
    viewport: { width: 1920, height: 1080 },
    screen: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  // 注入反检测脚本（在所有页面加载前生效）
  await page.addInitScript(STEALTH_SCRIPT);

  try {
    // 1. 打开登录页
    await page.goto(`${BASE_URL}/login`, { waitUntil: "domcontentloaded", timeout: 60000 });

    // 等待页面渲染
    await randomDelay(2000, 4000);

    // 关闭公告弹窗（如果有）
    try {
      await page.locator('button:has-text("关闭公告"), button:has-text("Close Notice")').click({ timeout: 5000 });
      await randomDelay(300, 800);
    } catch {}

    // 2. 填写表单并登录（页面可能直接显示表单，或需要先点击"邮箱登录"）
    const emailInput = page.locator('input[placeholder*="用户名"], input[placeholder*="邮箱"]').first();
    if (!(await emailInput.isVisible({ timeout: 3000 }).catch(() => false))) {
      // 需要先点击邮箱登录按钮
      await page.locator('button:has-text("邮箱"), button:has-text("Email")').click({ timeout: 5000 });
    }

    await emailInput.type(account.username, { delay: 50 + Math.random() * 80 });
    await randomDelay(300, 700);
    await page.locator('input[placeholder*="密码"], input[placeholder*="password"]').first()
      .type(account.password, { delay: 40 + Math.random() * 60 });
    await randomDelay(500, 1200);
    await page.locator('button:has-text("继续"), button:has-text("Continue")').click();

    // 4. 等待进入控制台
    await page.waitForURL("**/console**", { timeout: 60000 });

    // 5. 等待余额数据加载
    await randomDelay(3000, 6000);

    // 6. 读取当前余额和历史消耗
    const pageText = await page.content();
    const balanceMatch = pageText.match(/当前余额[\s\S]*?(\$[\d.]+)/);
    const spentMatch = pageText.match(/历史消耗[\s\S]*?(\$[\d.]+)/);
    const balance = balanceMatch ? balanceMatch[1] : "未知";
    const spent = spentMatch ? spentMatch[1] : "未知";

    log(`[${name}] 签到成功 | 当前余额: ${balance} | 历史消耗: ${spent}`);
    return {
      name,
      success: true,
      balance,
      spent,
      error: null,
    };
  } catch (e) {
    // 保存截图方便排查
    try {
      await page.screenshot({ path: path.join(SCRIPT_DIR, `error-${name}.png`) });
    } catch {}
    log(`[${name}] 签到失败: ${e.message}`);
    return {
      name,
      success: false,
      balance: null,
      spent: null,
      error: e.message,
    };
  } finally {
    await context.close();
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  const testMode = process.argv.includes("--now");
  let accounts = [];
  const finalResults = new Map();

  try {
    // 当日去重：已签到则跳过（测试模式除外）
    if (!testMode && alreadyCheckedInToday()) {
      const skipReason = "今日已签到，跳过";
      log(skipReason);
      writeRunSummary({
        startedAt,
        finishedAt: new Date().toISOString(),
        skipped: true,
        skipReason,
      });
      return;
    }

    // 随机延迟 1~10 分钟，避免每天固定时间请求（测试模式跳过）
    if (!testMode) {
      const delayMs = Math.floor(Math.random() * (10 * 60 * 1000 - 60 * 1000)) + 60 * 1000;
      log(`等待 ${Math.round(delayMs / 1000)} 秒后开始签到...`);
      await randomDelay(delayMs, delayMs);
    }

    log("==================================================");
    log("开始执行 AnyRouter 每日签到");

    try {
      accounts = loadConfig();
    } catch (e) {
      log(`配置错误: ${e.message}`);
      writeRunSummary({
        startedAt,
        finishedAt: new Date().toISOString(),
        error: e.message,
      });
      return;
    }

    const MAX_RETRIES = 3;
    const RETRY_DELAY_MIN = 5 * 60 * 1000;  // 5 分钟
    const RETRY_DELAY_MAX = 10 * 60 * 1000; // 10 分钟

    let failedAccounts = [...accounts];
    let attempt = 0;

    while (failedAccounts.length > 0 && attempt < MAX_RETRIES) {
      attempt++;
      if (attempt > 1) {
        const delayMs = Math.floor(Math.random() * (RETRY_DELAY_MAX - RETRY_DELAY_MIN)) + RETRY_DELAY_MIN;
        log(`第 ${attempt} 次重试，等待 ${Math.round(delayMs / 1000)} 秒...`);
        await randomDelay(delayMs, delayMs);
        log(`开始第 ${attempt} 次重试，共 ${failedAccounts.length} 个账号`);
      }

      const browser = await chromium.launch({ headless: true });
      const stillFailed = [];

      for (const acc of failedAccounts) {
        const result = await checkinAccount(browser, acc);
        finalResults.set(accountKey(acc), result);
        if (!result.success) stillFailed.push(acc);
        // 多账号之间随机间隔 30~90 秒
        if (acc !== failedAccounts[failedAccounts.length - 1]) {
          await randomDelay(30 * 1000, 90 * 1000);
        }
      }

      await browser.close();
      failedAccounts = stillFailed;
    }

    let runError = null;
    if (failedAccounts.length > 0) {
      const names = failedAccounts.map(accountKey).join(", ");
      runError = `以下账号经过 ${MAX_RETRIES} 次尝试仍签到失败: ${names}`;
      log(runError);
    }

    if (failedAccounts.length === 0) markCheckedIn();
    log("全部账号处理完毕");

    writeRunSummary({
      startedAt,
      finishedAt: new Date().toISOString(),
      accounts: collectFinalResults(accounts, finalResults),
      error: runError,
    });
  } catch (e) {
    const message = e.message || String(e);
    log(`程序异常: ${message}`);
    writeRunSummary({
      startedAt,
      finishedAt: new Date().toISOString(),
      accounts: collectFinalResults(accounts, finalResults),
      error: message,
    });
    process.exitCode = 1;
  }
}

main();
