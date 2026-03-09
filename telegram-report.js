const fs = require("fs");
const path = require("path");

const { formatTelegramSummary } = require("./checkin-report");

const DEFAULT_SUMMARY_PATH = path.join(__dirname, "checkin-summary.json");

function getTelegramConfig(env = process.env) {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error("Missing TELEGRAM_BOT_TOKEN");
  }

  if (!env.TELEGRAM_CHAT_ID) {
    throw new Error("Missing TELEGRAM_CHAT_ID");
  }

  return {
    botToken: env.TELEGRAM_BOT_TOKEN,
    chatId: env.TELEGRAM_CHAT_ID,
    timeZone: env.TELEGRAM_TIME_ZONE || "America/Toronto",
  };
}

function buildTelegramRequest({ botToken, chatId, text }) {
  return {
    url: `https://api.telegram.org/bot${botToken}/sendMessage`,
    options: {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        disable_web_page_preview: true,
      }),
    },
  };
}

async function sendTelegramMessage(config, text, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") {
    throw new Error("fetch is not available");
  }

  const request = buildTelegramRequest({
    botToken: config.botToken,
    chatId: config.chatId,
    text,
  });

  const response = await fetchImpl(request.url, request.options);
  let payload = null;
  try {
    payload = await response.json();
  } catch {}

  if (!response.ok || (payload && payload.ok === false)) {
    throw new Error(
      payload?.description ||
      `Telegram API request failed with status ${response.status || "unknown"}`
    );
  }

  return payload;
}

function loadSummary(summaryPath = DEFAULT_SUMMARY_PATH) {
  const raw = fs.readFileSync(summaryPath, "utf-8");
  return JSON.parse(raw);
}

async function sendSummaryFromFile(
  summaryPath = DEFAULT_SUMMARY_PATH,
  env = process.env,
  fetchImpl = globalThis.fetch
) {
  const summary = loadSummary(summaryPath);
  const config = getTelegramConfig(env);
  const text = formatTelegramSummary(summary, { timeZone: config.timeZone });
  return sendTelegramMessage(config, text, fetchImpl);
}

async function main(argv = process.argv.slice(2)) {
  const summaryPath = argv[0] || DEFAULT_SUMMARY_PATH;
  await sendSummaryFromFile(summaryPath);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  buildTelegramRequest,
  getTelegramConfig,
  loadSummary,
  main,
  sendSummaryFromFile,
  sendTelegramMessage,
};
