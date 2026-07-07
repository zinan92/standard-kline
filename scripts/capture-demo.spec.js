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

    await page.screenshot({
      path: path.join(assetDir, "standard-kline-demo.png"),
      fullPage: true,
      animations: "disabled",
    });

    await screenshot(page, "01-real.png");
    await page.click("[data-demo='zoom']");
    await page.waitForTimeout(220);
    await screenshot(page, "02-zoom.png");
    await page.click("[data-demo='pan']");
    await page.waitForTimeout(220);
    await screenshot(page, "03-pan.png");
    await page.click("[data-demo='synthetic']");
    await expect(page.locator("[data-standard-kline-overlay]")).toHaveAttribute("data-state", "synthetic");
    await expect(page.locator("[data-standard-kline-overlay]")).toContainText("NOT REAL PRICE");
    await page.waitForTimeout(220);
    await screenshot(page, "04-synthetic.png");
    await page.click("[data-demo='fit']");
    await page.waitForTimeout(220);
    await screenshot(page, "05-fit.png");

    expect(consoleErrors).toEqual([]);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
});
