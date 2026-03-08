export const SCORE_BANDS = [
  { min: 85, verdict: "Strong Buy Candidate" },
  { min: 70, verdict: "Good Company, Worth Serious Consideration" },
  { min: 55, verdict: "Mixed, Needs More Research" },
  { min: 40, verdict: "Risky / Unclear" },
  { min: 0, verdict: "Avoid for Now" }
]

export function clampQuestionScore(value) {
  if (value === null || value === undefined) return 3
  if (typeof value === "string" && value.trim() === "") return 3
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return 3
  return Math.max(1, Math.min(5, Math.round(parsed)))
}

export function computeAttributeScore(questionScores) {
  const safeScores = questionScores.map(clampQuestionScore)
  const avg = safeScores.reduce((sum, value) => sum + value, 0) / safeScores.length
  return Math.round(((avg - 1) / 4) * 100)
}

export function computeOverallScore({ growth, financialHealth, newsOutlook, stockValue }) {
  return Math.round(
    growth * 0.3 +
    financialHealth * 0.3 +
    newsOutlook * 0.2 +
    stockValue * 0.2
  )
}

export function mapVerdict(overall) {
  for (const band of SCORE_BANDS) {
    if (overall >= band.min) return band.verdict
  }
  return "Avoid for Now"
}
