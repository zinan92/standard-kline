const test = require("node:test");
const assert = require("node:assert/strict");
const kline = require("./standard-kline.js");

test("createStandardKlineOptions applies responsive defaults and hollow-up green-up theme", () => {
  const options = kline.createStandardKlineOptions();
  assert.equal(options.preset, "responsive");
  assert.equal(options.showVolume, true);
  assert.equal(options.showToolbar, true);
  assert.equal(options.candleTheme.candleDirection, "green-up-red-down");
  assert.equal(options.candleTheme.upColor, "transparent");
  assert.equal(options.candleTheme.downColor.includes("255,107,107"), true);
});

test("createStandardKlineOptions supports red-up-green-down candle direction", () => {
  const options = kline.createStandardKlineOptions({
    preset: "small",
    candleDirection: "red-up-green-down",
  });
  assert.equal(options.preset, "small");
  assert.equal(options.compact, true);
  assert.equal(options.candleTheme.upColor, "transparent");
  assert.equal(options.candleTheme.borderUpColor, "#ef5f7c");
  assert.equal(options.candleTheme.borderDownColor, "#23c19f");
});

test("defaultAgentDeploymentOptions is the no-question default chart contract", () => {
  const options = kline.defaultAgentDeploymentOptions();
  assert.equal(options.preset, "responsive");
  assert.deepEqual(options.indicators, {});
  assert.equal(options.candleTheme.hollowUp, true);
  assert.equal(options.candleTheme.filledDown, true);
});

test("calculateRsiData returns bounded RSI points after the warmup period", () => {
  const candles = Array.from({ length: 20 }, (_, index) => ({
    time: index + 1,
    close: index + 1,
  }));
  const rsi = kline.calculateRsiData(candles, 14);
  assert.equal(rsi.length, 6);
  assert.equal(rsi[0].time, 15);
  assert.equal(rsi.at(-1).value, 100);
});

test("calculateRiskReward computes R without trade semantics", () => {
  const rr = kline.calculateRiskReward({ side: "long", entry: 100, stop: 95, target: 115 });
  assert.equal(rr.risk, 5);
  assert.equal(rr.reward, 15);
  assert.equal(rr.ratio, 3);
});

test("adaptBarPayload converts timestamps to epoch seconds and preserves provider metadata", () => {
  const payload = {
    schema_version: "ohlcv-v1",
    status: "ready",
    source_mode: "rest_poll",
    symbol: "BTCUSD",
    timeframe: "1m",
    provider: "example_exchange",
    quality_flags: [],
    is_synthetic: false,
    bars: [
      { timestamp: "2026-01-01T00:00:00Z", open: 100, high: 102, low: 99, close: 101, volume: 5 },
      { timestamp: "2026-01-01T00:01:00Z", open: 101, high: 104, low: 100, close: 103, volume: 8 },
    ],
  };
  const result = kline.adaptBarPayload(payload);
  assert.equal(result.candles.length, 2);
  assert.equal(result.candles[0].time, Math.floor(Date.parse("2026-01-01T00:00:00Z") / 1000));
  assert.equal(result.meta.provider, "example_exchange");
  assert.equal(result.meta.is_synthetic, false);
  assert.deepEqual(result.volumes.map(v => v.value), [5, 8]);
});

test("adaptBarPayload drops rows missing required OHLC fields instead of throwing", () => {
  const payload = {
    bars: [
      { timestamp: "2026-01-01T00:00:00Z", open: 100, high: 102, low: 99, close: 101 },
      { timestamp: "2026-01-01T00:01:00Z", open: 101, high: 104 }, // missing low/close
      { open: 1, high: 2, low: 0, close: 1 }, // missing timestamp
    ],
  };
  const result = kline.adaptBarPayload(payload);
  assert.equal(result.candles.length, 1);
  assert.equal(result.meta.rejected_rows, 2);
});

