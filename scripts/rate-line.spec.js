"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const {test, expect} = require("@playwright/test");

const repoRoot = path.resolve(__dirname, "..");

function contentType(filePath){
  if(filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if(filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if(filePath.endsWith(".css")) return "text/css; charset=utf-8";
  return "application/octet-stream";
}

function startServer(){
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, "http://127.0.0.1");
    const requestedPath = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, "");
    const filePath = path.join(repoRoot, requestedPath === "/" ? "examples/rate-line-demo.html" : requestedPath);
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
      response.writeHead(200, {"content-type":contentType(filePath)});
      response.end(body);
    });
  });
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve({server, baseUrl:`http://127.0.0.1:${server.address().port}`}));
  });
}

test("price candles and rate lines render at desktop and mobile without overflow", async ({page}) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if(message.type() === "error") errors.push(message.text()); });
  const {server, baseUrl} = await startServer();
  try{
    for(const viewport of [{width:1280, height:900}, {width:390, height:844}]){
      await page.setViewportSize(viewport);
      await page.goto(`${baseUrl}/examples/rate-line-demo.html`, {waitUntil:"networkidle"});
      await expect(page.locator("[data-standard-kline='true']")).toHaveCount(2);
      const state = await page.evaluate(() => ({
        priceMode:window.priceChart.current.meta.render_mode,
        priceCandleSeries:Boolean(window.priceChart.candleSeries),
        priceVolume:Boolean(window.priceChart.volumeSeries),
        rateMode:window.rateChart.current.meta.render_mode,
        rateLineSeries:Boolean(window.rateChart.lineSeries),
        rateCandleSeries:Boolean(window.rateChart.candleSeries),
        rateVolume:Boolean(window.rateChart.volumeSeries),
        ratePoints:window.rateChart.current.line.length,
        priceEma:window.priceChart.indicatorSeries.ema.size,
        rateEma:window.rateChart.indicatorSeries.ema.size,
        bodyWidth:document.body.scrollWidth,
        viewportWidth:window.innerWidth,
      }));
      expect(state.priceMode).toBe("candles");
      expect(state.priceCandleSeries).toBe(true);
      expect(state.priceVolume).toBe(true);
      expect(state.rateMode).toBe("line");
      expect(state.rateLineSeries).toBe(true);
      expect(state.rateCandleSeries).toBe(false);
      expect(state.rateVolume).toBe(false);
      expect(state.ratePoints).toBe(72);
      expect(state.priceEma).toBe(1);
      expect(state.rateEma).toBe(1);
      expect(state.bodyWidth).toBeLessThanOrEqual(state.viewportWidth);
      expect(await page.locator("[data-standard-kline-overlay]").evaluateAll(nodes => nodes.map(node => node.dataset.state))).toEqual(["ready", "ready"]);
    }
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
  expect(errors).toEqual([]);
});

test("missing lightweight-charts peer remains visibly blocked after data load", async ({page}) => {
  const {server, baseUrl} = await startServer();
  try{
    await page.goto(`${baseUrl}/examples/missing-peer-demo.html`, {waitUntil:"networkidle"});
    await expect(page.locator("[data-standard-kline-overlay]")).toHaveAttribute("data-state", "empty");
    await expect(page.locator("[data-standard-kline-overlay]")).toContainText("CHART LIBRARY MISSING");
    expect(await page.evaluate(() => ({chart:Boolean(window.demoChart.chart), libraryAvailable:window.demoChart.libraryAvailable}))).toEqual({chart:false, libraryAvailable:false});
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
