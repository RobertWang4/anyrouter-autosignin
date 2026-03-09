const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildAccountNotification,
  buildRunSummary,
  formatDateTime,
  formatTelegramSummary,
} = require("../checkin-report");

test("formatDateTime should format Beijing time with second precision", () => {
  const d = new Date("2026-03-03T00:00:00Z");
  assert.equal(formatDateTime(d, "Asia/Shanghai"), "2026-03-03 08:00:00");
});

test("buildAccountNotification should create one message per account with send time", () => {
  const report = buildAccountNotification({
    name: "wcw",
    success: false,
    balance: "$0.00",
    sentAt: new Date("2026-03-03T00:00:00Z"),
    timeZone: "Asia/Shanghai",
  });

  assert.equal(report.title, "AnyRouter 签到");
  assert.match(report.message, /发送时间: 2026-03-03 08:00:00/);
  assert.match(report.message, /账号: wcw/);
  assert.match(report.message, /签到失败/);
});

test("formatTelegramSummary should include balances and failure reasons", () => {
  const summary = buildRunSummary({
    startedAt: "2026-03-09T14:26:16Z",
    finishedAt: "2026-03-09T14:38:09Z",
    accounts: [
      { name: "wmc", success: true, balance: "$500.00", spent: "$0.00" },
      { name: "wcw", success: false, error: "Timeout 60000ms exceeded" },
    ],
  });

  const message = formatTelegramSummary(summary, {
    timeZone: "America/Toronto",
  });

  assert.match(message, /AnyRouter 签到汇总/);
  assert.match(message, /时间: 2026-03-09 10:38:09/);
  assert.match(message, /状态: 1 成功 \/ 1 失败/);
  assert.match(message, /- wmc: 成功, 余额 \$500\.00/);
  assert.match(message, /- wcw: 失败, 错误 Timeout 60000ms exceeded/);
});

test("formatTelegramSummary should describe skipped runs", () => {
  const summary = buildRunSummary({
    startedAt: "2026-03-09T14:26:16Z",
    finishedAt: "2026-03-09T14:26:17Z",
    skipped: true,
    skipReason: "今日已签到，跳过",
  });

  const message = formatTelegramSummary(summary, {
    timeZone: "America/Toronto",
  });

  assert.match(message, /状态: 已跳过/);
  assert.match(message, /原因: 今日已签到，跳过/);
});

test("buildRunSummary should mark config errors as failed runs", () => {
  const summary = buildRunSummary({
    startedAt: "2026-03-09T14:26:16Z",
    finishedAt: "2026-03-09T14:26:17Z",
    error: "config.json 中没有配置任何账号",
  });

  assert.equal(summary.status, "failed");
  assert.equal(summary.successCount, 0);
  assert.equal(summary.failureCount, 0);
  assert.equal(summary.error, "config.json 中没有配置任何账号");
});
