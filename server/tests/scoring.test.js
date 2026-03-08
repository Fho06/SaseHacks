import test from "node:test"
import assert from "node:assert/strict"
import { computeAttributeScore, computeOverallScore, mapVerdict } from "../portfolio/scoring.js"

test("computeAttributeScore maps 1..5 to 0..100", () => {
  assert.equal(computeAttributeScore([1, 1, 1, 1]), 0)
  assert.equal(computeAttributeScore([5, 5, 5, 5]), 100)
  assert.equal(computeAttributeScore([3, 3, 3, 3]), 50)
  assert.equal(computeAttributeScore([null, undefined, "", 3]), 50)
})

test("computeOverallScore uses weighted deterministic formula", () => {
  const overall = computeOverallScore({
    growth: 80,
    financialHealth: 70,
    newsOutlook: 60,
    stockValue: 50
  })
  assert.equal(overall, 67)
})

test("mapVerdict matches requested score bands", () => {
  assert.equal(mapVerdict(90), "Strong Buy Candidate")
  assert.equal(mapVerdict(75), "Good Company, Worth Serious Consideration")
  assert.equal(mapVerdict(60), "Mixed, Needs More Research")
  assert.equal(mapVerdict(45), "Risky / Unclear")
  assert.equal(mapVerdict(20), "Avoid for Now")
})
