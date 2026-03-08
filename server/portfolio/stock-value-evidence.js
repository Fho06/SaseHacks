function isFiniteNumber(value) {
  if (value === null || value === undefined) return false
  if (typeof value === "string" && value.trim() === "") return false
  const parsed = Number(value)
  return Number.isFinite(parsed)
}

function summarizeCoverage(coverage) {
  const parts = []
  if (coverage.hasPrice) parts.push("live price")
  if (coverage.hasMultiples) parts.push("valuation multiples")
  if (coverage.hasPeers) parts.push("peer comparison")
  if (coverage.hasRange) parts.push("52-week range")
  if (coverage.hasMomentum) parts.push("price momentum")
  if (coverage.hasMarketCap) parts.push("market cap")
  if (coverage.hasEnterpriseValue) parts.push("enterprise value")
  if (coverage.hasCashFlowYield) parts.push("cash-flow yield")
  if (parts.length === 0) return "No direct stock valuation metrics were available from market providers."
  return `Stock value assessment used ${parts.join(", ")} evidence.`
}

function getMarketSourceEntry(ticker, marketSnapshot, valuation) {
  if (marketSnapshot?.provider === "fmp") {
    return {
      provider: "fmp",
      kind: "market_snapshot",
      label: "Financial Modeling Prep quote and key metrics",
      url: `https://financialmodelingprep.com/financial-summary/${encodeURIComponent(String(ticker || "").toUpperCase())}`,
      metrics: {
        currentPrice: valuation.currentPrice ?? null,
        trailingPE: valuation.trailingPE ?? null,
        forwardPE: valuation.forwardPE ?? null,
        priceToBook: valuation.priceToBook ?? null,
        priceToSales: valuation.priceToSales ?? null,
        week52Low: valuation.week52Low ?? null,
        week52High: valuation.week52High ?? null,
        enterpriseValue: valuation.enterpriseValue ?? null,
        enterpriseValueToEbitda: valuation.enterpriseValueToEbitda ?? null,
        pegRatio: valuation.pegRatio ?? null
      }
    }
  }

  if (marketSnapshot?.provider === "yahoo") {
    return {
      provider: "yahoo",
      kind: "market_snapshot",
      label: "Yahoo Finance quote snapshot fallback",
      url: `https://finance.yahoo.com/quote/${encodeURIComponent(String(ticker || "").toUpperCase())}`,
      metrics: {
        currentPrice: valuation.currentPrice ?? null,
        trailingPE: valuation.trailingPE ?? null,
        forwardPE: valuation.forwardPE ?? null,
        priceToBook: valuation.priceToBook ?? null,
        priceToSales: valuation.priceToSales ?? null,
        week52Low: valuation.week52Low ?? null,
        week52High: valuation.week52High ?? null,
        enterpriseValue: valuation.enterpriseValue ?? null,
        enterpriseValueToEbitda: valuation.enterpriseValueToEbitda ?? null,
        pegRatio: valuation.pegRatio ?? null
      }
    }
  }

  return null
}

export function buildStockValueEvidence({ ticker, marketSnapshot, peerValuation, secSnapshot }) {
  const valuation = marketSnapshot?.valuation || {}
  const coverage = {
    hasPrice: isFiniteNumber(valuation.currentPrice),
    hasMultiples: [
      valuation.trailingPE,
      valuation.forwardPE,
      valuation.priceToBook,
      valuation.priceToSales,
      valuation.enterpriseValueToEbitda,
      valuation.pegRatio
    ].some(isFiniteNumber),
    hasRange: isFiniteNumber(valuation.week52Low) && isFiniteNumber(valuation.week52High),
    hasMomentum: [
      marketSnapshot?.momentum?.change1mPct,
      marketSnapshot?.momentum?.change3mPct,
      marketSnapshot?.momentum?.change6mPct,
      marketSnapshot?.momentum?.change1yPct
    ].some(isFiniteNumber),
    hasMarketCap: isFiniteNumber(valuation.marketCap),
    hasEnterpriseValue: isFiniteNumber(valuation.enterpriseValue),
    hasCashFlowYield: isFiniteNumber(valuation.freeCashFlowYield),
    hasPeers: isFiniteNumber(peerValuation?.base?.trailingPE)
      || isFiniteNumber(peerValuation?.base?.peerMedianTrailingPE)
      || (Array.isArray(peerValuation?.peers) && peerValuation.peers.some((peer) => isFiniteNumber(peer?.trailingPE)))
  }

  const entries = []
  const marketEntry = getMarketSourceEntry(ticker, marketSnapshot, valuation)
  if (marketEntry) {
    entries.push(marketEntry)
  }

  if (coverage.hasPeers || typeof peerValuation?.relativeValuation === "string") {
    entries.push({
      provider: "peer_valuation",
      kind: "peer_comparison",
      label: "Peer multiple comparison",
      url: `https://finance.yahoo.com/quote/${encodeURIComponent(String(ticker || "").toUpperCase())}`,
      details: String(peerValuation?.relativeValuation || "Peer valuation context was limited."),
      metrics: {
        trailingPE: peerValuation?.base?.trailingPE ?? null,
        peerMedianTrailingPE: peerValuation?.base?.peerMedianTrailingPE ?? null
      },
      peerCount: Array.isArray(peerValuation?.peers) ? peerValuation.peers.length : 0
    })
  }

  const secContextUrl = secSnapshot?.quarterlyReport?.url || secSnapshot?.annualReport?.url || null
  if (secContextUrl) {
    entries.push({
      provider: "sec_edgar",
      kind: "fundamental_context",
      label: "SEC filing context used to support valuation interpretation",
      url: secContextUrl,
      details: [
        secSnapshot?.annualReport ? `Annual filing: ${secSnapshot.annualReport.form || "10-K"} (${secSnapshot.annualReport.filingDate || "unknown"})` : null,
        secSnapshot?.quarterlyReport ? `Quarterly filing: ${secSnapshot.quarterlyReport.form || "10-Q"} (${secSnapshot.quarterlyReport.filingDate || "unknown"})` : null
      ].filter(Boolean)
    })
  }

  if (entries.length === 0) {
    entries.push({
      provider: "system_fallback",
      kind: "fallback",
      label: "No external market valuation feed was available for this run",
      url: null,
      details: "Stock value should be treated as low confidence until market data providers recover."
    })
  }

  const confidenceScore = [
    coverage.hasPrice,
    coverage.hasMultiples,
    coverage.hasPeers,
    coverage.hasRange,
    coverage.hasMarketCap
  ].filter(Boolean).length
  const confidence = confidenceScore >= 3 ? "high" : confidenceScore >= 2 ? "medium" : "low"

  return {
    ticker: String(ticker || "").toUpperCase(),
    confidence,
    coverage,
    summary: summarizeCoverage(coverage),
    entries
  }
}