test("adaptBarPayload flags synthetic data via an explicit is_synthetic flag", () => {
  const result = kline.adaptBarPayload({
    is_synthetic: true,
    bars: [{ timestamp: "2026-01-01T00:00:00Z", open: 1, high: 1, low: 1, close: 1 }],
  });
  assert.equal(result.meta.is_synthetic, true);
});

test("adaptDatafeedResponse maps CandleResponse candles and trust metadata", () => {
  const result = kline.adaptDatafeedResponse({
    schema_version: "kline-candles-v1",
    ticker: "BTC",
    asset_class: "crypto",
    timeframe: "1m",
    provider: "binance_spot",
    source_mode: "binance_spot_public",
    quality_flags: ["public_api", "research_only"],
    is_synthetic: false,
    served_from: "upstream",
    fresh: true,
    latest_timestamp: "2026-03-28T11:59:00Z",
    age_seconds: 10,
    max_age_seconds: 90,
    candles: [
      { timestamp: "2026-03-28T11:58:00Z", open: 10, high: 11, low: 9, close: 10.5, volume: 3, provider: "binance_spot", quality_flags: ["public_api"] },
      { timestamp: "2026-03-28T11:59:00Z", open: 10.5, high: 12, low: 10, close: 11.5, volume: 4, provider: "binance_spot", quality_flags: ["public_api"] },
    ],
  });

  assert.equal(result.candles.length, 2);
  assert.equal(result.meta.symbol, "BTC");
  assert.equal(result.meta.served_from, "upstream");
  assert.equal(result.meta.fresh, true);
  assert.equal(result.meta.age_seconds, 10);
  assert.ok(result.meta.quality_flags.includes("research_only"));
});

test("adaptDatafeedResponse preserves rate semantics and exposes line mode without relabeling values as candles", () => {
  const result = kline.adaptDatafeedResponse({
    schema_version: "kline-candles-v1",
    ticker: "DGS2",
    asset_class: "macro",
    series_kind: "rate_level",
    unit: "percent",
    price_basis: "yield_level",
    semantic_role: "treasury_yield_not_bond_price",
    timeframe: "1w",
    provider: "fred_public_csv_macro",
    source_mode: "fred_public_csv_macro",
    fresh: true,
    candles: [
      {timestamp: "2026-03-20T00:00:00Z", open: 4.1, high: 4.1, low: 4.1, close: 4.1, value: 4.1},
      {timestamp: "2026-03-27T00:00:00Z", open: 4.2, high: 4.2, low: 4.2, close: 4.2, value: 4.2},
    ],
  });

  assert.equal(result.meta.series_kind, "rate_level");
  assert.equal(result.meta.render_mode, "line");
  assert.equal(result.meta.semantic_role, "treasury_yield_not_bond_price");
  assert.deepEqual(result.line.map(point => point.value), [4.1, 4.2]);
  assert.equal(result.candles[0].close, 4.1);
});

test("spread payloads also select line mode and keep basis-point values", () => {
  const result = kline.adaptDatafeedResponse({
    ticker: "T10Y2Y",
    asset_class: "macro",
    series_kind: "spread",
    unit: "basis points",
    timeframe: "1w",
    candles: [{timestamp: "2026-03-27T00:00:00Z", open: 35, high: 35, low: 35, close: 35, value: 35}],
  });
  assert.equal(result.meta.render_mode, "line");
  assert.equal(result.meta.unit, "basis points");
  assert.deepEqual(result.line, [{time: Math.floor(Date.parse("2026-03-27T00:00:00Z") / 1000), value: 35}]);
});

test("adaptDatafeedResponse accepts the Weekly CandleResponse bars field", () => {
  const result = kline.adaptDatafeedResponse({
    ticker: "GOLD",
    asset_class: "commodity",
    series_kind: "price",
    timeframe: "weekly",
    provider: "weekly_datafeed",
    source_mode: "datafeed:yahoo_finance_futures",
    bars: [{timestamp: "2026-03-27T00:00:00Z", open: 3100, high: 3120, low: 3080, close: 3110}],
  });
  assert.equal(result.candles.length, 1);
  assert.equal(result.candles[0].close, 3110);
});

