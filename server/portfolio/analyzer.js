import { GoogleGenAI } from "@google/genai"
import { resolveCompanyInput } from "./company-resolver.js"
import { discoverNewsArticles } from "./news-discovery.js"
import { extractArticleContent } from "./article-extractor.js"
import { fetchSecSnapshot } from "./sec-data.js"
import { fetchMarketSnapshot } from "./market-data.js"
import { fetchPeerValuation } from "./peer-valuation.js"
import { cacheWrap } from "./cache.js"
import { portfolioConfig } from "./config.js"
import {
  clampQuestionScore,
  computeAttributeScore,
  computeOverallScore,
  mapVerdict
} from "./scoring.js"
import { buildPortfolioPrompt } from "./prompt.js"
import { PORTFOLIO_QUESTIONS } from "./questions.js"
import { ensureAnalysisPayload } from "./validation.js"
import { getModelText, parseModelJson } from "./model-json.js"
import { buildStockValueEvidence } from "./stock-value-evidence.js"
import {
  buildPortfolioEvidenceDocuments,
  ingestPortfolioEvidenceChunks,
  retrievePortfolioEvidenceChunks
} from "./evidence-rag.js"

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
})
const ANALYSIS_CACHE_VERSION = "v4"

function defaultQuestions(category) {
  return PORTFOLIO_QUESTIONS[category].map((question) => ({
    question,
    score: 3,
    explanation: "Insufficient data from external sources; neutral default."
  }))
}

function normalizeSection(rawSection, category) {
  const defaultSection = {
    explanation: "Neutral assessment due to limited verified data.",
    questions: defaultQuestions(category)
  }

  if (!rawSection || !Array.isArray(rawSection.questions)) {
    return defaultSection
  }

  const byQuestion = new Map(
    rawSection.questions.map((item) => [String(item?.question || "").trim(), item])
  )

  return {
    explanation: String(rawSection.explanation || defaultSection.explanation),
    questions: PORTFOLIO_QUESTIONS[category].map((question) => {
      const entry = byQuestion.get(question)
      return {
        question,
        score: clampQuestionScore(entry?.score),
        explanation: String(entry?.explanation || "No additional detail provided.")
      }
    })
  }
}

function normalizeTopItems(value, fallbackText) {
  const items = Array.isArray(value) ? value.map(String).map((item) => item.trim()).filter(Boolean) : []
  if (items.length >= 3) return items.slice(0, 3)
  const filled = [...items]
  while (filled.length < 3) {
    filled.push(fallbackText)
  }
  return filled.slice(0, 3)
}

function summarizeCompliance(audits) {
  const list = Array.isArray(audits) ? audits : []
  const byDecision = {}
  const byReason = {}

  for (const item of list) {
    const decision = String(item?.decision || "unknown")
    const reason = String(item?.reason || "unknown")
    byDecision[decision] = (byDecision[decision] || 0) + 1
    byReason[reason] = (byReason[reason] || 0) + 1
  }

  return {
    totalArticles: list.length,
    byDecision,
    byReason
  }
}

