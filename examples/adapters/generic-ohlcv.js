"use strict";

function adaptGenericOhlcvRows(rows, meta = {}){
  return {
    schema_version:meta.schema_version || "generic-ohlcv-v1",
    status:meta.status || "ready",
    source_mode:meta.source_mode || "generic_ohlcv",
    symbol:meta.symbol || rows?.[0]?.symbol || "",
    timeframe:meta.timeframe || rows?.[0]?.timeframe || "",
    provider:meta.provider || rows?.[0]?.provider || "generic",
    quality_flags:Array.isArray(meta.quality_flags) ? meta.quality_flags.slice() : [],
    is_synthetic:meta.is_synthetic === true,
    bars:(rows || []).map(row => ({
      symbol:row.symbol ?? meta.symbol ?? "",
      timeframe:row.timeframe ?? meta.timeframe ?? "",
      timestamp:row.timestamp ?? row.time,
      open:row.open,
      high:row.high,
      low:row.low,
      close:row.close,
      volume:row.volume ?? 0,
      provider:row.provider ?? meta.provider ?? "generic",
      quality_flags:Array.isArray(row.quality_flags) ? row.quality_flags.slice() : [],
    })),
  };
}

module.exports = {adaptGenericOhlcvRows};
