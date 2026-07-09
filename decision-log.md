# standard-kline decision log

## 2026-07-09 trusted realtime chart refactor

### Objective

把 `standard-kline` 从通用 OHLCV 展示器提升为可直接接入交易页面的可信 K 线前端组件：provider-agnostic、不内置交易所请求，但统一处理 realtime bar、trust policy、时间坐标、指标和可拖价格线。

### Decisions

- Keep provider requests out of this package. The package accepts standard OHLCV payloads and exposes `adaptDatafeedResponse()` only as a pure envelope mapper for `zinan92/datafeed` / `kline` style `CandleResponse`.
- Add `TrustPolicy` after adaptation and before ready rendering. Policy violations expose `trustState` and show a blocking overlay with reject reasons instead of silently drawing a ready/tradable chart.
- Preserve provider/source trust metadata in chart meta: `served_from`, `fresh`, `is_synthetic`, `quality_flags`, `age_seconds`, `max_age_seconds`, `access_issues`, and `reject_reason`.
- Add realtime APIs around Lightweight Charts `series.update()`: `updateBar()`, `appendBars()`, and `replaceBars()`. Historical inserts still fall back to `setData()` to preserve sorted data.
- Keep indicators strategy-free. EMA and MACD render lines/histograms only; no buy/sell interpretation lives in the chart package.
- Keep price-line semantics generic. Draggable lines emit `onPriceLineChange({ id, price })`; TP/SL/entry/alert meaning stays in the calling app.
- Disable Lightweight Charts `layout.attributionLogo` in the component to prevent in-chart attribution text/logo leakage. The caller still owns license/NOTICE/link compliance.

### Gotchas

- The time axis was being clipped because the chart canvas grid child had `height:100%` while the root also had a toolbar row. `_size()` also counted toolbar height. Fixing both made native time labels visible again.
- GIF generation assumed exactly five frames. The updated Playwright flow captures seven states, so `make-demo-gif.py` now generates duration values for any frame count.
- Blocking overlay must intercept chart interactions. A visible warning with `pointer-events:none` is not enough for trading-page trust semantics.
- `fresh: null` or missing is not acceptable when `requireFresh:true`; policy treats it as rejected, not unknown-but-ok.
- `served_from:"cache"` is allowed by default for library neutrality, but `allowCache:false` makes it fail closed.

### Validation

- `npm test`: 20 passing tests.
- `npm run capture-demo`: Playwright passed and regenerated `docs/assets/standard-kline-demo.png` plus `docs/assets/standard-kline-demo.gif`.
- Browser assertions cover visible time axis options, volume data, realtime last-bar update, trust violation blocking overlay, empty access issue overlay, draggable price-line callback, EMA/MACD presence, and no TradingView attribution text/link leak in the demo DOM.

## 2026-07-09 hollow-up candle correction

### Decision

- Match the old A-share chart's candlestick visual grammar for bullish candles: `upColor` is transparent, while bullish border/wick keep the up color. This makes rising candles hollow instead of filled.

### Gotchas

- In Lightweight Charts candlestick series, hollow bullish candles are controlled by `upColor:"transparent"`; changing only `borderUpColor` is not enough.

## 2026-07-09 standard deployment protocol

### Decisions

- Add preset configurations as the first-class deployment surface: `large`, `medium`, `small`, `inset`, and `responsive`.
- Make `responsive` the default Agent deployment preset when the user accepts defaults.
- Standardize candlestick visual grammar: time axis visible, drag/zoom/fit consistent, green-up red-down by default, rising candles hollow, falling candles filled.
- Keep red-up green-down as a caller option through `candleDirection:"red-up-green-down"`.
- Add RSI as an optional lower-pane indicator alongside existing EMA and MACD support.
- Keep indicators opt-in. The default standard chart does not force EMA/MACD/RSI onto every surface.
- Document the Agent deployment question: ask whether the user wants large, small, inset, or responsive before deploying; if all default, use `defaultAgentDeploymentOptions()`.

### Gotchas

- Preset should control chart deployment ergonomics, not business meaning. It must not imply order/fill/trade-plan semantics.
- `inset` needs to hide toolbar and default volume off so it can live inside another chart or context panel without becoming noisy.
- RSI needs its own scale/pane because it is bounded 0-100; overlaying it on price or MACD scale would mislead the viewer.
- Candle direction and candle fill are separate concerns: red-up/green-down changes colors, while hollow-up/filled-down controls body fill.

## 2026-07-09 trading-assist chart controls

### Decisions

- Add Long / Short buttons as an optional chart action layer, not as execution controls. They emit `onTradeAction({ side, price, bar, meta, trustState })`.
- Add generic `riskReward` overlay that renders reward/risk zones and calculates R from `entry`, `stop`, and `target`.
- Keep R display strategy-neutral: `R = abs(target - entry) / abs(entry - stop)`.
- Add a TradingView-like OHLC header that shows O/H/L/C plus latest or hovered candle movement.
- Add right-bottom `A` and `L` controls. `A` toggles auto fit; `L` toggles logarithmic price scale.

### Gotchas

- Long / Short buttons would be unwanted complication if they placed orders or knew broker semantics. As a generic callback layer, they are acceptable inside `standard-kline`.
- Risk/reward must be caller-supplied. The chart package should not infer entry/stop/target from strategy state.
- Log scale belongs to the price scale, not time scale. The UI state needs to stay in sync with `PriceScaleMode.Logarithmic`.
- OHLC header should follow crosshair hover when available, then fall back to latest bar.

## 2026-07-09 top-left actions and indicator declutter

### Decisions

- Place optional Long / Short controls at the chart's top-left, matching the user's trading-dashboard expectation.
- Offset the OHLC header when trade controls are visible so the TradingView-style OHLC readout remains readable.
- Suppress MACD/RSI series titles and RSI high/low axis labels. Lower-pane indicators should render signal shapes without turning the chart into a wall of labels.

### Gotchas

- Moving the buttons in CSS is not enough. The chart canvas needs a `has-trade-controls` state so the OHLC header can reserve left-side space only when those buttons exist.
- Lightweight Charts indicator titles appear as chart labels even when they feel like internal metadata. For compact trading pages, empty titles are cleaner than descriptive series names.
