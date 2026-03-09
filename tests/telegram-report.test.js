const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildTelegramRequest,
  getTelegramConfig,
  sendTelegramMessage,
} = require("../telegram-report");

test("buildTelegramRequest should create the Telegram Bot API payload", () => {
  const request = buildTelegramRequest({
    botToken: "123:abc",
    chatId: "456",
    text: "AnyRouter 签到汇总",
  });

  assert.equal(request.url, "https://api.telegram.org/bot123:abc/sendMessage");
  assert.equal(request.options.method, "POST");

  const body = JSON.parse(request.options.body);
  assert.equal(body.chat_id, "456");
  assert.equal(body.text, "AnyRouter 签到汇总");
  assert.equal(body.disable_web_page_preview, true);
});

test("getTelegramConfig should throw when required env vars are missing", () => {
  assert.throws(
    () => getTelegramConfig({ TELEGRAM_CHAT_ID: "456" }),
    /TELEGRAM_BOT_TOKEN/
  );
  assert.throws(
    () => getTelegramConfig({ TELEGRAM_BOT_TOKEN: "123:abc" }),
    /TELEGRAM_CHAT_ID/
  );
});

test("sendTelegramMessage should call fetch with the built payload", async () => {
  const calls = [];
  const fakeFetch = async (url, options) => {
    calls.push({ url, options });
    return {
      ok: true,
      async json() {
        return { ok: true };
      },
    };
  };

  await sendTelegramMessage(
    {
      botToken: "123:abc",
      chatId: "456",
    },
    "AnyRouter 签到汇总",
    fakeFetch
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.telegram.org/bot123:abc/sendMessage");
  assert.equal(JSON.parse(calls[0].options.body).chat_id, "456");
});