test("evaluateTrustPolicy rejects stale, synthetic, cached, forbidden flags, and source-mode mismatch", () => {
  const trust = kline.evaluateTrustPolicy({
    source_mode: "research_feed",
    served_from: "cache",
    fresh: false,
    is_synthetic: true,
    quality_flags: ["research_only", "not_execution_venue"],
  }, {
    requireFresh: true,
    allowSynthetic: false,
    allowCache: false,
    forbiddenQualityFlags: ["research_only", "not_execution_venue"],
    allowedSourceModes: ["execution_feed"],
  });

  assert.equal(trust.trusted, false);
  assert.deepEqual(trust.reasons.map(reason => reason.code), [
    "fresh_required",
    "synthetic_forbidden",
    "cache_forbidden",
    "quality_flag_forbidden",
    "quality_flag_forbidden",
    "source_mode_not_allowed",
  ]);
});

test("adaptBarPayload links TrustPolicy to synthetic/cache blocking", () => {
  const result = kline.adaptBarPayload({
    source_mode: "rest_poll",
    served_from: "cache",
    fresh: true,
    is_synthetic: true,
    bars: [{ timestamp: "2026-01-01T00:00:00Z", open: 1, high: 2, low: 1, close: 2 }],
  }, {
    trustPolicy: { allowSynthetic: false, allowCache: false, allowedSourceModes: ["rest_poll"] },
  });

  assert.equal(result.trustState.blocked, true);
  assert.deepEqual(result.trustState.reasons.map(reason => reason.code), ["synthetic_forbidden", "cache_forbidden"]);
});

test("mergeBarIntoAdaptedData replaces the last bar and appends new bars without rebuilding adapted data", () => {
  const adapted = kline.adaptBarPayload({
    source_mode: "upstream",
    bars: [
      { timestamp: 1000, open: 1, high: 2, low: 1, close: 1.5, volume: 5 },
      { timestamp: 1060, open: 1.5, high: 2.5, low: 1.4, close: 2, volume: 6 },
    ],
  });

  const replaced = kline.mergeBarIntoAdaptedData(adapted, { timestamp: 1060, open: 1.5, high: 3, low: 1.4, close: 2.8, volume: 9 });
  assert.equal(replaced.action, "replace-last");
  assert.equal(replaced.adapted.candles.at(-1).close, 2.8);
  assert.equal(replaced.adapted.volumes.at(-1).value, 9);

  const appended = kline.mergeBarIntoAdaptedData(replaced.adapted, { timestamp: 1120, open: 2.8, high: 3.1, low: 2.6, close: 3, volume: 11 });
  assert.equal(appended.action, "append");
  assert.equal(appended.adapted.candles.length, 3);
  assert.equal(appended.adapted.meta.bar_count, 3);
});

test("StandardKlineChart.updateBar uses series.update for the latest bar", () => {
  const calls = [];
  const fake = {
    current: kline.adaptBarPayload({
      bars: [
        { timestamp: 1000, open: 1, high: 2, low: 1, close: 1.5, volume: 5 },
        { timestamp: 1060, open: 1.5, high: 2.5, low: 1.4, close: 2, volume: 6 },
      ],
    }),
    options: {},
    trustPolicy: null,
    lastOverlays: {},
    candleSeries: {
      update(point){ calls.push(["candle.update", point]); },
      setData(points){ calls.push(["candle.setData", points]); },
    },
    volumeSeries: {
      update(point){ calls.push(["volume.update", point]); },
      setData(points){ calls.push(["volume.setData", points]); },
    },
    _applyIndicators(){},
    _setRiskReward(){},
    _updateOhlcHeader(){},
    _setSourceText(){},
    _refreshOverlay(){},
  };

  const result = kline.StandardKlineChart.prototype.updateBar.call(fake, {
    timestamp: 1060,
    open: 1.5,
    high: 3,
    low: 1.4,
    close: 2.8,
    volume: 9,
  });

  assert.equal(result.candles.at(-1).close, 2.8);
  assert.equal(calls[0][0], "candle.update");
  assert.equal(calls[1][0], "volume.update");
});

