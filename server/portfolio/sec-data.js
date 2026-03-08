import { getSecUserAgent, portfolioConfig } from "./config.js"
import { cacheWrap } from "./cache.js"
import { getCompanyByTicker } from "./company-resolver.js"

function formatCik(cik) {
  const numeric = String(Number(cik || 0))
  return numeric.padStart(10, "0")
}

function secDocUrl(cik, accessionNumber, primaryDocument) {
  if (!cik || !accessionNumber || !primaryDocument) return null
  const cikNoLeading = String(Number(cik))
  const accessionNoDash = String(accessionNumber).replace(/-/g, "")
  return `https://www.sec.gov/Archives/edgar/data/${cikNoLeading}/${accessionNoDash}/${primaryDocument}`
}

function pickLatestFiling(submissions, formName) {
  const recent = submissions?.filings?.recent
  if (!recent) return null
  const forms = Array.isArray(recent.form) ? recent.form : []
  const index = forms.findIndex((form) => form === formName)
  if (index < 0) return null

  return {
    form: formName,
    filingDate: recent.filingDate?.[index] || null,
    reportDate: recent.reportDate?.[index] || null,
    accessionNumber: recent.accessionNumber?.[index] || null,
    primaryDocument: recent.primaryDocument?.[index] || null
  }
}

function selectFactSeriesFromTaxonomy(companyFacts, taxonomyName, tags, unitCandidates, limit = 8) {
  const factRoot = companyFacts?.facts?.[taxonomyName]
  if (!factRoot || typeof factRoot !== "object") return []

  const possibleTags = Array.isArray(tags) ? tags : [tags]
  const unitsToTry = Array.isArray(unitCandidates) ? unitCandidates : [unitCandidates]

  let series = []
  let newestTimestamp = -1
  for (const tag of possibleTags) {
    const units = factRoot?.[tag]?.units
    if (!units || typeof units !== "object") continue

    let candidateSeries = []
    for (const unitName of unitsToTry) {
      const candidate = units?.[unitName]
      if (Array.isArray(candidate) && candidate.length > 0) {
        candidateSeries = candidate
        break
      }
    }

    if (!Array.isArray(candidateSeries) || candidateSeries.length === 0) continue
    const localNewest = candidateSeries.reduce((max, item) => {
      const ts = new Date(item?.end || item?.filed || 0).getTime()
      return Number.isFinite(ts) && ts > max ? ts : max
    }, -1)
    if (localNewest > newestTimestamp) {
      newestTimestamp = localNewest
      series = candidateSeries
    }
  }

  if (!Array.isArray(series)) return []

  return series
    .filter((item) => Number.isFinite(Number(item?.val)))
    .sort((a, b) => {
      const aDate = new Date(a?.end || a?.filed || 0).getTime()
      const bDate = new Date(b?.end || b?.filed || 0).getTime()
      return bDate - aDate
    })
    .slice(0, limit)
    .map((item) => ({
      value: Number(item.val),
      end: item.end || null,
      filed: item.filed || null,
      form: item.form || null,
      fp: item.fp || null,
      fy: item.fy || null
    }))
}

function selectUsdFacts(companyFacts, tags, limit = 8) {
  return selectFactSeriesFromTaxonomy(companyFacts, "us-gaap", tags, ["USD", "usd"], limit)
}

function selectShareFacts(companyFacts, tags, limit = 8) {
  return [
    ...selectFactSeriesFromTaxonomy(companyFacts, "dei", tags, ["shares", "Shares"], limit),
    ...selectFactSeriesFromTaxonomy(companyFacts, "us-gaap", tags, ["shares", "Shares"], limit)
  ]
    .sort((a, b) => new Date(b?.end || b?.filed || 0).getTime() - new Date(a?.end || a?.filed || 0).getTime())
    .slice(0, limit)
}

export async function fetchSecSnapshot({ ticker }) {
  const cacheKey = `sec:${String(ticker).toUpperCase()}`
  return cacheWrap(cacheKey, portfolioConfig.cacheTtlMs, async () => {
    const company = await getCompanyByTicker(ticker)
    if (!company?.cik) {
      return {
        ticker,
        cik: null,
        annualReport: null,
        quarterlyReport: null,
        guidance: [],
        filingNotes: [],
        companyFacts: {
          revenue: [],
          netIncome: [],
          operatingCashFlow: [],
          longTermDebt: [],
          cashAndEquivalents: [],
          stockholdersEquity: [],
          sharesOutstanding: []
        }
      }
    }

    const cik = formatCik(company.cik)
    const [submissionsResponse, factsResponse] = await Promise.all([
      fetch(`https://data.sec.gov/submissions/CIK${cik}.json`, {
        headers: { "User-Agent": getSecUserAgent() }
      }),
      fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${cik}.json`, {
        headers: { "User-Agent": getSecUserAgent() }
      })
    ])

    const submissions = submissionsResponse.ok ? await submissionsResponse.json() : null
    const companyFacts = factsResponse.ok ? await factsResponse.json() : null

    const annual = pickLatestFiling(submissions, "10-K")
    const quarterly = pickLatestFiling(submissions, "10-Q")
    const latestEightK = pickLatestFiling(submissions, "8-K")

    const annualReport = annual
      ? {
          ...annual,
          url: secDocUrl(cik, annual.accessionNumber, annual.primaryDocument)
        }
      : null

    const quarterlyReport = quarterly
      ? {
          ...quarterly,
          url: secDocUrl(cik, quarterly.accessionNumber, quarterly.primaryDocument)
        }
      : null

    const guidance = latestEightK
      ? [`Recent 8-K filed on ${latestEightK.filingDate || "unknown date"} may contain business updates.`]
      : []

    return {
      ticker: String(ticker).toUpperCase(),
      cik,
      annualReport,
      quarterlyReport,
      guidance,
      filingNotes: [
        annualReport ? `Latest annual filing: ${annualReport.filingDate || "unknown"} (${annualReport.form})` : "Annual filing not found",
        quarterlyReport ? `Latest quarterly filing: ${quarterlyReport.filingDate || "unknown"} (${quarterlyReport.form})` : "Quarterly filing not found"
      ],
      companyFacts: {
        revenue: selectUsdFacts(companyFacts, ["Revenues", "RevenueFromContractWithCustomerExcludingAssessedTax"]),
        netIncome: selectUsdFacts(companyFacts, "NetIncomeLoss"),
        operatingCashFlow: selectUsdFacts(companyFacts, "NetCashProvidedByUsedInOperatingActivities"),
        longTermDebt: selectUsdFacts(companyFacts, ["LongTermDebt", "LongTermDebtNoncurrent"]),
        cashAndEquivalents: selectUsdFacts(companyFacts, "CashAndCashEquivalentsAtCarryingValue"),
        stockholdersEquity: selectUsdFacts(companyFacts, ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"]),
        sharesOutstanding: selectShareFacts(companyFacts, ["EntityCommonStockSharesOutstanding", "CommonStockSharesOutstanding"])
      }
    }
  })
}
