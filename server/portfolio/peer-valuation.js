import { getSecUserAgent, portfolioConfig } from "./config.js"
import { cacheWrap } from "./cache.js"
import { fetchSecSnapshot } from "./sec-data.js"
import { fetchMarketSnapshot } from "./market-data.js"

const PEER_MAP = {
  AAPL: ["MSFT", "GOOGL", "AMZN"],
  MSFT: ["AAPL", "GOOGL", "AMZN"],
  GOOGL: ["META", "MSFT", "AMZN"],
  AMZN: ["MSFT", "GOOGL", "WMT"],
  NVDA: ["AMD", "INTC", "AVGO"],
  TSLA: ["GM", "F", "RIVN"]
}

function safeNumber(value) {
  if (value === null || value === undefined) return null
  if (typeof value === "string" && value.trim() === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

async function parseJsonResponseSafe(response) {
  try {
    const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase()
    if (!contentType.includes("application/json")) {
      return null
    }
    return await response.json()
  } catch {
    return null
  }
}

async function fetchQuotes(symbols) {
  if (symbols.length === 0) return []
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbols.join(","))}`
  const response = await fetch(url, {
    headers: { "User-Agent": getSecUserAgent() }
  })
  if (!response.ok) return []
  const payload = await parseJsonResponseSafe(response)
  if (!payload) return []
  return Array.isArray(payload?.quoteResponse?.result) ? payload.quoteResponse.result : []
}

function median(values) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) return (sorted[middle - 1] + sorted[middle]) / 2
  return sorted[middle]
}

function selectAnnualOrTtmValue(series = []) {
  if (!Array.isArray(series) || series.length === 0) return null

  for (const item of series) {
    const isAnnual = String(item?.fp || "").toUpperCase() === "FY" || String(item?.form || "").toUpperCase() === "10-K"
    if (!isAnnual) continue
    const annualValue = safeNumber(item?.value)
    if (annualValue !== null) return annualValue
  }

  const distinctPeriods = new Set()
  const quarterValues = []
  for (const item of series) {
    const periodKey = String(item?.end || item?.filed || "")
    const value = safeNumber(item?.value)
    if (!periodKey || value === null || distinctPeriods.has(periodKey)) continue
    quarterValues.push(value)
    distinctPeriods.add(periodKey)
    if (quarterValues.length >= 4) break
  }

  if (quarterValues.length === 0) return null
  return quarterValues.reduce((sum, value) => sum + value, 0)
}

async function derivePeerValuationFromSecAndPrice(ticker) {
  try {
    const secSnapshot = await fetchSecSnapshot({ ticker })
    const marketSnapshot = await fetchMarketSnapshot({ ticker, secSnapshot })

    const marketCap = safeNumber(marketSnapshot?.valuation?.marketCap)
    const netIncome = selectAnnualOrTtmValue(secSnapshot?.companyFacts?.netIncome || [])
    const trailingPE = (marketCap !== null && netIncome !== null && netIncome > 0)
      ? marketCap / netIncome
      : null

    return {
      ticker: String(ticker || "").toUpperCase(),
      companyName: String(ticker || "").toUpperCase(),
      trailingPE,
      marketCap,
      source: "sec_derived"
    }
  } catch {
    return {
      ticker: String(ticker || "").toUpperCase(),
      companyName: String(ticker || "").toUpperCase(),
      trailingPE: null,
      marketCap: null,
      source: "unavailable"
    }
  }
}

export async function fetchPeerValuation({ ticker }) {
  const normalizedTicker = String(ticker).toUpperCase()
  const peers = PEER_MAP[normalizedTicker] || []
  const cacheKey = `peer:v2:${normalizedTicker}:${peers.join(",")}`

  return cacheWrap(cacheKey, portfolioConfig.cacheTtlMs, async () => {
    const symbols = [normalizedTicker, ...peers]
    const rows = await fetchQuotes(symbols)

    const rowBySymbol = new Map(
      rows.map((row) => [String(row.symbol || "").toUpperCase(), row])
    )

    const initialItems = symbols.map((symbol) => {
      const row = rowBySymbol.get(symbol) || null
      return {
        ticker: symbol,
        companyName: row?.shortName || row?.longName || symbol,
        trailingPE: safeNumber(row?.trailingPE),
        marketCap: safeNumber(row?.marketCap),
        source: row ? "yahoo_quote" : "missing"
      }
    })

    const missingSymbols = initialItems
      .filter((item) => item.trailingPE === null || item.marketCap === null)
      .map((item) => item.ticker)

    const derivedMap = new Map()
    if (missingSymbols.length > 0) {
      const derivedItems = await Promise.all(missingSymbols.map((symbol) => derivePeerValuationFromSecAndPrice(symbol)))
      for (const item of derivedItems) {
        derivedMap.set(item.ticker, item)
      }
    }

    const mergedItems = initialItems.map((item) => {
      const derived = derivedMap.get(item.ticker)
      if (!derived) return item
      return {
        ticker: item.ticker,
        companyName: item.companyName || derived.companyName,
        trailingPE: item.trailingPE ?? derived.trailingPE,
        marketCap: item.marketCap ?? derived.marketCap,
        source: item.source === "yahoo_quote" ? item.source : derived.source
      }
    })

    const baseItem = mergedItems.find((item) => item.ticker === normalizedTicker) || {
      ticker: normalizedTicker,
      companyName: normalizedTicker,
      trailingPE: null,
      marketCap: null,
      source: "missing"
    }

    const peerItems = mergedItems.filter((item) => item.ticker !== normalizedTicker)
    const peerPes = peerItems
      .map((row) => safeNumber(row.trailingPE))
      .filter((value) => value !== null)
    const peerMedianPe = median(peerPes)
    const basePe = safeNumber(baseItem.trailingPE)

    let relativeValuation = "Insufficient peer valuation data."
    if (basePe !== null && peerMedianPe !== null) {
      if (basePe < peerMedianPe * 0.9) {
        relativeValuation = "Appears cheaper than peer median on trailing P/E."
      } else if (basePe > peerMedianPe * 1.1) {
        relativeValuation = "Appears more expensive than peer median on trailing P/E."
      } else {
        relativeValuation = "Appears near peer median valuation on trailing P/E."
      }
    }

    return {
      ticker: normalizedTicker,
      peers: peerItems.map((row) => ({
        ticker: row.ticker,
        companyName: row.companyName,
        trailingPE: safeNumber(row.trailingPE),
        marketCap: safeNumber(row.marketCap),
        source: row.source
      })),
      relativeValuation,
      base: {
        trailingPE: basePe,
        peerMedianTrailingPE: peerMedianPe,
        source: baseItem.source
      }
    }
  })
}
