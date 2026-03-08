import { getSecUserAgent, hasNewsPrimaryProvider, portfolioConfig } from "./config.js"
import { cacheWrap } from "./cache.js"
import { trimSnippet } from "./source-compliance.js"

const GOOGLE_NEWS_RSS_URL = "https://news.google.com/rss/search"
const REPUTABLE_SOURCE_HINTS = [
  "reuters",
  "bloomberg",
  "wsj",
  "wall street journal",
  "financial times",
  "cnbc",
  "marketwatch",
  "yahoo finance",
  "associated press",
  "ap news",
  "the information",
  "investor's business daily"
]

function normalizeText(value) {
  return String(value || "").toLowerCase()
}

function getHostFromUrl(rawUrl) {
  try {
    return new URL(rawUrl).hostname.toLowerCase()
  } catch {
    return ""
  }
}

function reputationScore(article) {
  const source = normalizeText(article.source)
  const host = normalizeText(getHostFromUrl(article.url))
  const joined = `${source} ${host}`
  if (REPUTABLE_SOURCE_HINTS.some((hint) => joined.includes(hint))) return 1
  return 0.45
}

function relevanceScore(article, ticker, companyName) {
  const title = normalizeText(article.title)
  const snippet = normalizeText(article.snippet)
  const tickerLower = normalizeText(ticker)
  const companyLower = normalizeText(companyName)
  const joined = `${title} ${snippet}`

  let score = 0
  if (title.includes(tickerLower)) score += 0.45
  if (title.includes(companyLower)) score += 0.35
  if (snippet.includes(tickerLower)) score += 0.1
  if (snippet.includes(companyLower)) score += 0.1
  return Math.min(1, score)
}

function recencyScore(article) {
  const date = article.publishedAt ? new Date(article.publishedAt) : null
  if (!date || Number.isNaN(date.getTime())) return 0.1
  const ageHours = (Date.now() - date.getTime()) / (1000 * 60 * 60)
  if (ageHours <= 24) return 1
  if (ageHours <= 72) return 0.8
  if (ageHours <= 24 * 7) return 0.6
  if (ageHours <= 24 * 14) return 0.4
  if (ageHours <= 24 * 30) return 0.2
  return 0.1
}

function dedupeArticles(items) {
  const seen = new Set()
  const deduped = []

  for (const item of items) {
    const normalizedTitle = normalizeText(item.title).replace(/[^a-z0-9]/g, "")
    const host = getHostFromUrl(item.url)
    const key = `${normalizedTitle}|${host}`
    if (!normalizedTitle || seen.has(key)) continue
    seen.add(key)
    deduped.push(item)
  }

  return deduped
}

function rankArticles(items, { ticker, companyName }) {
  return items
    .map((item) => {
      const relevance = relevanceScore(item, ticker, companyName)
      const recency = recencyScore(item)
      const reputation = reputationScore(item)
      const score = relevance * 0.5 + recency * 0.3 + reputation * 0.2
      return {
        ...item,
        relevanceScore: relevance,
        recencyScore: recency,
        reputationScore: reputation,
        rankScore: score
      }
    })
    .filter((item) => item.relevanceScore >= 0.25)
    .sort((a, b) => b.rankScore - a.rankScore)
}

function buildGNewsUrl({ ticker, companyName }) {
  const url = new URL(portfolioConfig.newsApiUrl)
  url.searchParams.set("q", `"${ticker}" OR "${companyName}"`)
  url.searchParams.set("max", "30")
  url.searchParams.set("lang", "en")
  url.searchParams.set("country", "us")
  url.searchParams.set("sortby", "publishedAt")

  if (!url.searchParams.has("apikey") && !url.searchParams.has("token")) {
    url.searchParams.set("apikey", portfolioConfig.newsApiKey)
  }

  return url.toString()
}

async function discoverFromGNews({ ticker, companyName }) {
  if (!hasNewsPrimaryProvider()) {
    return []
  }

  try {
    const url = buildGNewsUrl({ ticker, companyName })
    const response = await fetch(url, {
      headers: {
        "User-Agent": getSecUserAgent()
      }
    })
    if (!response.ok) return []

    const payload = await response.json()
    const articles = Array.isArray(payload?.articles) ? payload.articles : []

    return articles.map((item, index) => ({
      articleId: item.id || `${ticker}-gnews-${Date.now()}-${index}`,
      title: item.title || "Untitled",
      url: item.url || "",
      source: item.source?.name || item.source || "unknown",
      publishedAt: item.publishedAt || null,
      snippet: trimSnippet(item.description || item.content || ""),
      provider: "gnews"
    }))
  } catch {
    return []
  }
}

function parseRssItems(xml) {
  const items = []
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi
  let match = itemRegex.exec(xml)
  while (match) {
    const block = match[1]
    const title = (block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim()
    const link = (block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || "").trim()
    const pubDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || "").trim()
    const source = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] || "Google News").replace(/<!\[CDATA\[|\]\]>/g, "").trim()
    const description = (block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || "").replace(/<!\[CDATA\[|\]\]>/g, "").trim()
    items.push({
      title,
      url: link,
      source,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : null,
      snippet: trimSnippet(description)
    })
    match = itemRegex.exec(xml)
  }
  return items
}

async function discoverFromGoogleNews({ ticker, companyName }) {
  try {
    const query = encodeURIComponent(`${ticker} ${companyName} stock earnings`)
    const url = `${GOOGLE_NEWS_RSS_URL}?q=${query}&hl=en-US&gl=US&ceid=US:en`
    const response = await fetch(url, {
      headers: {
        "User-Agent": getSecUserAgent()
      }
    })
    if (!response.ok) return []

    const xml = await response.text()
    const items = parseRssItems(xml)
    return items.map((item, index) => ({
      articleId: `${ticker}-gnews-${Date.now()}-${index}`,
      ...item,
      provider: "google_news_rss"
    }))
  } catch {
    return []
  }
}

export async function discoverNewsArticles({ ticker, companyName }) {
  const normalizedTicker = String(ticker).toUpperCase()
  const cacheKey = `news:${normalizedTicker}`
  return cacheWrap(cacheKey, portfolioConfig.cacheTtlMs, async () => {
    const primary = await discoverFromGNews({ ticker: normalizedTicker, companyName })
    const fallback = primary.length >= portfolioConfig.maxNewsItems
      ? []
      : await discoverFromGoogleNews({ ticker: normalizedTicker, companyName })

    const merged = [...primary, ...fallback].filter((item) => item.url && item.title)
    const deduped = dedupeArticles(merged)
    const ranked = rankArticles(deduped, { ticker: normalizedTicker, companyName })
    return ranked.slice(0, portfolioConfig.maxNewsItems)
  })
}