function firstFiniteNumber(candidates) {
  for (const value of candidates) {
    if (value === null || value === undefined) continue
    if (typeof value === "string" && value.trim() === "") continue
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

function formatMoney(value) {
  if (!Number.isFinite(Number(value))) return "N/A"
  const amount = Number(value)
  if (Math.abs(amount) >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(2)}B`
  if (Math.abs(amount) >= 1_000_000) return `${(amount / 1_000_000).toFixed(2)}M`
  return `${amount.toFixed(2)}`
}

function summarizeSeries(series, label) {
  if (!Array.isArray(series) || series.length < 2) {
    return `${label} trend is unavailable from current sources.`
  }

  const latest = Number(series[0]?.value)
  const previous = Number(series[1]?.value)
  if (!Number.isFinite(latest) || !Number.isFinite(previous) || previous === 0) {
    return `${label} trend is unavailable from current sources.`
  }

  const deltaPct = ((latest - previous) / Math.abs(previous)) * 100
  if (deltaPct > 5) {
    return `${label} is improving (${formatMoney(previous)} to ${formatMoney(latest)}, +${deltaPct.toFixed(1)}%).`
  }
  if (deltaPct < -5) {
    return `${label} is weakening (${formatMoney(previous)} to ${formatMoney(latest)}, ${deltaPct.toFixed(1)}%).`
  }
  return `${label} is relatively stable (${formatMoney(previous)} to ${formatMoney(latest)}, ${deltaPct.toFixed(1)}%).`
}

function buildDeterministicStockValueSection({
  marketSnapshot,
  peerValuation,
  stockValueEvidence
}) {
  const valuation = marketSnapshot?.valuation || {}
  const coverage = stockValueEvidence?.coverage || {}
  const questions = [...PORTFOLIO_QUESTIONS.stockValue]

  if (!coverage.hasPrice && !coverage.hasMultiples && !coverage.hasPeers && !coverage.hasRange && !coverage.hasMarketCap) {
    return {
      explanation: "Live valuation feeds were limited. Stock Value is kept neutral to avoid false low scoring from missing market data.",
      questions: questions.map((question) => ({
        question,
        score: 3,
        explanation: "Insufficient direct valuation metrics; neutral baseline applied."
      }))
    }
  }

  const basePe = Number(peerValuation?.base?.trailingPE)
  const peerMedianPe = Number(peerValuation?.base?.peerMedianTrailingPE)
  let q1Score = 3
  let q1Text = "Peer comparison data is partial; baseline score applied."
  if (Number.isFinite(basePe) && Number.isFinite(peerMedianPe) && peerMedianPe > 0) {
    const ratio = basePe / peerMedianPe
    if (ratio <= 0.85) q1Score = 4
    else if (ratio <= 1.15) q1Score = 3
    else if (ratio <= 1.4) q1Score = 2
    else q1Score = 1
    q1Text = `Trailing P/E vs peer median is ${ratio.toFixed(2)}x, informing relative valuation.`
  }

  const currentPrice = Number(valuation.currentPrice)
  const low52 = Number(valuation.week52Low)
  const high52 = Number(valuation.week52High)
  let q2Score = 3
  let q2Text = "Historical valuation range data is limited; baseline score applied."
  if (Number.isFinite(currentPrice) && Number.isFinite(low52) && Number.isFinite(high52) && high52 > low52) {
    const position = (currentPrice - low52) / (high52 - low52)
    if (position <= 0.25) q2Score = 4
    else if (position <= 0.75) q2Score = 3
    else if (position <= 0.9) q2Score = 2
    else q2Score = 1
    q2Text = `Current price is ${(position * 100).toFixed(1)}% through the 52-week range.`
  }

  const primaryPe = firstFiniteNumber([valuation.forwardPE, valuation.trailingPE])
  const priceToSales = firstFiniteNumber([valuation.priceToSales])
  const priceToBook = firstFiniteNumber([valuation.priceToBook])
  const freeCashFlowYield = firstFiniteNumber([valuation.freeCashFlowYield])
  const peg = firstFiniteNumber([valuation.pegRatio])
  let q3Score = 3
  let q3Text = "Price-to-fundamentals signal is partial; baseline score applied."
  if (Number.isFinite(primaryPe)) {
    if (primaryPe <= 18) q3Score = 4
    else if (primaryPe <= 30) q3Score = 3
    else if (primaryPe <= 45) q3Score = 2
    else q3Score = 1

    if (Number.isFinite(peg)) {
      if (peg <= 1.5) q3Score = Math.min(5, q3Score + 1)
      if (peg >= 3) q3Score = Math.max(1, q3Score - 1)
    }
    q3Text = `Primary earnings multiple is ${primaryPe.toFixed(2)}${Number.isFinite(peg) ? ` with PEG ${peg.toFixed(2)}` : ""}.`
  } else if (Number.isFinite(priceToSales) || Number.isFinite(priceToBook) || Number.isFinite(freeCashFlowYield)) {
    if (Number.isFinite(priceToSales)) {
      if (priceToSales <= 4) q3Score = 4
      else if (priceToSales <= 10) q3Score = 3
      else if (priceToSales <= 18) q3Score = 2
      else q3Score = 1
    }

    if (Number.isFinite(priceToBook)) {
      if (priceToBook <= 4) q3Score = Math.min(5, q3Score + 1)
      if (priceToBook >= 10) q3Score = Math.max(1, q3Score - 1)
    }

    if (Number.isFinite(freeCashFlowYield)) {
      if (freeCashFlowYield >= 0.04) q3Score = Math.min(5, q3Score + 1)
      if (freeCashFlowYield > -0.001 && freeCashFlowYield < 0.01) q3Score = Math.max(1, q3Score - 1)
    }

    q3Text = [
      Number.isFinite(priceToSales) ? `P/S ${priceToSales.toFixed(2)}` : null,
      Number.isFinite(priceToBook) ? `P/B ${priceToBook.toFixed(2)}` : null,
      Number.isFinite(freeCashFlowYield) ? `CF yield ${freeCashFlowYield.toFixed(3)}` : null
    ].filter(Boolean).join(", ")
  }

  const q4Score = clampQuestionScore(Math.round((q1Score + q2Score + q3Score) / 3))
  const q4Text = "Risk/reward score combines peer valuation, historical range, and earnings-multiple signals."

  return {
    explanation: `Deterministic stock value scoring used provider data with ${stockValueEvidence?.confidence || "low"} confidence.`,
    questions: [
      { question: questions[0], score: q1Score, explanation: q1Text },
      { question: questions[1], score: q2Score, explanation: q2Text },
      { question: questions[2], score: q3Score, explanation: q3Text },
      { question: questions[3], score: q4Score, explanation: q4Text }
    ]
  }
}

function applyStockValueGuard(modelStockValue, context) {
  const deterministic = buildDeterministicStockValueSection(context)
  const modelScores = (modelStockValue?.questions || []).map((item) => clampQuestionScore(item?.score))
  const modelAverage = modelScores.length > 0
    ? modelScores.reduce((sum, value) => sum + value, 0) / modelScores.length
    : 0
  const deterministicAverage = deterministic.questions.reduce((sum, item) => sum + item.score, 0) / deterministic.questions.length

  if (!modelStockValue || !Array.isArray(modelStockValue.questions) || modelAverage <= 0) {
    return deterministic
  }

  const noReliableValuationFeeds = !context?.stockValueEvidence?.coverage?.hasPrice
    && !context?.stockValueEvidence?.coverage?.hasMultiples
    && !context?.stockValueEvidence?.coverage?.hasPeers
    && !context?.stockValueEvidence?.coverage?.hasMarketCap
  if (noReliableValuationFeeds) {
    return deterministic
  }

  const weakCoverage = !context?.stockValueEvidence?.coverage?.hasMultiples
    && !context?.stockValueEvidence?.coverage?.hasPeers
  if (weakCoverage && modelAverage < 3) {
    return deterministic
  }

  if (modelAverage < 2 && deterministicAverage >= 3) {
    return deterministic
  }

  const blendedQuestions = modelStockValue.questions.map((item, index) => {
    const modelScore = clampQuestionScore(item?.score)
    const deterministicScore = deterministic.questions[index]?.score ?? 3
    const blendedScore = clampQuestionScore(Math.round((modelScore + deterministicScore) / 2))
    return {
      question: item.question,
      score: blendedScore,
      explanation: String(item?.explanation || deterministic.questions[index]?.explanation || "No additional detail provided.")
    }
  })

  return {
    explanation: String(modelStockValue.explanation || deterministic.explanation),
    questions: blendedQuestions
  }
}

function buildCompanySnapshot({ secSnapshot, marketSnapshot, peerValuation, stockValueEvidence }) {
  const revenueSeries = secSnapshot?.companyFacts?.revenue || []
  const netIncomeSeries = secSnapshot?.companyFacts?.netIncome || []
  const cashFlowSeries = secSnapshot?.companyFacts?.operatingCashFlow || []
  const debtSeries = secSnapshot?.companyFacts?.longTermDebt || []

  const latestDebt = debtSeries.length > 0 ? Number(debtSeries[0]?.value) : null
  const debtLiquiditySummary = Number.isFinite(latestDebt)
    ? `Latest long-term debt reported at ${formatMoney(latestDebt)}.`
    : "Debt position is unavailable from current sources."

  return {
    annualReport: secSnapshot?.annualReport || null,
    quarterlyReport: secSnapshot?.quarterlyReport || null,
    revenueTrendSummary: summarizeSeries(revenueSeries, "Revenue"),
    profitTrendSummary: summarizeSeries(netIncomeSeries, "Net income"),
    cashFlowSummary: summarizeSeries(cashFlowSeries, "Operating cash flow"),
    debtLiquiditySummary,
    managementGuidanceUpdates: secSnapshot?.guidance || [],
    valuationSnapshot: {
      ...marketSnapshot?.valuation,
      peerComparison: peerValuation?.relativeValuation || "Insufficient peer valuation data."
    },
    stockValueEvidence: {
      confidence: stockValueEvidence?.confidence || "low",
      coverage: stockValueEvidence?.coverage || {},
      summary: stockValueEvidence?.summary || "Stock value evidence is limited."
    }
  }
}

export async function analyzePortfolioCompany({ userId, query }) {
  const resolved = await resolveCompanyInput(query)
  if (!resolved) {
    throw new Error("Enter a valid public company name or ticker.")
  }

  const { ticker, companyName } = resolved
  const cacheKey = `analysis:${ANALYSIS_CACHE_VERSION}:${String(userId || "anon")}:${ticker}`
  return cacheWrap(cacheKey, portfolioConfig.cacheTtlMs, async () => {
    const news = await discoverNewsArticles({ ticker, companyName })
    const extractedNews = await Promise.all(news.map((item) => extractArticleContent(item)))
    const extractionAudits = extractedNews
      .map((item) => item?.complianceAudit)
      .filter(Boolean)
    const secSnapshot = await fetchSecSnapshot({ ticker, companyName })
    const marketSnapshot = await fetchMarketSnapshot({ ticker, companyName, secSnapshot })
    const peerValuation = await fetchPeerValuation({ ticker, companyName })
    const stockValueEvidence = buildStockValueEvidence({ ticker, marketSnapshot, peerValuation, secSnapshot })
    const companySnapshot = buildCompanySnapshot({ secSnapshot, marketSnapshot, peerValuation, stockValueEvidence })
    const portfolioEvidenceDocuments = buildPortfolioEvidenceDocuments({
      ticker,
      companyName,
      extractedNews,
      secSnapshot,
      marketSnapshot,
      peerValuation,
      stockValueEvidence
    })

    const ragIngestion = await ingestPortfolioEvidenceChunks({
      userId,
      ticker,
      companyName,
      evidenceDocuments: portfolioEvidenceDocuments
    })

    const ragRetrieval = await retrievePortfolioEvidenceChunks({
      userId,
      ticker,
      question: `${ticker} growth financial health cash flow debt guidance stock valuation peers price range multiples market cap enterprise value price to sales price to book trailing pe forward pe free cash flow yield momentum`,
      limit: portfolioConfig.evidenceRetrieveLimit
    })
    const ragChunks = ragRetrieval.chunks || []
    const ragContext = ragChunks.map((chunk, index) => (
      `[R${index + 1}] source=${chunk.filename || "portfolio-evidence"} type=${chunk.evidenceType || "unknown"}\n${chunk.text}`
    )).join("\n\n")

    const evidenceBundle = {
      userId,
      ticker,
      companyName,
      news: extractedNews.map((item) => ({
        title: item.title,
        source: item.source,
        url: item.url,
        publishedAt: item.publishedAt,
        snippet: item.snippet,
        extractionStatus: item.extractionStatus,
        complianceReason: item?.complianceAudit?.reason || "unknown"
      })),
      companySnapshot,
      ragEvidence: {
        documentId: ragRetrieval.documentId,
        indexedChunks: ragIngestion.indexedChunks,
        retrievedChunks: ragChunks.length,
        context: ragContext
      }
    }

    const prompt = buildPortfolioPrompt({ ticker, companyName, evidenceBundle })
    const rawResponse = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json"
      }
    })

    let parsed = parseModelJson(rawResponse)
    if (!parsed) {
      const retryResponse = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `${prompt}\n\nReturn only valid JSON. Do not include markdown fences or commentary.`,
        config: {
          responseMimeType: "application/json"
        }
      })
      parsed = parseModelJson(retryResponse)
    }

    if (!parsed) {
      const rawText = getModelText(rawResponse)
      console.error("Portfolio analysis JSON parse failed. Raw model output preview:", rawText.slice(0, 300))
      throw new Error("Portfolio analysis response was not valid JSON. Please retry.")
    }

    const growth = normalizeSection(parsed?.growth, "growth")
    const financialHealth = normalizeSection(parsed?.financialHealth, "financialHealth")
    const newsOutlook = normalizeSection(parsed?.newsOutlook, "newsOutlook")
    const stockValue = applyStockValueGuard(
      normalizeSection(parsed?.stockValue, "stockValue"),
      { marketSnapshot, peerValuation, stockValueEvidence }
    )

    const growthScore = computeAttributeScore(growth.questions.map((item) => item.score))
    const financialHealthScore = computeAttributeScore(financialHealth.questions.map((item) => item.score))
    const newsOutlookScore = computeAttributeScore(newsOutlook.questions.map((item) => item.score))
    const stockValueScore = computeAttributeScore(stockValue.questions.map((item) => item.score))
    const overallAssessment = computeOverallScore({
      growth: growthScore,
      financialHealth: financialHealthScore,
      newsOutlook: newsOutlookScore,
      stockValue: stockValueScore
    })

    const result = {
      companyName: String(parsed?.companyName || companyName),
      ticker,
      generatedAt: new Date().toISOString(),
      overallAssessment,
      verdict: mapVerdict(overallAssessment),
      growth: { score: growthScore, explanation: growth.explanation, questions: growth.questions },
      financialHealth: { score: financialHealthScore, explanation: financialHealth.explanation, questions: financialHealth.questions },
      newsOutlook: { score: newsOutlookScore, explanation: newsOutlook.explanation, questions: newsOutlook.questions },
      stockValue: { score: stockValueScore, explanation: stockValue.explanation, questions: stockValue.questions },
      positives: normalizeTopItems(parsed?.positives, "Limited hard evidence found for additional upside signals."),
      risks: normalizeTopItems(parsed?.risks, "Limited hard evidence found for additional downside signals."),
      businessVsStockNote: String(parsed?.businessVsStockNote || "Business quality and valuation should be assessed separately."),
      bottomLine: String(parsed?.bottomLine || "This is an informational assessment and needs further research."),
      companySnapshot,
      sources: {
        news: extractedNews.slice(0, 10).map((item) => ({
          title: item.title,
          source: item.source,
          url: item.url,
          publishedAt: item.publishedAt,
          snippet: item.snippet || "",
          provider: item.provider || "unknown",
          extractionStatus: item.extractionStatus || "unknown",
          complianceReason: item?.complianceAudit?.reason || "unknown",
          rankScore: item.rankScore ?? null,
          relevanceScore: item.relevanceScore ?? null,
          recencyScore: item.recencyScore ?? null,
          reputationScore: item.reputationScore ?? null
        })),
        filings: {
          annualReport: secSnapshot.annualReport,
          quarterlyReport: secSnapshot.quarterlyReport
        },
        valuation: {
          ...marketSnapshot.valuation,
          momentum: marketSnapshot.momentum || null,
          peerComparison: peerValuation.relativeValuation,
          marketProvider: marketSnapshot.provider || "none",
          stockValueEvidence
        },
        rag: {
          documentId: ragRetrieval.documentId,
          indexedChunks: ragIngestion.indexedChunks,
          retrievedChunks: ragChunks.map((chunk) => ({
            filename: chunk.filename || "portfolio-evidence",
            evidenceType: chunk.evidenceType || "unknown",
            chunkIndex: chunk.chunkIndex,
            vectorScore: chunk.vectorScore ?? null,
            textScore: chunk.textScore ?? null,
            fusionScore: chunk.fusionScore ?? null
          }))
        },
        compliance: {
          summary: summarizeCompliance(extractionAudits),
          extractionAudits
        }
      }
    }

    return ensureAnalysisPayload(result)
  })
}
