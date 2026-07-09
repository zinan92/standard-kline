"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const {test, expect} = require("@playwright/test");

const repoRoot = path.resolve(__dirname, "..");
const assetDir = path.join(repoRoot, "docs", "assets");
const frameDir = path.join(repoRoot, "docs", ".demo-frames");

function contentType(filePath){
  if(filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if(filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if(filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if(filePath.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function startServer(){
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    const requestedPath = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(repoRoot, requestedPath === "/" ? "examples/browser-demo.html" : requestedPath);
    if(!filePath.startsWith(repoRoot)){
      response.writeHead(403);
      response.end("forbidden");
      return;
    }
    fs.readFile(filePath, (error, body) => {
      if(error){
        response.writeHead(404);
        response.end("not found");
        return;
      }
      response.writeHead(200, {"content-type": contentType(filePath)});
      response.end(body);
    });
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const {port} = server.address();
      resolve({server, baseUrl: `http://127.0.0.1:${port}`});
    });
  });
}

async function screenshot(page, name){
  await page.screenshot({
    path: path.join(frameDir, name),
    fullPage: true,
    animations: "disabled",
  });
}

test("capture README demo screenshots", async ({page}) => {
  fs.mkdirSync(assetDir, {recursive: true});
  fs.rmSync(frameDir, {recursive: true, force: true});
  fs.mkdirSync(frameDir, {recursive: true});

  const consoleErrors = [];
  page.on("pageerror", error => consoleErrors.push(error.message));
  page.on("console", message => {
    if(message.type() === "error") consoleErrors.push(message.text());
  });

  const {server, baseUrl} = await startServer();
  try{
    await page.setViewportSize({width: 1360, height: 820});
    await page.goto(`${baseUrl}/examples/browser-demo.html`, {waitUntil: "networkidle"});
    await expect(page.locator("[data-standard-kline='true']")).toBeVisible();
    await expect(page.locator("[data-source]")).toContainText("example_broker:COMEX");
    await expect(page.locator("[data-standard-kline-overlay]")).toHaveAttribute("data-state", "ready");
    await expect(page.locator("[data-standard-kline-ohlc]")).toContainText("O");
    await expect(page.locator("[data-standard-kline-ohlc]")).toContainText("C");
    await expect(page.locator("[data-standard-kline-risk-reward]")).toHaveAttribute("data-r", /2\.00/);
    await expect(page.locator("body")).not.toContainText("TradingView");
    expect(await page.locator("a[href*='tradingview']").count()).toBe(0);
    await expect(page.locator("#lastClose")).not.toHaveText("--");

    const initialState = await page.evaluate(() => ({
      timeScale: window.demoChart.chart.timeScale().options(),
      hasVolume: Boolean(window.demoChart.volumeSeries) && window.demoChart.current.volumes.length > 0,
      hasMacd: Boolean(window.demoChart.indicatorSeries.macd),
      hasRsi: Boolean(window.demoChart.indicatorSeries.rsi),
      emaCount: window.demoChart.indicatorSeries.ema.size,
      preset: window.demoChart.options.preset,
      candleDirection: window.demoChart.candleTheme.candleDirection,
      hollowUp: window.demoChart.candleTheme.hollowUp,
      riskRewardR: window.demoChart.riskRewardEl.dataset.r,
    }));
    expect(initialState.timeScale.visible).toBe(true);
    expect(initialState.timeScale.timeVisible).toBe(true);
    expect(initialState.timeScale.borderVisible).toBe(true);
    expect(initialState.hasVolume).toBe(true);
    expect(initialState.hasMacd).toBe(true);
    expect(initialState.hasRsi).toBe(true);
    expect(initialState.emaCount).toBe(2);
    expect(initialState.preset).toBe("large");
    expect(initialState.candleDirection).toBe("green-up-red-down");
    expect(initialState.hollowUp).toBe(true);
    expect(initialState.riskRewardR).toBe("2.00");

    const headerLayout = await page.evaluate(() => {
      const longRect = document.querySelector("[data-side='long']").getBoundingClientRect();
      const ohlcRect = document.querySelector("[data-standard-kline-ohlc]").getBoundingClientRect();
      const canvasRect = document.querySelector(".standard-kline-canvas").getBoundingClientRect();
      return {
        longLeft: longRect.left,
        ohlcLeft: ohlcRect.left,
        canvasLeft: canvasRect.left,
      };
    });
    expect(headerLayout.longLeft).toBeGreaterThanOrEqual(headerLayout.canvasLeft);
    expect(headerLayout.longLeft).toBeLessThan(headerLayout.ohlcLeft);

    const indicatorLabels = await page.evaluate(() => {
      const titleOf = series => {
        const options = series?.options?.();
        return options?.title || "";
      };
      return {
        macdHistogramTitle: titleOf(window.demoChart.indicatorSeries.macd?.histogram),
        macdTitle: titleOf(window.demoChart.indicatorSeries.macd?.macd),
        signalTitle: titleOf(window.demoChart.indicatorSeries.macd?.signal),
        rsiTitle: titleOf(window.demoChart.indicatorSeries.rsi?.line),
      };
    });
    expect(indicatorLabels).toEqual({
      macdHistogramTitle: "",
      macdTitle: "",
      signalTitle: "",
      rsiTitle: "",
    });

    await page.click("[data-side='long']");
    await expect.poll(async () => page.evaluate(() => window.__lastTradeAction?.side || "")).toBe("long");
    await expect(page.locator("#tradeAction")).toContainText("long");
    await page.click("[data-scale-action='auto']");
    await expect(page.locator("[data-scale-action='auto']")).toHaveClass(/is-active/);
    await page.click("[data-scale-action='log']");
    await expect(page.locator("[data-scale-action='log']")).toHaveClass(/is-active/);
    expect(await page.evaluate(() => ({autoFit: window.demoChart.autoFit, logScale: window.demoChart.logScale}))).toEqual({autoFit: true, logScale: true});

    await page.screenshot({
      path: path.join(assetDir, "standard-kline-demo.png"),
      fullPage: true,
      animations: "disabled",
    });

    await screenshot(page, "01-real.png");
    await page.click("[data-demo='realtime']");
    await page.waitForTimeout(180);
    const realtimeState = await page.evaluate(() => ({
      before: window.__lastCloseBefore,
      after: window.__lastCloseAfter,
      chartClose: window.demoChart.current.candles.at(-1).close,
    }));
    expect(realtimeState.after).not.toBe(realtimeState.before);
    expect(realtimeState.chartClose).toBe(realtimeState.after);
    await screenshot(page, "02-realtime.png");

    const dragPoint = await page.evaluate(() => {
      const line = window.demoChart.priceLineItems.find(item => item.id === "upper-alert");
      const rect = document.querySelector(".standard-kline-canvas").getBoundingClientRect();
      const y = window.demoChart.candleSeries.priceToCoordinate(line.price);
      return {x: rect.left + rect.width * 0.55, y: rect.top + y};
    });
    await page.mouse.move(dragPoint.x, dragPoint.y);
    await page.mouse.down();
    await page.mouse.move(dragPoint.x, dragPoint.y - 28, {steps: 5});
    await page.mouse.up();
    await expect.poll(async () => page.evaluate(() => window.__lastPriceLineChange?.id || "")).toBe("upper-alert");
    await expect(page.locator("#dragPrice")).not.toHaveText("--");
    await screenshot(page, "03-drag-line.png");

    await page.click("[data-demo='zoom']");
    await page.waitForTimeout(220);
    await screenshot(page, "04-zoom.png");
    await page.click("[data-demo='blocked']");
    await expect(page.locator("[data-standard-kline-overlay]")).toHaveAttribute("data-state", "blocked");
    await expect(page.locator("[data-standard-kline-overlay]")).toContainText("TRUST POLICY BLOCKED");
    await expect(page.locator("[data-standard-kline-overlay]")).toContainText("research_only");
    await page.waitForTimeout(220);
    await screenshot(page, "05-blocked.png");
    await page.click("[data-demo='empty']");
    await expect(page.locator("[data-standard-kline-overlay]")).toHaveAttribute("data-state", "empty");
    await expect(page.locator("[data-standard-kline-overlay]")).toContainText("market data entitlement denied");
    await page.waitForTimeout(220);
    await screenshot(page, "06-empty.png");
    await page.click("[data-demo='real']");
    await page.click("[data-demo='fit']");
    await page.waitForTimeout(220);
    await screenshot(page, "07-fit.png");

    expect(consoleErrors).toEqual([]);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
