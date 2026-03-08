import { db } from "../config/mongodb.js"
import { chunkText } from "../services/chunker.js"
import { embedText } from "../services/embeddings.js"
import {
  CHUNKS_COLLECTION,
  TEXT_INDEX_NAME,
  VECTOR_INDEX_NAME,
  VECTOR_PATH
} from "../search/search-indexes.js"
import { portfolioConfig } from "./config.js"

const PORTFOLIO_EVIDENCE_SOURCE_TYPE = "portfolio_evidence"

function toUpperTicker(value) {
  return String(value || "").trim().toUpperCase()
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function asLines(lines) {
  return lines.filter(Boolean).join("\n")
}

function safeNumber(value) {
  if (value === null || value === undefined) return null
  if (typeof value === "string" && value.trim() === "") return null
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

function serializeValuationMetrics(valuation = {}) {
  return asLines([
    `currentPrice=${safeNumber(valuation.currentPrice)}`,
    `trailingPE=${safeNumber(valuation.trailingPE)}`,
    `forwardPE=${safeNumber(valuation.forwardPE)}`,
    `priceToBook=${safeNumber(valuation.priceToBook)}`,
    `priceToSales=${safeNumber(valuation.priceToSales)}`,
    `week52Low=${safeNumber(valuation.week52Low)}`,
    `week52High=${safeNumber(valuation.week52High)}`,
    `marketCap=${safeNumber(valuation.marketCap)}`,
    `enterpriseValue=${safeNumber(valuation.enterpriseValue)}`,
    `enterpriseValueToEbitda=${safeNumber(valuation.enterpriseValueToEbitda)}`,
    `pegRatio=${safeNumber(valuation.pegRatio)}`,
    `freeCashFlowYield=${safeNumber(valuation.freeCashFlowYield)}`
  ])
}

function serializeMomentum(momentum = {}) {
  return asLines([
    `change1mPct=${safeNumber(momentum.change1mPct)}`,
    `change3mPct=${safeNumber(momentum.change3mPct)}`,
    `change6mPct=${safeNumber(momentum.change6mPct)}`,
    `change1yPct=${safeNumber(momentum.change1yPct)}`
  ])
}

function serializeFactsSeries(name, series = [], maxPoints = 8) {
  const points = Array.isArray(series) ? series.slice(0, maxPoints) : []
  if (points.length === 0) return `${name}: unavailable`
  return [
    `${name}:`,
    ...points.map((item) => {
      const value = Number.isFinite(Number(item?.value)) ? Number(item.value) : null
      const end = item?.end || item?.filed || "unknown-date"
      return `- ${end}: ${value}`
    })
  ].join("\n")
}

export function buildPortfolioEvidenceDocuments({
  ticker,
  companyName,
  extractedNews,
  secSnapshot,
  marketSnapshot,
  peerValuation,
  stockValueEvidence
}) {
  const normalizedTicker = toUpperTicker(ticker)
  const docs = []
  const valuation = marketSnapshot?.valuation || {}

  docs.push({
    title: `${normalizedTicker}-market-valuation`,
    evidenceType: "market_valuation",
    text: asLines([
      `Ticker: ${normalizedTicker}`,
      `Company: ${companyName || normalizedTicker}`,
      `Market Provider: ${marketSnapshot?.provider || "unknown"}`,
      `Peer Comparison: ${peerValuation?.relativeValuation || "unavailable"}`,
      serializeValuationMetrics(valuation),
      `Momentum Signals:`,
      serializeMomentum(marketSnapshot?.momentum || {})
    ])
  })

  docs.push({
    title: `${normalizedTicker}-stock-value-evidence`,
    evidenceType: "stock_value_evidence",
    text: asLines([
      `Ticker: ${normalizedTicker}`,
      `Stock Value Evidence Confidence: ${stockValueEvidence?.confidence || "low"}`,
      `Stock Value Evidence Summary: ${stockValueEvidence?.summary || "No summary available."}`,
      ...((stockValueEvidence?.entries || []).map((entry, index) => asLines([
        `Entry ${index + 1}:`,
        `- Provider: ${entry.provider || "unknown"}`,
        `- Kind: ${entry.kind || "reference"}`,
        `- Label: ${entry.label || "Stock value reference"}`,
        `- Url: ${entry.url || "none"}`,
        `- Details: ${typeof entry.details === "string" ? entry.details : JSON.stringify(entry.details || null)}`
      ])))
    ])
  })

  docs.push({
    title: `${normalizedTicker}-sec-filing-context`,
    evidenceType: "sec_snapshot",
    text: asLines([
      `Ticker: ${normalizedTicker}`,
      `Annual Filing: ${secSnapshot?.annualReport?.form || "n/a"} ${secSnapshot?.annualReport?.filingDate || ""} ${secSnapshot?.annualReport?.url || ""}`,
      `Quarterly Filing: ${secSnapshot?.quarterlyReport?.form || "n/a"} ${secSnapshot?.quarterlyReport?.filingDate || ""} ${secSnapshot?.quarterlyReport?.url || ""}`,
      ...(Array.isArray(secSnapshot?.guidance) ? secSnapshot.guidance.map((line) => `Guidance: ${line}`) : []),
      serializeFactsSeries("Revenue", secSnapshot?.companyFacts?.revenue),
      serializeFactsSeries("NetIncome", secSnapshot?.companyFacts?.netIncome),
      serializeFactsSeries("OperatingCashFlow", secSnapshot?.companyFacts?.operatingCashFlow),
      serializeFactsSeries("LongTermDebt", secSnapshot?.companyFacts?.longTermDebt),
      serializeFactsSeries("CashAndEquivalents", secSnapshot?.companyFacts?.cashAndEquivalents),
      serializeFactsSeries("StockholdersEquity", secSnapshot?.companyFacts?.stockholdersEquity),
      serializeFactsSeries("SharesOutstanding", secSnapshot?.companyFacts?.sharesOutstanding)
    ])
  })

  docs.push({
    title: `${normalizedTicker}-peer-valuation`,
    evidenceType: "peer_valuation",
    text: asLines([
      `Ticker: ${normalizedTicker}`,
      `Relative valuation note: ${peerValuation?.relativeValuation || "Unavailable"}`,
      `Base trailing PE: ${safeNumber(peerValuation?.base?.trailingPE)}`,
      `Peer median trailing PE: ${safeNumber(peerValuation?.base?.peerMedianTrailingPE)}`,
      ...(Array.isArray(peerValuation?.peers)
        ? peerValuation.peers.map((peer) => asLines([
            `Peer: ${peer?.ticker || "UNKNOWN"}`,
            `- Company: ${peer?.companyName || "unknown"}`,
            `- Trailing PE: ${safeNumber(peer?.trailingPE)}`,
            `- Market Cap: ${safeNumber(peer?.marketCap)}`
          ]))
        : [])
    ])
  })

  const newsItems = Array.isArray(extractedNews) ? extractedNews.slice(0, 10) : []
  for (let index = 0; index < newsItems.length; index += 1) {
    const item = newsItems[index]
    docs.push({
      title: `${normalizedTicker}-news-${index + 1}`,
      evidenceType: "news_article",
      text: asLines([
        `Ticker: ${normalizedTicker}`,
        `Title: ${item?.title || "Untitled"}`,
        `Source: ${item?.source || "unknown"}`,
        `PublishedAt: ${item?.publishedAt || "unknown"}`,
        `Url: ${item?.url || "none"}`,
        `ExtractionStatus: ${item?.extractionStatus || "unknown"}`,
        `ComplianceReason: ${item?.complianceAudit?.reason || "unknown"}`,
        `Snippet: ${normalizeText(item?.snippet || "")}`,
        `Content: ${normalizeText(item?.content || "")}`
      ])
    })
  }

  return docs
    .map((doc) => ({
      ...doc,
      text: normalizeText(doc.text)
    }))
    .filter((doc) => doc.text.length > 0)
}

function getPortfolioEvidenceDocumentId(userId, ticker) {
  const owner = String(userId || "anon")
  const normalizedTicker = toUpperTicker(ticker)
  return `portfolio-evidence:${owner}:${normalizedTicker}`
}

export async function ingestPortfolioEvidenceChunks({
  userId,
  ticker,
  companyName,
  evidenceDocuments
}) {
  const documentId = getPortfolioEvidenceDocumentId(userId, ticker)
  const createdAt = new Date()
  const chunksToEmbed = []
  let chunkGlobalIndex = 0

  const sourceDocs = Array.isArray(evidenceDocuments) ? evidenceDocuments : []
  for (const doc of sourceDocs) {
    const header = asLines([
      `Ticker: ${toUpperTicker(ticker)}`,
      `Company: ${companyName || toUpperTicker(ticker)}`,
      `EvidenceType: ${doc.evidenceType || "unknown"}`,
      `Title: ${doc.title || "evidence"}`
    ])
    const fullText = `${header}\n${doc.text || ""}`.trim()
    const textChunks = chunkText(fullText, portfolioConfig.evidenceChunkSize, portfolioConfig.evidenceChunkOverlap)

    for (let i = 0; i < textChunks.length; i += 1) {
      if (chunksToEmbed.length >= portfolioConfig.evidenceMaxChunks) break
      chunksToEmbed.push({
        userId: userId || null,
        sessionId: null,
        documentId,
        filename: doc.title || "portfolio-evidence",
        sourceType: PORTFOLIO_EVIDENCE_SOURCE_TYPE,
        evidenceType: doc.evidenceType || "unknown",
        ticker: toUpperTicker(ticker),
        page: null,
        chunkIndex: chunkGlobalIndex++,
        text: textChunks[i],
        createdAt
      })
    }

    if (chunksToEmbed.length >= portfolioConfig.evidenceMaxChunks) break
  }

  await db.collection(CHUNKS_COLLECTION).deleteMany({
    userId: userId || null,
    documentId,
    sourceType: PORTFOLIO_EVIDENCE_SOURCE_TYPE
  })

  if (chunksToEmbed.length === 0) {
    return {
      documentId,
      indexedChunks: 0
    }
  }

  for (const chunkDoc of chunksToEmbed) {
    const embedding = await embedText(chunkDoc.text)
    chunkDoc.embedding = embedding
    chunkDoc.embeddingModel = "gemini-embedding-001"
  }

  await db.collection(CHUNKS_COLLECTION).insertMany(chunksToEmbed, { ordered: false })

  return {
    documentId,
    indexedChunks: chunksToEmbed.length
  }
}

function reciprocalRankFusion(vectorResults, textResults, limit) {
  const rankK = 60
  const scoreMap = new Map()
  const docMap = new Map()

  vectorResults.forEach((doc, index) => {
    const id = String(doc._id)
    scoreMap.set(id, (scoreMap.get(id) || 0) + 1 / (rankK + index + 1))
    docMap.set(id, doc)
  })

  textResults.forEach((doc, index) => {
    const id = String(doc._id)
    scoreMap.set(id, (scoreMap.get(id) || 0) + 1 / (rankK + index + 1))
    if (!docMap.has(id)) {
      docMap.set(id, doc)
    }
  })

  return [...scoreMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, fusionScore]) => ({
      ...docMap.get(id),
      fusionScore
    }))
}

