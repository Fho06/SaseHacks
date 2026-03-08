import { useEffect, useState, type FormEvent } from "react"
import { ArrowLeft, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { analyzePortfolio, getPortfolioHistory, type PortfolioAnalysisResponse, type PortfolioAttribute } from "@/lib/portfolio-api"

type PortfolioAnalysisTabProps = {
  onBack: () => void
}

type HistoryItem = {
  _id?: string
  ticker?: string
  companyName?: string
  createdAt?: string
  analysis?: {
    overallAssessment?: number
    verdict?: string
  }
}

function scoreTone(score: number) {
  if (score >= 80) return "text-emerald-400"
  if (score >= 60) return "text-amber-300"
  return "text-rose-400"
}

function AttributeCard({ label, data }: { label: string; data: PortfolioAttribute }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card/30 p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${scoreTone(data.score)}`}>{data.score}/100</p>
      <p className="mt-2 text-sm text-muted-foreground">{data.explanation}</p>
    </div>
  )
}

function QuestionBreakdown({ title, data }: { title: string; data: PortfolioAttribute }) {
  return (
    <section className="rounded-xl border border-border/60 bg-card/20 p-4">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <p className="mb-3 text-sm text-muted-foreground">{data.explanation}</p>
      <div className="space-y-2">
        {data.questions.map((item) => (
          <div key={item.question} className="rounded-lg border border-border/50 bg-background/40 p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm">{item.question}</p>
              <p className={`shrink-0 text-sm font-semibold ${scoreTone(Math.round((item.score / 5) * 100))}`}>
                {item.score}/5
              </p>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{item.explanation}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function SourceList({ analysis }: { analysis: PortfolioAnalysisResponse }) {
  const annual = analysis.sources.filings.annualReport
  const quarterly = analysis.sources.filings.quarterlyReport
  const stockValueEvidence = analysis.sources.valuation?.stockValueEvidence

  return (
    <section className="rounded-xl border border-border/60 bg-card/20 p-4">
      <p className="mb-2 text-sm font-semibold">Sources Used</p>
      <p className="mb-3 text-xs text-muted-foreground">Top news items and latest filing references used for this assessment.</p>
      <div className="space-y-2">
        {(analysis.sources.news || []).slice(0, 10).map((item, index) => (
          <div key={`${item.url}-${index}`} className="rounded-lg border border-border/50 bg-background/40 p-3 text-sm">
            <p className="font-medium">{index + 1}. {item.title}</p>
            <p className="text-xs text-muted-foreground">{item.source} {item.publishedAt ? `| ${new Date(item.publishedAt).toLocaleDateString()}` : ""}</p>
            {item.url ? (
              <a href={item.url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                {item.url}
              </a>
            ) : null}
          </div>
        ))}
      </div>
      <div className="mt-4 space-y-1 text-xs text-muted-foreground">
        <p>
          Annual report: {annual ? `${annual.form || "10-K"} (${annual.filingDate || "unknown"})` : "Unavailable"}
          {annual?.url ? (
            <>
              {" "}
              <a href={annual.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                open
              </a>
            </>
          ) : null}
        </p>
        <p>
          Quarterly report: {quarterly ? `${quarterly.form || "10-Q"} (${quarterly.filingDate || "unknown"})` : "Unavailable"}
          {quarterly?.url ? (
            <>
              {" "}
              <a href={quarterly.url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                open
              </a>
            </>
          ) : null}
        </p>
      </div>
      <div className="mt-4 rounded-lg border border-border/50 bg-background/40 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Stock Value Evidence</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {stockValueEvidence?.summary || "No stock value evidence summary available."}
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          Confidence: {stockValueEvidence?.confidence || "low"}
        </p>
        <div className="mt-2 space-y-2">
          {(stockValueEvidence?.entries || []).map((entry, index) => (
            <div key={`${entry.provider}-${entry.kind}-${index}`} className="rounded-md border border-border/50 bg-background/50 p-2">
              <p className="text-xs font-medium">{entry.label}</p>
              <p className="text-[11px] text-muted-foreground">Provider: {entry.provider}</p>
              {entry.url ? (
                <a href={entry.url} target="_blank" rel="noreferrer" className="text-[11px] text-primary hover:underline">
                  {entry.url}
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default function PortfolioAnalysisTab({ onBack }: PortfolioAnalysisTabProps) {
  const [query, setQuery] = useState("")
  const [analysis, setAnalysis] = useState<PortfolioAnalysisResponse | null>(null)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadHistory() {
      try {
        const payload = await getPortfolioHistory()
        const items = Array.isArray(payload?.items) ? payload.items : []
        setHistory(items)
      } catch {
        setHistory([])
      }
    }

    void loadHistory()
  }, [])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!query.trim() || isLoading) return

    setIsLoading(true)
    setError(null)

    try {
      const result = await analyzePortfolio(query.trim())
      setAnalysis(result)
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Analysis request failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
              Back to Document Analysis
            </Button>
            <div>
              <p className="text-sm font-semibold">Stock Analysis</p>
              <p className="text-xs text-muted-foreground">Informational stock assessment tool</p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="mx-auto max-w-6xl space-y-6">
          <form onSubmit={handleSubmit} className="rounded-xl border border-border/60 bg-card/40 p-4">
            <p className="mb-2 text-sm font-medium">Analyze a public company by ticker or name</p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Example: AAPL or Microsoft"
                className="h-11 flex-1 rounded-md border border-border bg-background/50 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <Button type="submit" disabled={isLoading || !query.trim()}>
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Analyze Stock"}
              </Button>
            </div>
            {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
            <p className="mt-3 text-xs text-muted-foreground">
              Disclaimer: This assessment is informational and not personalized financial advice.
            </p>
          </form>

          {analysis ? (
            <div className="space-y-6">
              <section className="rounded-xl border border-border/60 bg-card/30 p-5">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Company Name</p>
                <p className="text-2xl font-semibold">{analysis.companyName} ({analysis.ticker})</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-border/50 bg-background/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Overall Assessment</p>
                    <p className={`mt-1 text-4xl font-bold ${scoreTone(analysis.overallAssessment)}`}>
                      {analysis.overallAssessment}/100
                    </p>
                  </div>
                  <div className="rounded-lg border border-border/50 bg-background/40 p-4">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Verdict</p>
                    <p className="mt-1 text-lg font-semibold">{analysis.verdict}</p>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <AttributeCard label="Growth" data={analysis.growth} />
                <AttributeCard label="Financial Health" data={analysis.financialHealth} />
                <AttributeCard label="News Outlook" data={analysis.newsOutlook} />
                <AttributeCard label="Stock Value" data={analysis.stockValue} />
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <QuestionBreakdown title="Growth Breakdown" data={analysis.growth} />
                <QuestionBreakdown title="Financial Health Breakdown" data={analysis.financialHealth} />
                <QuestionBreakdown title="News Outlook Breakdown" data={analysis.newsOutlook} />
                <QuestionBreakdown title="Stock Value Breakdown" data={analysis.stockValue} />
              </section>

              <section className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border/60 bg-card/20 p-4">
                  <p className="mb-2 text-sm font-semibold">Top 3 Positives</p>
                  <ul className="space-y-2 text-sm">
                    {analysis.positives.slice(0, 3).map((item, index) => (
                      <li key={`${item}-${index}`} className="rounded-md border border-border/50 bg-background/40 p-2">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-border/60 bg-card/20 p-4">
                  <p className="mb-2 text-sm font-semibold">Top 3 Risks</p>
                  <ul className="space-y-2 text-sm">
                    {analysis.risks.slice(0, 3).map((item, index) => (
                      <li key={`${item}-${index}`} className="rounded-md border border-border/50 bg-background/40 p-2">
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>

              <section className="rounded-xl border border-border/60 bg-card/20 p-4">
                <p className="text-sm font-semibold">Business vs Stock Distinction</p>
                <p className="mt-2 text-sm text-muted-foreground">{analysis.businessVsStockNote}</p>
                <p className="mt-4 text-sm font-semibold">Bottom Line</p>
                <p className="mt-2 text-sm">{analysis.bottomLine}</p>
              </section>

              <SourceList analysis={analysis} />

              <p className="rounded-lg border border-border/60 bg-card/20 p-3 text-xs text-muted-foreground">
                Disclaimer: This output is an informational stock assessment tool and not personalized financial advice.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-card/20 p-4">
                <p className="text-sm font-semibold">What this tab provides</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Company-level scoring across Growth, Financial Health, News Outlook, and Stock Value using dedicated stock analysis endpoints.
                </p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/20 p-4">
                <p className="text-sm font-semibold">Recent analyses</p>
                {history.length === 0 ? (
                  <p className="mt-2 text-sm text-muted-foreground">No saved analyses yet.</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-sm">
                    {history.slice(0, 8).map((item, index) => (
                      <li key={`${item.ticker || "ticker"}-${index}`}>
                        {(item.companyName || "Unknown Company")} ({item.ticker || "N/A"})
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
