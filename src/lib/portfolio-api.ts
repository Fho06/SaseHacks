import { getAuthHeader } from "@/lib/api-auth"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5050"

export type PortfolioQuestion = {
  question: string
  score: number
  explanation: string
}

export type PortfolioAttribute = {
  score: number
  explanation: string
  questions: PortfolioQuestion[]
}

export type StockValueEvidenceEntry = {
  provider: string
  kind: string
  label: string
  url?: string | null
  details?: unknown
  metrics?: Record<string, unknown> | null
  peerCount?: number
}

export type StockValueEvidence = {
  ticker: string
  confidence: "low" | "medium" | "high"
  coverage: {
    hasPrice: boolean
    hasMultiples: boolean
    hasRange: boolean
    hasMomentum?: boolean
    hasPeers: boolean
    hasMarketCap?: boolean
    hasEnterpriseValue?: boolean
    hasCashFlowYield?: boolean
  }
  summary: string
  entries: StockValueEvidenceEntry[]
}

export type PortfolioAnalysisResponse = {
  companyName: string
  ticker: string
  generatedAt: string
  overallAssessment: number
  verdict: string
  growth: PortfolioAttribute
  financialHealth: PortfolioAttribute
  newsOutlook: PortfolioAttribute
  stockValue: PortfolioAttribute
  positives: string[]
  risks: string[]
  businessVsStockNote: string
  bottomLine: string
  companySnapshot?: {
    annualReport?: { form?: string; filingDate?: string; url?: string | null } | null
    quarterlyReport?: { form?: string; filingDate?: string; url?: string | null } | null
    revenueTrendSummary?: string
    profitTrendSummary?: string
    cashFlowSummary?: string
    debtLiquiditySummary?: string
    managementGuidanceUpdates?: string[]
    valuationSnapshot?: Record<string, unknown>
  }
  sources: {
    news: Array<{
      title: string
      source: string
      url: string
      publishedAt?: string | null
      snippet?: string
      provider?: string
      rankScore?: number | null
    }>
    filings: {
      annualReport?: {
        form?: string | null
        filingDate?: string | null
        url?: string | null
      } | null
      quarterlyReport?: {
        form?: string | null
        filingDate?: string | null
        url?: string | null
      } | null
    }
    valuation?: {
      currentPrice?: number | null
      trailingPE?: number | null
      forwardPE?: number | null
      priceToBook?: number | null
      priceToSales?: number | null
      week52Low?: number | null
      week52High?: number | null
      marketCap?: number | null
      peerComparison?: string
      marketProvider?: string
      stockValueEvidence?: StockValueEvidence
      [key: string]: unknown
    }
  }
  disclaimer?: string
  warnings?: string[]
}

export type PortfolioHistoryItem = {
  _id?: string
  ticker?: string
  companyName?: string
  createdAt?: string
  analysis?: {
    overallAssessment?: number
    verdict?: string
  }
}

export type PortfolioHistoryResponse = {
  items: PortfolioHistoryItem[]
}

async function parseApiPayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type")?.toLowerCase() || ""
  if (contentType.includes("application/json")) {
    return response.json()
  }
  const text = await response.text()
  return { error: text || `Unexpected non-JSON response (${response.status})` }
}

function normalizePortfolioApiError(payload: unknown, fallback: string): string {
  const rawError = typeof (payload as { error?: unknown })?.error === "string"
    ? (payload as { error: string }).error
    : fallback

  if (/cannot post\s+\/portfolio\/analyze/i.test(rawError)) {
    return "Portfolio API route not found on current backend. Start the Express API from the server folder on port 5050."
  }

  if (/missing auth token|invalid auth token|unauthorized/i.test(rawError)) {
    return "You must sign in again with Google before running stock analysis."
  }

  return rawError
}

export async function analyzePortfolio(query: string): Promise<PortfolioAnalysisResponse> {
  const response = await fetch(`${API_BASE_URL}/portfolio/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(await getAuthHeader())
    },
    body: JSON.stringify({ query })
  })

  const payload = await parseApiPayload(response)
  if (!response.ok) {
    throw new Error(normalizePortfolioApiError(payload, "Portfolio analysis failed"))
  }

  return payload as PortfolioAnalysisResponse
}

export async function getPortfolioHistory(): Promise<PortfolioHistoryResponse> {
  const response = await fetch(`${API_BASE_URL}/portfolio/history`, {
    method: "GET",
    headers: {
      ...(await getAuthHeader())
    }
  })

  const payload = await parseApiPayload(response)
  if (!response.ok) {
    throw new Error(normalizePortfolioApiError(payload, "Failed to load portfolio history"))
  }

  return payload as PortfolioHistoryResponse
}