test("adaptBarPayload flags synthetic data via a provider/source_mode substring match", () => {
  const result = kline.adaptBarPayload({
    provider: "synthetic_seed:demo",
    bars: [{ timestamp: "2026-01-01T00:00:00Z", open: 1, high: 1, low: 1, close: 1 }],
  });
  assert.equal(result.meta.is_synthetic, true);
});

test("adaptBarPayload only treats custom quality_flags as synthetic when the caller opts in", () => {
  const payload = {
    quality_flags: ["demo_only"],
    bars: [{ timestamp: "2026-01-01T00:00:00Z", open: 1, high: 1, low: 1, close: 1 }],
  };
  const withoutOptIn = kline.adaptBarPayload(payload);
  assert.equal(withoutOptIn.meta.is_synthetic, false);

  const withOptIn = kline.adaptBarPayload(payload, { syntheticFlags: ["demo_only"] });
  assert.equal(withOptIn.meta.is_synthetic, true);
});

test("isSyntheticMeta is exposed standalone and honors the same rules as adaptBarPayload", () => {
  assert.equal(kline.isSyntheticMeta(null), true);
  assert.equal(kline.isSyntheticMeta({ provider: "real_feed" }), false);
  assert.equal(kline.isSyntheticMeta({ quality_flags: ["demo"] }, ["demo"]), true);
  assert.equal(kline.isSyntheticMeta({ quality_flags: ["demo"] }), false);
});

test("clampLogicalRange keeps a wildly out-of-bounds range within a buffered window", () => {
  const clamped = kline.clampLogicalRange({ from: -500, to: 900 }, 96, { rightOffset: 8 });
  assert.deepEqual(clamped, { from: -12, to: 107 });
});

test("clampLogicalRange preserves requested width when it already fits", () => {
  const clamped = kline.clampLogicalRange({ from: 10, to: 40 }, 96, { rightOffset: 8 });
  assert.equal(clamped.to - clamped.from, 30);
});

test("clampLogicalRange enforces a minimum visible width", () => {
  const tiny = kline.clampLogicalRange({ from: 50, to: 50.1 }, 96, { bufferBars: 12, minVisibleBars: 6 });
  assert.ok(tiny.to - tiny.from >= 6 - 1e-9);
});

test("clampLogicalRange returns null for invalid inputs", () => {
  assert.equal(kline.clampLogicalRange(null, 96, {}), null);
  assert.equal(kline.clampLogicalRange({ from: 0, to: 10 }, 0, {}), null);
  assert.equal(kline.clampLogicalRange({ from: NaN, to: 10 }, 96, {}), null);
});

test("nearestTime snaps a timestamp to the closest candle time", () => {
  const candles = [{ time: 100 }, { time: 160 }, { time: 220 }];
  assert.equal(kline.nearestTime(candles, 150), 160);
  assert.equal(kline.nearestTime(candles, 95), 100);
  assert.equal(kline.nearestTime([], 100), null);
});

test("toEpochSeconds accepts ISO strings, epoch seconds, and epoch milliseconds", () => {
  assert.equal(kline.toEpochSeconds("2026-01-01T00:00:00Z"), Math.floor(Date.parse("2026-01-01T00:00:00Z") / 1000));
  assert.equal(kline.toEpochSeconds(1735689600), 1735689600);
  assert.equal(kline.toEpochSeconds(1735689600000), 1735689600);
  assert.equal(kline.toEpochSeconds(null), null);
});

test("normalizeQualityFlags accepts arrays and delimited strings", () => {
  assert.deepEqual(kline.normalizeQualityFlags(["a", " b ", ""]), ["a", "b"]);
  assert.deepEqual(kline.normalizeQualityFlags("a, b|c"), ["a", "b", "c"]);
  assert.deepEqual(kline.normalizeQualityFlags(null), []);
});
