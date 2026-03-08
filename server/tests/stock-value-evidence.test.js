import test from "node:test"
import assert from "node:assert/strict"
import { buildStockValueEvidence } from "../portfolio/stock-value-evidence.js"

test("buildStockValueEvidence guarantees at least one source entry", () => {
  const evidence = buildStockValueEvidence({
    ticker: "MSFT",
    marketSnapshot: { provider: "none", valuation: {} },
    peerValuation: { relativeValuation: "Insufficient peer valuation data.", peers: [], base: {} },
    secSnapshot: {}
  })

  assert.equal(evidence.ticker, "MSFT")
  assert.ok(Array.isArray(evidence.entries))
  assert.ok(evidence.entries.length >= 1)
})

test("buildStockValueEvidence includes market and peer entries when available", () => {
  const evidence = buildStockValueEvidence({
    ticker: "MSFT",
    marketSnapshot: {
      provider: "fmp",
      valuation: {
        currentPrice: 420.15,
        trailingPE: 31.2,
        week52Low: 290.1,
        week52High: 430.5
      }
    },
    peerValuation: {
      relativeValuation: "Appears near peer median valuation on trailing P/E.",
      peers: [{ ticker: "AAPL", trailingPE: 29.1 }],
      base: { trailingPE: 31.2, peerMedianTrailingPE: 30.3 }
    },
    secSnapshot: {
      annualReport: { url: "https://www.sec.gov/example-10k" },
      quarterlyReport: null
    }
  })

  const providers = evidence.entries.map((entry) => entry.provider)
  assert.ok(providers.includes("fmp"))
  assert.ok(providers.includes("peer_valuation"))
  assert.ok(providers.includes("sec_edgar"))
  assert.equal(evidence.coverage.hasPrice, true)
  assert.equal(evidence.coverage.hasPeers, true)
})

test("buildStockValueEvidence does not treat null metrics as coverage", () => {
  const evidence = buildStockValueEvidence({
    ticker: "MSFT",
    marketSnapshot: {
      provider: "yahoo",
      valuation: {
        currentPrice: null,
        trailingPE: null,
        forwardPE: null,
        priceToBook: null,
        priceToSales: null,
        week52Low: null,
        week52High: null
      },
      momentum: {}
    },
    peerValuation: {
      relativeValuation: "Insufficient peer valuation data.",
      peers: [],
      base: { trailingPE: null, peerMedianTrailingPE: null }
    },
    secSnapshot: {}
  })

  assert.equal(evidence.coverage.hasPrice, false)
  assert.equal(evidence.coverage.hasMultiples, false)
  assert.equal(evidence.coverage.hasPeers, false)
})
