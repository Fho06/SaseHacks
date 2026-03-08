import { PORTFOLIO_QUESTIONS } from "./questions.js"
import { clampQuestionScore } from "./scoring.js"

export function validateAnalyzeInput(body) {
  const query = String(body?.query || "").trim()
  if (!query) {
    return { ok: false, error: "query is required" }
  }
  if (query.length > 120) {
    return { ok: false, error: "query is too long" }
  }
  return { ok: true, query }
}

function normalizeSection(section, key) {
  const explanation = String(section?.explanation || "Neutral assessment due to limited verified data.")
  const byQuestion = new Map(
    Array.isArray(section?.questions)
      ? section.questions.map((item) => [String(item?.question || "").trim(), item])
      : []
  )

  return {
    score: Number.isFinite(Number(section?.score)) ? Number(section.score) : 50,
    explanation,
    questions: PORTFOLIO_QUESTIONS[key].map((question) => {
      const entry = byQuestion.get(question)
      return {
        question,
        score: clampQuestionScore(entry?.score),
        explanation: String(entry?.explanation || "No additional detail provided.")
      }
    })
  }
}

function normalizeTopThree(value, fallback) {
  const items = Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : []
  while (items.length < 3) {
    items.push(fallback)
  }
  return items.slice(0, 3)
}

function normalizeStockValueEvidence(rawEvidence, ticker) {
  const entries = Array.isArray(rawEvidence?.entries) ? rawEvidence.entries : []
  const normalizedEntries = entries
    .map((entry) => ({
      provider: String(entry?.provider || "unknown"),
      kind: String(entry?.kind || "reference"),
      label: String(entry?.label || "Stock value reference"),
      url: typeof entry?.url === "string" && entry.url.trim() ? entry.url : null,
      details: entry?.details ?? null,
      metrics: entry?.metrics ?? null,
      peerCount: Number.isFinite(Number(entry?.peerCount)) ? Number(entry.peerCount) : undefined
    }))
    .filter((entry) => entry.label)

  if (normalizedEntries.length === 0) {
    normalizedEntries.push({
      provider: "system_fallback",
      kind: "fallback",
      label: "No external market valuation feed was available for this run",
      url: null,
      details: "Stock value should be treated as low confidence until market data providers recover.",
      metrics: null
    })
  }

  return {
    ticker: String(rawEvidence?.ticker || ticker || "UNKNOWN").toUpperCase(),
    confidence: ["low", "medium", "high"].includes(String(rawEvidence?.confidence))
      ? String(rawEvidence.confidence)
      : "low",
    coverage: {
      hasPrice: Boolean(rawEvidence?.coverage?.hasPrice),
      hasMultiples: Boolean(rawEvidence?.coverage?.hasMultiples),
      hasRange: Boolean(rawEvidence?.coverage?.hasRange),
      hasMomentum: Boolean(rawEvidence?.coverage?.hasMomentum),
      hasPeers: Boolean(rawEvidence?.coverage?.hasPeers),
      hasMarketCap: Boolean(rawEvidence?.coverage?.hasMarketCap),
      hasEnterpriseValue: Boolean(rawEvidence?.coverage?.hasEnterpriseValue),
      hasCashFlowYield: Boolean(rawEvidence?.coverage?.hasCashFlowYield)
    },
    summary: String(rawEvidence?.summary || "Stock value evidence is limited."),
    entries: normalizedEntries
  }
}

export function ensureAnalysisPayload(payload) {
  const rawSources = payload?.sources || { news: [], filings: { annualReport: null, quarterlyReport: null }, valuation: {} }
  const rawValuation = rawSources?.valuation || {}
  const stockValueEvidence = normalizeStockValueEvidence(rawValuation?.stockValueEvidence, payload?.ticker)

  const normalized = {
    companyName: String(payload?.companyName || "Unknown Company"),
    ticker: String(payload?.ticker || "UNKNOWN").toUpperCase(),
    generatedAt: String(payload?.generatedAt || new Date().toISOString()),
    overallAssessment: Number.isFinite(Number(payload?.overallAssessment)) ? Number(payload.overallAssessment) : 50,
    verdict: String(payload?.verdict || "Mixed, Needs More Research"),
    growth: normalizeSection(payload?.growth, "growth"),
    financialHealth: normalizeSection(payload?.financialHealth, "financialHealth"),
    newsOutlook: normalizeSection(payload?.newsOutlook, "newsOutlook"),
    stockValue: normalizeSection(payload?.stockValue, "stockValue"),
    positives: normalizeTopThree(payload?.positives, "Limited verified upside evidence."),
    risks: normalizeTopThree(payload?.risks, "Limited verified downside evidence."),
    businessVsStockNote: String(payload?.businessVsStockNote || "Business quality and valuation should be assessed separately."),
    bottomLine: String(payload?.bottomLine || "This is an informational assessment and needs further research."),
    companySnapshot: payload?.companySnapshot || {},
    sources: {
      ...rawSources,
      valuation: {
        ...rawValuation,
        stockValueEvidence
      }
    }
  }

  return normalized
}
