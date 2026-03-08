import { getSecUserAgent, hasMarketPrimaryProvider, portfolioConfig } from "./config.js"
import { cacheWrap } from "./cache.js"

function safeNumber(value) {
  if (value === null || value === undefined) return null
  if (typeof value === "string" && value.trim() === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function firstFiniteNumber(candidates) {
  for (const candidate of candidates) {
    const parsed = safeNumber(candidate)
    if (parsed !== null) return parsed
  }
  return null
}

function getArray(payload) {
  return Array.isArray(payload) ? payload : []
}

function getObject(payload) {
  return payload && typeof payload === "object" ? payload : {}
}

async function parseJsonResponseSafe(response) {
  try {
    const contentType = String(response.headers?.get?.("content-type") || "").toLowerCase()
    if (contentType.includes("application/json")) {
      return await response.json()
    }

    const text = await response.text()
    const trimmed = String(text || "").trim()
    if (!trimmed) return null
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      return JSON.parse(trimmed)
    }
    return null
  } catch {
    return null
  }
}

function buildApiUrl(path, apiKey, params = {}, baseUrl = portfolioConfig.marketApiUrl) {
  const normalizedBase = `${String(baseUrl || "").replace(/\/+$/, "")}/`
  const url = new URL(String(path || "").replace(/^\//, ""), normalizedBase)
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue
    url.searchParams.set(key, String(value))
  }
  if (!url.searchParams.has("apikey")) {
    url.searchParams.set("apikey", apiKey)
  }
  return url.toString()
}

function computeMomentumFromOrderedPrices(prices = []) {
  if (!Array.isArray(prices) || prices.length === 0) {
    return {
      low: null,
      high: null,
      latest: null,
      change1mPct: null,
      change3mPct: null,
      change6mPct: null,
      change1yPct: null
    }
  }

  const cleanPrices = prices.map(safeNumber).filter((value) => value !== null)
  if (cleanPrices.length === 0) {
    return {
      low: null,
      high: null,
      latest: null,
      change1mPct: null,
      change3mPct: null,
      change6mPct: null,
      change1yPct: null
    }
  }

  const latest = cleanPrices[cleanPrices.length - 1]
  const low = Math.min(...cleanPrices)
  const high = Math.max(...cleanPrices)

  const pointAt = (offset) => cleanPrices[Math.max(0, cleanPrices.length - 1 - offset)] ?? null
  const pct = (past) => {
    const p = safeNumber(past)
    if (p === null || p === 0) return null
    return ((latest - p) / Math.abs(p)) * 100
  }

  return {
    low,
    high,
    latest,
    change1mPct: pct(pointAt(21)),
    change3mPct: pct(pointAt(63)),
    change6mPct: pct(pointAt(125)),
    change1yPct: pct(pointAt(251))
  }
}

function computeFmpHistoryRange(historyRows = []) {
  const ordered = getArray(historyRows)
    .map((row) => ({
      date: row?.date || null,
      close: firstFiniteNumber([row?.close, row?.adjClose, row?.price])
    }))
    .filter((row) => row.close !== null)
    .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())

  return computeMomentumFromOrderedPrices(ordered.map((item) => item.close))
}

function parseCsv(text) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length <= 1) return []
  const header = lines[0].split(",").map((col) => col.trim().toLowerCase())
  const rows = []

  for (let i = 1; i < lines.length; i += 1) {
    const columns = lines[i].split(",")
    if (columns.length !== header.length) continue

    const row = {}
    for (let c = 0; c < header.length; c += 1) {
      row[header[c]] = columns[c]
    }
    rows.push(row)
  }

  return rows
}

function toStooqSymbol(ticker) {
  const normalized = String(ticker || "").trim().toLowerCase()
  if (!normalized) return ""
  const safe = normalized.replace(/\./g, "-")
  return `${safe}.us`
}

