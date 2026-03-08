import express from "express"
import { db } from "../config/mongodb.js"
import { analyzePortfolioCompany } from "./analyzer.js"
import {
  COMPANY_PROFILES_COLLECTION,
  NEWS_ARTICLES_COLLECTION,
  COMPANY_SNAPSHOTS_COLLECTION,
  PORTFOLIO_ANALYSES_COLLECTION,
  PORTFOLIO_JOBS_COLLECTION,
  PORTFOLIO_SOURCE_AUDIT_COLLECTION
} from "./collections.js"
import { getPortfolioConfigWarnings } from "./config.js"
import { validateAnalyzeInput } from "./validation.js"

const router = express.Router()

function normalizePortfolioError(error) {
  const message = error instanceof Error ? error.message : "Portfolio analysis failed"
  if (/unexpected token\s*'<|doctype|not valid json/i.test(message)) {
    return "A portfolio data provider returned an invalid response. Verify NEWS_API_* and MARKET_DATA_* settings."
  }
  return message
}

router.post("/analyze", async (req, res) => {
  try {
    const validation = validateAnalyzeInput(req.body)
    if (!validation.ok) {
      return res.status(400).json({ error: validation.error })
    }
    const query = validation.query

    const userId = req.auth?.userId
    const startedAt = new Date()
    const jobRecord = await db.collection(PORTFOLIO_JOBS_COLLECTION).insertOne({
      userId,
      query,
      status: "running",
      startedAt
    })

    const analysis = await analyzePortfolioCompany({ userId, query })

    await db.collection(PORTFOLIO_ANALYSES_COLLECTION).insertOne({
      userId,
      ticker: analysis.ticker,
      companyName: analysis.companyName,
      analysis,
      createdAt: new Date()
    })

    await db.collection(COMPANY_PROFILES_COLLECTION).updateOne(
      { ticker: analysis.ticker },
      {
        $set: {
          ticker: analysis.ticker,
          companyName: analysis.companyName,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    )

    await db.collection(COMPANY_SNAPSHOTS_COLLECTION).updateOne(
      { ticker: analysis.ticker, userId },
      {
        $set: {
          ticker: analysis.ticker,
          userId,
          sources: analysis.sources,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    )

    const articleWrites = analysis.sources.news.map((item) => ({
      updateOne: {
        filter: { ticker: analysis.ticker, url: item.url },
        update: {
          $set: {
            ticker: analysis.ticker,
            userId,
            ...item,
            updatedAt: new Date()
          }
        },
        upsert: true
      }
    }))

    if (articleWrites.length > 0) {
      await db.collection(NEWS_ARTICLES_COLLECTION).bulkWrite(articleWrites, { ordered: false })
    }

    const extractionAudits = Array.isArray(analysis?.sources?.compliance?.extractionAudits)
      ? analysis.sources.compliance.extractionAudits
      : []

    if (extractionAudits.length > 0) {
      const now = new Date()
      const auditDocs = extractionAudits.map((entry) => ({
        userId,
        ticker: analysis.ticker,
        companyName: analysis.companyName,
        query,
        createdAt: now,
        ...entry
      }))
      await db.collection(PORTFOLIO_SOURCE_AUDIT_COLLECTION).insertMany(auditDocs, { ordered: false })
    }

    await db.collection(PORTFOLIO_JOBS_COLLECTION).updateOne(
      { _id: jobRecord.insertedId },
      {
        $set: {
          status: "completed",
          ticker: analysis.ticker,
          finishedAt: new Date()
        }
      }
    )

    res.json({
      ...analysis,
      warnings: getPortfolioConfigWarnings(),
      disclaimer: "This analysis is informational only and not personalized financial advice."
    })
  } catch (error) {
    const message = normalizePortfolioError(error)
    await db.collection(PORTFOLIO_JOBS_COLLECTION).insertOne({
      userId: req.auth?.userId,
      query: String(req.body?.query || ""),
      status: "failed",
      error: message,
      finishedAt: new Date()
    })
    res.status(500).json({
      error: message
    })
  }
})

router.get("/analysis/:ticker", async (req, res) => {
  const ticker = String(req.params?.ticker || "").toUpperCase()
  const userId = req.auth?.userId
  if (!ticker) return res.status(400).json({ error: "ticker is required" })

  const latest = await db.collection(PORTFOLIO_ANALYSES_COLLECTION).findOne(
    { ticker, userId },
    { sort: { createdAt: -1 } }
  )

  if (!latest) {
    return res.status(404).json({ error: "No analysis found for this ticker." })
  }

  res.json(latest.analysis)
})

router.get("/news/:ticker", async (req, res) => {
  const ticker = String(req.params?.ticker || "").toUpperCase()
  const userId = req.auth?.userId
  if (!ticker) return res.status(400).json({ error: "ticker is required" })

  const articles = await db.collection(NEWS_ARTICLES_COLLECTION)
    .find({ ticker, userId })
    .sort({ publishedAt: -1, updatedAt: -1 })
    .limit(10)
    .toArray()

  res.json({ ticker, items: articles })
})

router.get("/history", async (req, res) => {
  const userId = req.auth?.userId
  const history = await db.collection(PORTFOLIO_ANALYSES_COLLECTION)
    .find({ userId })
    .project({
      ticker: 1,
      companyName: 1,
      createdAt: 1,
      "analysis.overallAssessment": 1,
      "analysis.verdict": 1
    })
    .sort({ createdAt: -1 })
    .limit(25)
    .toArray()

  res.json({ items: history })
})

export default router
