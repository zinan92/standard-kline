"use strict";

function adaptTigerOpenapiComexBars(rows, options = {}){
  const symbol = options.symbol || "MGCmain";
  const timeframe = options.timeframe || "1m";
  return {
    schema_version:"tiger-openapi-comex-bars-v1",
    status:"ready",
    source_mode:"tiger_openapi",
    symbol,
    timeframe,
    provider:"tiger_openapi:COMEX",
    quality_flags:["broker_feed", "comex_futures"],
    is_synthetic:false,
    bars:(rows || []).map(row => ({
      symbol:row.symbol || symbol,
      timeframe:row.timeframe || timeframe,
      timestamp:row.timestamp || row.time || row.datetime,
      open:Number(row.open),
      high:Number(row.high),
      low:Number(row.low),
      close:Number(row.close),
      volume:Number(row.volume || 0),
      provider:"tiger_openapi:COMEX",
      quality_flags:Array.isArray(row.quality_flags) ? row.quality_flags.slice() : ["broker_feed", "comex_futures"],
    })),
  };
}

module.exports = {adaptTigerOpenapiComexBars};