async function fetchStooqHistoryRange(ticker) {
  const symbol = toStooqSymbol(ticker)
  if (!symbol) return null

  try {
    const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(symbol)}&i=d`
    const response = await fetch(url, { headers: { "User-Agent": getSecUserAgent() } })
    if (!response.ok) return null

    const csvText = await response.text()
    const rows = parseCsv(csvText)
    if (rows.length === 0) return null

    const ordered = rows
      .map((row) => ({
        date: row?.date || null,
        close: safeNumber(row?.close)
      }))
      .filter((row) => row.close !== null)
      .sort((a, b) => new Date(a.date || 0).getTime() - new Date(b.date || 0).getTime())

    if (ordered.length === 0) return null
    const stats = computeMomentumFromOrderedPrices(ordered.map((item) => item.close))
    return {
      ...stats,
      source: "stooq"
    }
  } catch {
    return null
  }
}

function selectLatestFactValue(series = []) {
  if (!Array.isArray(series) || series.length === 0) return null
  for (const item of series) {
    const value = safeNumber(item?.value)
    if (value !== null) return value
  }
  return null
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

function buildSecDerivedValuation({ secSnapshot, price }) {
  const companyFacts = secSnapshot?.companyFacts || {}
  const sharesOutstanding = selectLatestFactValue(companyFacts.sharesOutstanding)
  const marketCap = (safeNumber(price) !== null && sharesOutstanding !== null)
    ? safeNumber(price) * sharesOutstanding
    : null

  const revenueAnnualOrTtm = selectAnnualOrTtmValue(companyFacts.revenue)
  const netIncomeAnnualOrTtm = selectAnnualOrTtmValue(companyFacts.netIncome)
  const cashFlowAnnualOrTtm = selectAnnualOrTtmValue(companyFacts.operatingCashFlow)
  const debtLatest = selectLatestFactValue(companyFacts.longTermDebt)
  const cashLatest = selectLatestFactValue(companyFacts.cashAndEquivalents)
  const equityLatest = selectLatestFactValue(companyFacts.stockholdersEquity)

  const trailingPE = (marketCap !== null && netIncomeAnnualOrTtm && netIncomeAnnualOrTtm > 0)
    ? marketCap / netIncomeAnnualOrTtm
    : null
  const priceToSales = (marketCap !== null && revenueAnnualOrTtm && revenueAnnualOrTtm > 0)
    ? marketCap / revenueAnnualOrTtm
    : null
  const priceToBook = (marketCap !== null && equityLatest && equityLatest > 0)
    ? marketCap / equityLatest
    : null
  const enterpriseValue = (marketCap !== null && debtLatest !== null)
    ? (marketCap + debtLatest - (cashLatest || 0))
    : null
  const freeCashFlowYield = (marketCap !== null && cashFlowAnnualOrTtm && marketCap > 0)
    ? cashFlowAnnualOrTtm / marketCap
    : null

  return {
    marketCap,
    trailingPE,
    forwardPE: null,
    priceToBook,
    priceToSales,
    week52Low: null,
    week52High: null,
    enterpriseValue,
    enterpriseValueToEbitda: null,
    pegRatio: null,
    freeCashFlowYield
  }
}

function mergeValuation(primaryValuation = {}, ...fallbacks) {
  const fields = [
    "currentPrice",
    "trailingPE",
    "forwardPE",
    "priceToBook",
    "priceToSales",
    "week52Low",
    "week52High",
    "marketCap",
    "enterpriseValue",
    "enterpriseValueToEbitda",
    "pegRatio",
    "freeCashFlowYield"
  ]

  const merged = {}
  for (const field of fields) {
    const candidates = [primaryValuation?.[field], ...fallbacks.map((item) => item?.[field])]
    merged[field] = firstFiniteNumber(candidates)
  }
  return merged
}

function buildNarrative(valuation, providerLabel) {
  const trailingPe = safeNumber(valuation?.trailingPE)
  const debtToEquity = safeNumber(valuation?.debtToEquity)
  const cashFlowYield = safeNumber(valuation?.freeCashFlowYield)

  return {
    revenueTrend: "Refer to SEC revenue facts in evidence bundle.",
    profitabilityTrend: trailingPe !== null
      ? `Trailing P/E from ${providerLabel} snapshot: ${trailingPe.toFixed(2)}.`
      : "Profitability trend requires additional provider data.",
    cashFlowTrend: cashFlowYield !== null
      ? `Operating cash flow yield estimate: ${cashFlowYield.toFixed(3)}.`
      : "Cash flow trend requires additional provider data.",
    debtPosition: debtToEquity !== null
      ? `Debt to equity estimate: ${debtToEquity.toFixed(2)}.`
      : "Debt ratio unavailable from current market source."
  }
}

function providerLabel(parts) {
  return parts.filter(Boolean).join("+")
}

async function fetchFmpSnapshot(ticker) {
  if (!hasMarketPrimaryProvider()) return null

  try {
    const requests = await Promise.all([
      fetch(buildApiUrl(`/quote/${ticker}`, portfolioConfig.marketApiKey), { headers: { "User-Agent": getSecUserAgent() } }),
      fetch(buildApiUrl(`/key-metrics-ttm/${ticker}`, portfolioConfig.marketApiKey), { headers: { "User-Agent": getSecUserAgent() } }),
      fetch(buildApiUrl(`/ratios-ttm/${ticker}`, portfolioConfig.marketApiKey), { headers: { "User-Agent": getSecUserAgent() } }),
      fetch(buildApiUrl(`/historical-price-full/${ticker}`, portfolioConfig.marketApiKey, { timeseries: 365, serietype: "line" }), {
        headers: { "User-Agent": getSecUserAgent() }
      }),
      fetch(buildApiUrl(`/enterprise-values/${ticker}`, portfolioConfig.marketApiKey, { limit: 1 }), {
        headers: { "User-Agent": getSecUserAgent() }
      })
    ])

    const [quoteRes, keyMetricsRes, ratiosRes, historyRes, enterpriseRes] = requests
    const quote = getArray(quoteRes.ok ? await parseJsonResponseSafe(quoteRes) : null)[0] || null
    const keyMetrics = getArray(keyMetricsRes.ok ? await parseJsonResponseSafe(keyMetricsRes) : null)[0] || null
    const ratios = getArray(ratiosRes.ok ? await parseJsonResponseSafe(ratiosRes) : null)[0] || null
    const historyPayload = historyRes.ok ? await parseJsonResponseSafe(historyRes) : null
    const enterprise = getArray(enterpriseRes.ok ? await parseJsonResponseSafe(enterpriseRes) : null)[0] || null

    const historyRange = computeFmpHistoryRange(getObject(historyPayload).historical)
    if (!quote && !keyMetrics && !ratios && !enterprise && !historyRange.latest) {
      return null
    }

    const valuation = {
      currentPrice: firstFiniteNumber([quote?.price, historyRange.latest]),
      trailingPE: firstFiniteNumber([quote?.pe, keyMetrics?.peRatioTTM, ratios?.peRatioTTM]),
      forwardPE: firstFiniteNumber([quote?.forwardPE, ratios?.forwardPERatioTTM]),
      priceToBook: firstFiniteNumber([keyMetrics?.pbRatioTTM, ratios?.priceToBookRatioTTM, quote?.priceToBook]),
      priceToSales: firstFiniteNumber([keyMetrics?.priceToSalesRatioTTM, ratios?.priceToSalesRatioTTM]),
      week52Low: firstFiniteNumber([quote?.yearLow, historyRange.low]),
      week52High: firstFiniteNumber([quote?.yearHigh, historyRange.high]),
      marketCap: firstFiniteNumber([quote?.marketCap, enterprise?.marketCapitalization]),
      enterpriseValue: firstFiniteNumber([enterprise?.enterpriseValue]),
      enterpriseValueToEbitda: firstFiniteNumber([ratios?.enterpriseValueMultipleTTM, keyMetrics?.evToEbitdaTTM]),
      pegRatio: firstFiniteNumber([ratios?.pegRatioTTM, quote?.pegRatio]),
      freeCashFlowYield: firstFiniteNumber([keyMetrics?.freeCashFlowYieldTTM]),
      debtToEquity: firstFiniteNumber([keyMetrics?.debtToEquityTTM, ratios?.debtEquityRatioTTM])
    }

    return {
      ticker: String(ticker).toUpperCase(),
      valuation,
      momentum: {
        change1mPct: historyRange.change1mPct,
        change3mPct: historyRange.change3mPct,
        change6mPct: historyRange.change6mPct,
        change1yPct: historyRange.change1yPct
      },
      provider: "fmp"
    }
  } catch {
    return null
  }
}

async function fetchYahooChartRange(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1d`
    const response = await fetch(url, {
      headers: { "User-Agent": getSecUserAgent() }
    })
    if (!response.ok) return null

    const payload = await parseJsonResponseSafe(response)
    const result = payload?.chart?.result?.[0]
    const closes = Array.isArray(result?.indicators?.quote?.[0]?.close)
      ? result.indicators.quote[0].close.map(safeNumber).filter((value) => value !== null)
      : []

    if (closes.length === 0) return null
    return computeMomentumFromOrderedPrices(closes)
  } catch {
    return null
  }
}

