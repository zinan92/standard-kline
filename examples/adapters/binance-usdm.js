"use strict";

function adaptBinanceUsdmKlines(klines, options = {}){
  const symbol = options.symbol || "XAUUSDT";
  const timeframe = options.timeframe || "1m";
  return {
    schema_version:"binance-usdm-klines-v1",
    status:"ready",
    source_mode:"binance_usdm",
    symbol,
    timeframe,
    provider:"binance_usdm",
    quality_flags:["exchange_futures"],
    is_synthetic:false,
    bars:(klines || []).map(row => ({
      symbol,
      timeframe,
      timestamp:new Date(Number(row[0])).toISOString(),
      open:Number(row[1]),
      high:Number(row[2]),
      low:Number(row[3]),
      close:Number(row[4]),
      volume:Number(row[5] || 0),
      provider:"binance_usdm",
      quality_flags:["exchange_futures"],
    })),
  };
}

module.exports = {adaptBinanceUsdmKlines};
