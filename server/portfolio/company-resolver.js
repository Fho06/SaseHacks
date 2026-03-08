import { getSecUserAgent, portfolioConfig } from "./config.js"

const SEC_TICKER_URL = "https://www.sec.gov/files/company_tickers.json"
const TICKER_BY_ALIAS = new Map([
  ["apple", "AAPL"],
  ["microsoft", "MSFT"],
  ["alphabet", "GOOGL"],
  ["google", "GOOGL"],
  ["amazon", "AMZN"],
  ["nvidia", "NVDA"],
  ["meta", "META"],
  ["tesla", "TSLA"]
])

let cachedSecCompanies = []
let lastSecRefresh = 0

function normalizeTicker(value) {
  return String(value || "").trim().toUpperCase().replace(/[^A-Z.\-]/g, "")
}

function normalizeName(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "")
}

function extractTickerHint(raw) {
  const match = raw.match(/\(([A-Za-z.\-]{1,10})\)\s*$/)
  if (!match) return null
  return normalizeTicker(match[1])
}

async function loadSecCompanyMap() {
  const now = Date.now()
  if (cachedSecCompanies.length > 0 && now - lastSecRefresh < portfolioConfig.cacheTtlMs) {
    return cachedSecCompanies
  }

  try {
    const response = await fetch(SEC_TICKER_URL, {
      headers: {
        "User-Agent": getSecUserAgent()
      }
    })
    if (!response.ok) return cachedSecCompanies

    const payload = await response.json()
    const rows = Object.values(payload || {})
    cachedSecCompanies = rows.map((row) => ({
      ticker: normalizeTicker(row?.ticker || ""),
      title: String(row?.title || "").trim(),
      cik: Number(row?.cik_str || 0)
    })).filter((row) => row.ticker)
    lastSecRefresh = now
    return cachedSecCompanies
  } catch {
    return cachedSecCompanies
  }
}

export async function getCompanyByTicker(ticker) {
  const secCompanies = await loadSecCompanyMap()
  const normalized = normalizeTicker(ticker)
  return secCompanies.find((item) => item.ticker === normalized) || null
}

function resolveFromAlias(raw) {
  const aliasTicker = TICKER_BY_ALIAS.get(raw.toLowerCase())
  if (!aliasTicker) return null
  return {
    ticker: aliasTicker,
    companyName: raw
  }
}

function resolveFromTicker(raw, secCompanies) {
  const ticker = normalizeTicker(raw)
  if (!/^[A-Z.\-]{1,10}$/.test(ticker)) return null

  const match = secCompanies.find((item) => item.ticker === ticker)
  return {
    ticker,
    companyName: match?.title || raw,
    cik: match?.cik || null
  }
}

function resolveFromName(raw, secCompanies) {
  const cleaned = normalizeName(raw)
  if (!cleaned) return null

  const exact = secCompanies.find((item) => normalizeName(item.title) === cleaned)
  if (exact) {
    return {
      ticker: exact.ticker,
      companyName: exact.title,
      cik: exact.cik || null
    }
  }

  const partial = secCompanies.find((item) => normalizeName(item.title).includes(cleaned))
  if (partial) {
    return {
      ticker: partial.ticker,
      companyName: partial.title,
      cik: partial.cik || null
    }
  }

  return null
}

export async function resolveCompanyInput(input) {
  const raw = String(input || "").trim()
  if (!raw) return null

  const secCompanies = await loadSecCompanyMap()

  const tickerHint = extractTickerHint(raw)
  if (tickerHint) {
    const resolvedByHint = resolveFromTicker(tickerHint, secCompanies)
    if (resolvedByHint) return resolvedByHint
  }

  const alias = resolveFromAlias(raw)
  if (alias) return alias

  const directTicker = resolveFromTicker(raw, secCompanies)
  if (directTicker) return directTicker

  const byName = resolveFromName(raw, secCompanies)
  if (byName) return byName

  return null
}
