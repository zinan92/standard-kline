"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const kline = require("../../standard-kline.js");
const {adaptGenericOhlcvRows} = require("./generic-ohlcv.js");

test("generic adapter emits chart-ready OHLCV payload", () => {
  const payload = adaptGenericOhlcvRows([
    {timestamp:"2026-07-05T01:00:00Z", open:4100, high:4102, low:4099, close:4101, volume:12},
  ], {symbol:"GOLD", timeframe:"1m", provider:"example"});
  const adapted = kline.adaptBarPayload(payload);
  assert.equal(adapted.meta.provider, "example");
  assert.equal(adapted.candles[0].close, 4101);
});

test("generic adapter preserves provider identity and per-row quality flags", () => {
  const payload = adaptGenericOhlcvRows([
    {timestamp:"2026-07-05T01:00:00Z", open:4100, high:4102, low:4099, close:4101, volume:12, quality_flags:["exchange_futures"]},
  ], {symbol:"XAUUSDT", timeframe:"1m", provider:"my_venue", source_mode:"my_venue_rest"});
  const adapted = kline.adaptBarPayload(payload);
  assert.equal(adapted.meta.provider, "my_venue");
  assert.equal(adapted.meta.source_mode, "my_venue_rest");
  assert.equal(adapted.meta.is_synthetic, false);
  assert.ok(adapted.meta.quality_flags.includes("exchange_futures"));
});