async function runEvidenceVectorSearch(questionEmbedding, filter, limit) {
  const run = (vectorFilter, resultLimit = limit) => (
    db.collection(CHUNKS_COLLECTION).aggregate([
      {
        $vectorSearch: {
          index: VECTOR_INDEX_NAME,
          path: VECTOR_PATH,
          queryVector: questionEmbedding,
          numCandidates: Math.max(limit * 12, 100),
          limit: resultLimit,
          ...(vectorFilter ? { filter: vectorFilter } : {})
        }
      },
      {
        $project: {
          text: 1,
          filename: 1,
          chunkIndex: 1,
          evidenceType: 1,
          sourceType: 1,
          ticker: 1,
          documentId: 1,
          userId: 1,
          vectorScore: { $meta: "vectorSearchScore" }
        }
      }
    ]).toArray()
  )

  try {
    const filtered = await run(filter, limit)
    if (filtered.length > 0 || !filter) return filtered

    const fallback = await run(null, Math.max(limit * 8, 40))
    return fallback.filter((doc) => (
      doc.sourceType === filter.sourceType &&
      doc.documentId === filter.documentId &&
      doc.userId === filter.userId
    ))
  } catch {
    return []
  }
}

async function runEvidenceTextSearch(question, filter, limit) {
  const pipeline = [
    {
      $search: {
        index: TEXT_INDEX_NAME,
        text: {
          query: question,
          path: ["text", "filename", "sourceType", "evidenceType", "ticker"]
        }
      }
    },
    { $match: filter },
    {
      $project: {
        text: 1,
        filename: 1,
        chunkIndex: 1,
        evidenceType: 1,
        sourceType: 1,
        ticker: 1,
        documentId: 1,
        userId: 1,
        textScore: { $meta: "searchScore" }
      }
    },
    { $limit: limit }
  ]

  try {
    return await db.collection(CHUNKS_COLLECTION).aggregate(pipeline).toArray()
  } catch {
    return []
  }
}

export async function retrievePortfolioEvidenceChunks({
  userId,
  ticker,
  question,
  limit = portfolioConfig.evidenceRetrieveLimit
}) {
  const normalizedTicker = toUpperTicker(ticker)
  const documentId = getPortfolioEvidenceDocumentId(userId, normalizedTicker)
  const filter = {
    userId: userId || null,
    documentId,
    sourceType: PORTFOLIO_EVIDENCE_SOURCE_TYPE
  }

  const questionEmbedding = await embedText(question)
  const vectorResults = await runEvidenceVectorSearch(questionEmbedding, filter, limit)
  const textResults = await runEvidenceTextSearch(question, filter, limit)
  const fused = reciprocalRankFusion(vectorResults, textResults, limit)

  if (fused.length > 0) {
    return {
      documentId,
      chunks: fused
    }
  }

  const fallback = await db.collection(CHUNKS_COLLECTION)
    .find(filter)
    .sort({ createdAt: -1, chunkIndex: 1 })
    .limit(limit)
    .project({
      text: 1,
      filename: 1,
      chunkIndex: 1,
      evidenceType: 1,
      sourceType: 1,
      ticker: 1
    })
    .toArray()

  return {
    documentId,
    chunks: fallback
  }
}
