"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const kline = require("../../standard-kline.js");
const {adaptGenericOhlcvRows} = require("./generic-ohlcv.js");
const {adaptBinanceUsdmKlines} = require("./binance-usdm.js");
const {adaptTigerOpenapiComexBars} = require("./tiger-openapi-comex.js");

test("generic adapter emits chart-ready OHLCV payload", () => {
  const payload = adaptGenericOhlcvRows([
    {timestamp:"2026-07-05T01:00:00Z", open:4100, high:4102, low:4099, close:4101, volume:12},
  ], {symbol:"GOLD", timeframe:"1m", provider:"example"});
  const adapted = kline.adaptBarPayload(payload);
  assert.equal(adapted.meta.provider, "example");
  assert.equal(adapted.candles[0].close, 4101);
});

test("binance usdm adapter converts REST kline arrays", () => {
  const payload = adaptBinanceUsdmKlines([
    [1783213200000, "4100", "4102", "4099", "4101", "12"],
  ], {symbol:"XAUUSDT", timeframe:"1m"});
  const adapted = kline.adaptBarPayload(payload);
  assert.equal(adapted.meta.provider, "binance_usdm");
  assert.equal(adapted.candles[0].time, 1783213200);
  assert.equal(adapted.volumes[0].value, 12);
});

test("tiger openapi comex adapter preserves COMEX provider identity", () => {
  const payload = adaptTigerOpenapiComexBars([
    {timestamp:"2026-07-05T01:00:00Z", open:4100, high:4102, low:4099, close:4101, volume:3},
  ]);
  const adapted = kline.adaptBarPayload(payload);
  assert.equal(adapted.meta.symbol, "MGCmain");
  assert.equal(adapted.meta.provider, "tiger_openapi:COMEX");
  assert.equal(adapted.meta.is_synthetic, false);
});
