function pad2(value) {
  return String(value).padStart(2, "0");
}

function formatDateTime(
  dateInput = new Date(),
  timeZone = "America/Toronto",
  { includeTimeZoneName = false } = {}
) {
  const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    ...(includeTimeZoneName ? { timeZoneName: "short" } : {}),
  });
  const parts = formatter.formatToParts(date);

  const values = {};
  for (const part of parts) {
    if (part.type !== "literal") values[part.type] = part.value;
  }

  const base = `${values.year}-${pad2(values.month)}-${pad2(values.day)} ${pad2(values.hour)}:${pad2(values.minute)}:${pad2(values.second)}`;
  return includeTimeZoneName && values.timeZoneName
    ? `${base} ${values.timeZoneName}`
    : base;
}

function buildAccountNotification({
  name,
  success,
  balance,
  error,
  sentAt = new Date(),
  timeZone = "Asia/Shanghai",
}) {
  const status = success ? "签到成功" : "签到失败";
  const detail = success
    ? `余额: ${balance || "未知"}`
    : `错误: ${error || "未知错误"}`;
  const sentTime = formatDateTime(sentAt, timeZone);
  return {
    title: "AnyRouter 签到",
    message: `账号: ${name} | ${status} | ${detail} | 发送时间: ${sentTime}`,
  };
}

function normalizeAccountResult(account) {
  return {
    name: account.name,
    success: Boolean(account.success),
    balance: account.balance || null,
    spent: account.spent || null,
    error: account.error || null,
  };
}

function deriveStatus({ skipped, accounts, error }) {
  if (skipped) return "skipped";
  if (error && accounts.length === 0) return "failed";

  const failureCount = accounts.filter((account) => !account.success).length;
  if (failureCount === 0) return "success";
  if (failureCount === accounts.length) return "failed";
  return "partial_failure";
}

function buildRunSummary({
  startedAt,
  finishedAt,
  skipped = false,
  skipReason = null,
  accounts = [],
  error = null,
}) {
  const normalizedAccounts = accounts.map(normalizeAccountResult);
  const successCount = normalizedAccounts.filter((account) => account.success).length;
  const failureCount = normalizedAccounts.length - successCount;

  return {
    startedAt,
    finishedAt,
    skipped,
    skipReason,
    error,
    status: deriveStatus({
      skipped,
      accounts: normalizedAccounts,
      error,
    }),
    successCount,
    failureCount,
    accounts: normalizedAccounts,
  };
}

function formatAccountLine(account) {
  if (account.success) {
    return `- ${account.name}: 成功, 余额 ${account.balance || "未知"}`;
  }

  return `- ${account.name}: 失败, 错误 ${account.error || "未知错误"}`;
}

function formatTelegramSummary(summary, { timeZone = "America/Toronto" } = {}) {
  const lines = [
    "AnyRouter 签到汇总",
    `时间: ${formatDateTime(summary.finishedAt || summary.startedAt, timeZone, {
      includeTimeZoneName: true,
    })}`,
  ];

  if (summary.skipped) {
    lines.push("状态: 已跳过");
    if (summary.skipReason) lines.push(`原因: ${summary.skipReason}`);
    return lines.join("\n");
  }

  lines.push(`状态: ${summary.successCount} 成功 / ${summary.failureCount} 失败`);

  if (summary.error) {
    lines.push(`错误: ${summary.error}`);
  }

  if (summary.accounts.length > 0) {
    lines.push(...summary.accounts.map(formatAccountLine));
  }

  return lines.join("\n");
}

module.exports = {
  buildAccountNotification,
  buildRunSummary,
  formatDateTime,
  formatTelegramSummary,
};
