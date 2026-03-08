import test from "node:test"
import assert from "node:assert/strict"
import { validateAnalyzeInput, ensureAnalysisPayload } from "../portfolio/validation.js"

test("validateAnalyzeInput requires query", () => {
  const invalid = validateAnalyzeInput({ query: "   " })
  assert.equal(invalid.ok, false)
})

test("ensureAnalysisPayload normalizes required fields and top 3 lists", () => {
  const payload = ensureAnalysisPayload({
    ticker: "aapl",
    positives: ["A"],
    risks: [],
    growth: { questions: [] },
    financialHealth: { questions: [] },
    newsOutlook: { questions: [] },
    stockValue: { questions: [] }
  })

  assert.equal(payload.ticker, "AAPL")
  assert.equal(payload.positives.length, 3)
  assert.equal(payload.risks.length, 3)
  assert.equal(payload.growth.questions.length, 4)
  assert.equal(payload.financialHealth.questions.length, 4)
  assert.equal(payload.newsOutlook.questions.length, 4)
  assert.equal(payload.stockValue.questions.length, 4)
})

