import test from "node:test"
import assert from "node:assert/strict"
import { discoverNewsArticles } from "../portfolio/news-discovery.js"
import { fetchMarketSnapshot } from "../portfolio/market-data.js"

test("discoverNewsArticles gracefully falls back to empty list when providers fail", async () => {
  const originalFetch = global.fetch
  global.fetch = async () => ({
    ok: false,
    json: async () => ({}),
    text: async () => ""
  })

  try {
    const ticker = `ZZZ${Date.now().toString().slice(-4)}`
    const result = await discoverNewsArticles({ ticker, companyName: "Fallback Test" })
    assert.ok(Array.isArray(result))
    assert.equal(result.length, 0)
  } finally {
    global.fetch = originalFetch
  }
})

test("fetchMarketSnapshot gracefully falls back when providers fail", async () => {
  const originalFetch = global.fetch
  global.fetch = async () => ({
    ok: false,
    json: async () => ({}),
    text: async () => ""
  })

  try {
    const ticker = `YYY${Date.now().toString().slice(-4)}`
    const snapshot = await fetchMarketSnapshot({ ticker })
    assert.equal(snapshot.ticker, ticker)
    assert.equal(snapshot.revenueTrend, "Data unavailable")
    assert.equal(snapshot.provider, "none")
  } finally {
    global.fetch = originalFetch
  }
})

test("fetchMarketSnapshot tolerates HTML responses from providers", async () => {
  const originalFetch = global.fetch
  global.fetch = async () => ({
    ok: true,
    headers: {
      get: () => "text/html; charset=utf-8"
    },
    json: async () => {
      throw new Error("json parser should not be used for HTML")
    },
    text: async () => "<!DOCTYPE html><html></html>"
  })

  try {
    const ticker = `HTML${Date.now().toString().slice(-4)}`
    const snapshot = await fetchMarketSnapshot({ ticker })
    assert.equal(snapshot.ticker, ticker)
    assert.equal(snapshot.provider, "none")
  } finally {
    global.fetch = originalFetch
  }
})

test("fetchMarketSnapshot derives valuation from SEC facts and stooq price fallback", async () => {
  const originalFetch = global.fetch
  global.fetch = async (url) => {
    const target = String(url)

    if (target.includes("stooq.com")) {
      return {
        ok: true,
        headers: { get: () => "text/plain" },
        text: async () => "Date,Open,High,Low,Close,Volume\n2026-03-07,100,102,99,100,1000\n2026-03-08,110,112,109,110,1200"
      }
    }

    return {
      ok: false,
      headers: { get: () => "application/json" },
      json: async () => ({}),
      text: async () => ""
    }
  }

  try {
    const snapshot = await fetchMarketSnapshot({
      ticker: "MSFT",
      secSnapshot: {
        companyFacts: {
          netIncome: [{ value: 120000000000, fp: "FY", form: "10-K", end: "2025-12-31" }],
          revenue: [{ value: 260000000000, fp: "FY", form: "10-K", end: "2025-12-31" }],
          operatingCashFlow: [{ value: 140000000000, fp: "FY", form: "10-K", end: "2025-12-31" }],
          longTermDebt: [{ value: 45000000000, fp: "FY", form: "10-K", end: "2025-12-31" }],
          cashAndEquivalents: [{ value: 30000000000, fp: "FY", form: "10-K", end: "2025-12-31" }],
          stockholdersEquity: [{ value: 170000000000, fp: "FY", form: "10-K", end: "2025-12-31" }],
          sharesOutstanding: [{ value: 7400000000, end: "2025-12-31" }]
        }
      }
    })

    assert.equal(snapshot.ticker, "MSFT")
    assert.notEqual(snapshot.provider, "none")
    assert.equal(typeof snapshot.valuation.currentPrice, "number")
    assert.equal(typeof snapshot.valuation.marketCap, "number")
    assert.equal(typeof snapshot.valuation.trailingPE, "number")
    assert.equal(typeof snapshot.valuation.priceToSales, "number")
  } finally {
    global.fetch = originalFetch
  }
})