async function fetchYahooQuote(ticker) {
  try {
    const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}`
    const response = await fetch(url, {
      headers: { "User-Agent": getSecUserAgent() }
    })
    if (!response.ok) return null
    const payload = await parseJsonResponseSafe(response)
    const rows = payload?.quoteResponse?.result
    if (!Array.isArray(rows) || rows.length === 0) return null
    return rows[0]
  } catch {
    return null
  }
}

async function fetchYahooSnapshot(ticker) {
  const [quote, range] = await Promise.all([
    fetchYahooQuote(ticker),
    fetchYahooChartRange(ticker)
  ])

  if (!quote && !range) return null

  const valuation = {
    currentPrice: firstFiniteNumber([quote?.regularMarketPrice, range?.latest]),
    trailingPE: firstFiniteNumber([quote?.trailingPE]),
    forwardPE: firstFiniteNumber([quote?.forwardPE]),
    priceToBook: firstFiniteNumber([quote?.priceToBook]),
    priceToSales: firstFiniteNumber([quote?.priceToSalesTrailing12Months]),
    week52Low: firstFiniteNumber([quote?.fiftyTwoWeekLow, range?.low]),
    week52High: firstFiniteNumber([quote?.fiftyTwoWeekHigh, range?.high]),
    marketCap: firstFiniteNumber([quote?.marketCap]),
    enterpriseValue: firstFiniteNumber([quote?.enterpriseValue]),
    enterpriseValueToEbitda: null,
    pegRatio: firstFiniteNumber([quote?.pegRatio]),
    freeCashFlowYield: null,
    debtToEquity: firstFiniteNumber([quote?.debtToEquity])
  }

  return {
    ticker: String(ticker).toUpperCase(),
    valuation,
    momentum: {
      change1mPct: range?.change1mPct ?? null,
      change3mPct: range?.change3mPct ?? null,
      change6mPct: range?.change6mPct ?? null,
      change1yPct: range?.change1yPct ?? null
    },
    provider: "yahoo"
  }
}

async function fetchStooqSnapshot(ticker) {
  const range = await fetchStooqHistoryRange(ticker)
  if (!range) return null

  return {
    ticker: String(ticker).toUpperCase(),
    valuation: {
      currentPrice: range.latest,
      trailingPE: null,
      forwardPE: null,
      priceToBook: null,
      priceToSales: null,
      week52Low: range.low,
      week52High: range.high,
      marketCap: null,
      enterpriseValue: null,
      enterpriseValueToEbitda: null,
      pegRatio: null,
      freeCashFlowYield: null,
      debtToEquity: null
    },
    momentum: {
      change1mPct: range.change1mPct,
      change3mPct: range.change3mPct,
      change6mPct: range.change6mPct,
      change1yPct: range.change1yPct
    },
    provider: "stooq"
  }
}

function toPublicValuation(valuation) {
  return {
    currentPrice: firstFiniteNumber([valuation?.currentPrice]),
    trailingPE: firstFiniteNumber([valuation?.trailingPE]),
    forwardPE: firstFiniteNumber([valuation?.forwardPE]),
    priceToBook: firstFiniteNumber([valuation?.priceToBook]),
    priceToSales: firstFiniteNumber([valuation?.priceToSales]),
    week52Low: firstFiniteNumber([valuation?.week52Low]),
    week52High: firstFiniteNumber([valuation?.week52High]),
    marketCap: firstFiniteNumber([valuation?.marketCap]),
    enterpriseValue: firstFiniteNumber([valuation?.enterpriseValue]),
    enterpriseValueToEbitda: firstFiniteNumber([valuation?.enterpriseValueToEbitda]),
    pegRatio: firstFiniteNumber([valuation?.pegRatio]),
    freeCashFlowYield: firstFiniteNumber([valuation?.freeCashFlowYield]),
    debtToEquity: firstFiniteNumber([valuation?.debtToEquity])
  }
}

function toProviderResult({ ticker, valuation, momentum, provider }) {
  const publicValuation = toPublicValuation(valuation)
  const narratives = buildNarrative(publicValuation, provider)
  return {
    ticker: String(ticker).toUpperCase(),
    ...narratives,
    debtPosition: publicValuation.debtToEquity !== null
      ? `Debt to equity indicator available: ${publicValuation.debtToEquity.toFixed(2)}.`
      : narratives.debtPosition,
    valuation: {
      currentPrice: publicValuation.currentPrice,
      trailingPE: publicValuation.trailingPE,
      forwardPE: publicValuation.forwardPE,
      priceToBook: publicValuation.priceToBook,
      priceToSales: publicValuation.priceToSales,
      week52Low: publicValuation.week52Low,
      week52High: publicValuation.week52High,
      marketCap: publicValuation.marketCap,
      enterpriseValue: publicValuation.enterpriseValue,
      enterpriseValueToEbitda: publicValuation.enterpriseValueToEbitda,
      pegRatio: publicValuation.pegRatio,
      freeCashFlowYield: publicValuation.freeCashFlowYield
    },
    momentum: {
      change1mPct: firstFiniteNumber([momentum?.change1mPct]),
      change3mPct: firstFiniteNumber([momentum?.change3mPct]),
      change6mPct: firstFiniteNumber([momentum?.change6mPct]),
      change1yPct: firstFiniteNumber([momentum?.change1yPct])
    },
    provider
  }
}

function hasAnyValuationSignal(valuation) {
  return [
    valuation?.currentPrice,
    valuation?.trailingPE,
    valuation?.forwardPE,
    valuation?.priceToBook,
    valuation?.priceToSales,
    valuation?.week52Low,
    valuation?.week52High,
    valuation?.marketCap
  ].some((value) => safeNumber(value) !== null)
}

export async function fetchMarketSnapshot({ ticker, secSnapshot = null }) {
  const normalizedTicker = String(ticker).toUpperCase()
  const cacheKey = `market:v2:${normalizedTicker}`

  return cacheWrap(cacheKey, portfolioConfig.cacheTtlMs, async () => {
    const [fmpSnapshot, yahooSnapshot, stooqSnapshot] = await Promise.all([
      fetchFmpSnapshot(normalizedTicker),
      fetchYahooSnapshot(normalizedTicker),
      fetchStooqSnapshot(normalizedTicker)
    ])

    const primary = fmpSnapshot || yahooSnapshot || stooqSnapshot
    const fallback = (!primary || primary.provider === "fmp") ? yahooSnapshot : stooqSnapshot
    const extra = stooqSnapshot

    const baseValuation = mergeValuation(
      primary?.valuation || {},
      fallback?.valuation || {},
      extra?.valuation || {}
    )

    const secDerived = buildSecDerivedValuation({
      secSnapshot,
      price: firstFiniteNumber([baseValuation.currentPrice, primary?.valuation?.currentPrice, fallback?.valuation?.currentPrice, extra?.valuation?.currentPrice])
    })

    const mergedValuation = mergeValuation(baseValuation, secDerived)

    const momentum = {
      change1mPct: firstFiniteNumber([primary?.momentum?.change1mPct, fallback?.momentum?.change1mPct, extra?.momentum?.change1mPct]),
      change3mPct: firstFiniteNumber([primary?.momentum?.change3mPct, fallback?.momentum?.change3mPct, extra?.momentum?.change3mPct]),
      change6mPct: firstFiniteNumber([primary?.momentum?.change6mPct, fallback?.momentum?.change6mPct, extra?.momentum?.change6mPct]),
      change1yPct: firstFiniteNumber([primary?.momentum?.change1yPct, fallback?.momentum?.change1yPct, extra?.momentum?.change1yPct])
    }

    if (hasAnyValuationSignal(mergedValuation)) {
      const provider = providerLabel([
        primary?.provider,
        fallback?.provider && fallback?.provider !== primary?.provider ? fallback.provider : null,
        hasAnyValuationSignal(secDerived) ? "sec_derived" : null
      ])

      return toProviderResult({
        ticker: normalizedTicker,
        valuation: mergedValuation,
        momentum,
        provider: provider || "fallback"
      })
    }

    return {
      ticker: normalizedTicker,
      revenueTrend: "Data unavailable",
      profitabilityTrend: "Data unavailable",
      cashFlowTrend: "Data unavailable",
      debtPosition: "Data unavailable",
      valuation: {
        currentPrice: null,
        trailingPE: null,
        forwardPE: null,
        priceToBook: null,
        priceToSales: null,
        week52Low: null,
        week52High: null,
        marketCap: null,
        enterpriseValue: null,
        enterpriseValueToEbitda: null,
        pegRatio: null,
        freeCashFlowYield: null
      },
      momentum: {
        change1mPct: null,
        change3mPct: null,
        change6mPct: null,
        change1yPct: null
      },
      provider: "none"
    }
  })
}
