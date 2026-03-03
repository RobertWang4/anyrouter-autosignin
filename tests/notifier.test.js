const test = require("node:test");
const assert = require("node:assert/strict");

const {
  buildNotificationPlans,
  notifyWithFallback,
  toFileUrl,
} = require("../notifier");

test("toFileUrl should convert absolute path to file URL", () => {
  assert.equal(
    toFileUrl("/Users/robert/Projects/anyrouter/launchd.log"),
    "file:///Users/robert/Projects/anyrouter/launchd.log"
  );
});

test("buildNotificationPlans should prefer terminal-notifier with open action and include osascript fallback", () => {
  const plans = buildNotificationPlans(
    "AnyRouter 签到",
    "wmc 签到成功 | 余额: $350.00",
    "/Users/robert/Projects/anyrouter/launchd.log"
  );

  assert.equal(plans.length, 2);
  assert.equal(plans[0].bin, "terminal-notifier");
  assert.ok(plans[0].args.includes("-open"));
  assert.ok(
    plans[0].args.includes("file:///Users/robert/Projects/anyrouter/launchd.log")
  );
  assert.ok(!plans[0].args.includes("-group"));
  assert.equal(plans[1].bin, "osascript");
  assert.equal(plans[1].args[0], "-e");
});

test("notifyWithFallback should use fallback when terminal-notifier is unavailable", () => {
  const calls = [];
  const fakeRun = (bin, args) => {
    calls.push({ bin, args });
    if (bin === "terminal-notifier") {
      throw new Error("not installed");
    }
  };

  const ok = notifyWithFallback(
    "AnyRouter 签到",
    "wmc 签到成功 | 余额: $350.00",
    "/Users/robert/Projects/anyrouter/launchd.log",
    fakeRun
  );

  assert.equal(ok, true);
  assert.equal(calls.length, 2);
  assert.equal(calls[0].bin, "terminal-notifier");
  assert.equal(calls[1].bin, "osascript");
});
