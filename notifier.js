const { execFileSync } = require("child_process");

function toFileUrl(filePath) {
  return `file://${filePath}`;
}

function escapeAppleScriptString(value) {
  return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function buildNotificationPlans(title, message, openPath) {
  const openUrl = toFileUrl(openPath);
  const escapedTitle = escapeAppleScriptString(title);
  const escapedMessage = escapeAppleScriptString(message);
  return [
    {
      bin: "terminal-notifier",
      args: [
        "-title",
        title,
        "-message",
        message,
        "-open",
        openUrl,
      ],
    },
    {
      bin: "osascript",
      args: [
        "-e",
        `display notification "${escapedMessage}" with title "${escapedTitle}"`,
      ],
    },
  ];
}

function notifyWithFallback(title, message, openPath, run = execFileSync) {
  const plans = buildNotificationPlans(title, message, openPath);
  for (const plan of plans) {
    try {
      run(plan.bin, plan.args, { stdio: "ignore" });
      return true;
    } catch {
      // Try the next notifier implementation.
    }
  }
  return false;
}

module.exports = {
  buildNotificationPlans,
  notifyWithFallback,
  toFileUrl,
};
