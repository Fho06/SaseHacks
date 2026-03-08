function getNumberEnv(name, defaultValue) {
  const raw = process.env[name]
  if (!raw) return defaultValue
  const parsed = Number(raw)
  return Number.isFinite(parsed) ? parsed : defaultValue
}

function getBooleanEnv(name, defaultValue) {
  const raw = String(process.env[name] || "").trim().toLowerCase()
  if (!raw) return defaultValue
  if (["1", "true", "yes", "on"].includes(raw)) return true
  if (["0", "false", "no", "off"].includes(raw)) return false
  return defaultValue
}

function isNonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0
}

const DEV_SEC_USER_AGENT = "FinVoiceCopilot-Dev/1.0 (dev-local@localhost)"

export function isProductionEnv() {
  return String(process.env.NODE_ENV || "").toLowerCase() === "production"
}

const secUserAgentRaw = process.env.SEC_USER_AGENT || ""
const secUserAgentForRequests = isNonEmpty(secUserAgentRaw) ? secUserAgentRaw : DEV_SEC_USER_AGENT
const fullTextAllowedDomains = String(process.env.PORTFOLIO_FULLTEXT_ALLOWED_DOMAINS || "")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter(Boolean)

export const portfolioConfig = {
  newsApiKey: process.env.NEWS_API_KEY || "",
  newsApiUrl: process.env.NEWS_API_URL || "",
  marketApiKey: process.env.MARKET_DATA_API_KEY || "",
  marketApiUrl: process.env.MARKET_DATA_API_URL || "",
  secUserAgent: secUserAgentRaw,
  secUserAgentForRequests,
  cacheTtlMs: getNumberEnv("PORTFOLIO_CACHE_TTL_MS", 1000 * 60 * 30),
  maxNewsItems: getNumberEnv("PORTFOLIO_NEWS_LIMIT", 10),
  redisUrl: process.env.REDIS_URL || "",
  upstashRedisUrl: process.env.UPSTASH_REDIS_REST_URL || "",
  upstashRedisToken: process.env.UPSTASH_REDIS_REST_TOKEN || "",
  maxSnippetChars: getNumberEnv("PORTFOLIO_MAX_SNIPPET_CHARS", 320),
  maxExtractedChars: getNumberEnv("PORTFOLIO_MAX_EXTRACTED_CHARS", 1800),
  robotsCacheTtlMs: getNumberEnv("PORTFOLIO_ROBOTS_CACHE_TTL_MS", 1000 * 60 * 60 * 6),
  sourceRateLimitWindowMs: getNumberEnv("PORTFOLIO_SOURCE_RATE_LIMIT_WINDOW_MS", 1000 * 60),
  sourceRateLimitMaxRequests: getNumberEnv("PORTFOLIO_SOURCE_RATE_LIMIT_MAX_REQUESTS", 8),
  fullTextAllowedDomains,
  evidenceChunkSize: getNumberEnv("PORTFOLIO_EVIDENCE_CHUNK_SIZE", 1400),
  evidenceChunkOverlap: getNumberEnv("PORTFOLIO_EVIDENCE_CHUNK_OVERLAP", 180),
  evidenceMaxChunks: getNumberEnv("PORTFOLIO_EVIDENCE_MAX_CHUNKS", 80),
  evidenceRetrieveLimit: getNumberEnv("PORTFOLIO_EVIDENCE_RETRIEVE_LIMIT", 14),
  robotsFailClosed: getBooleanEnv("PORTFOLIO_ROBOTS_FAIL_CLOSED", true)
}

export function getSecUserAgent() {
  return portfolioConfig.secUserAgentForRequests
}

export function hasNewsPrimaryProvider() {
  return isNonEmpty(portfolioConfig.newsApiUrl) && isNonEmpty(portfolioConfig.newsApiKey)
}

export function hasMarketPrimaryProvider() {
  return isNonEmpty(portfolioConfig.marketApiUrl) && isNonEmpty(portfolioConfig.marketApiKey)
}

export function hasRedisProvider() {
  if (isNonEmpty(portfolioConfig.redisUrl)) return true
  return isNonEmpty(portfolioConfig.upstashRedisUrl) && isNonEmpty(portfolioConfig.upstashRedisToken)
}

export function getPortfolioConfigWarnings() {
  const warnings = []
  if (!isNonEmpty(portfolioConfig.secUserAgent)) {
    warnings.push("SEC_USER_AGENT is not configured; using dev fallback user-agent.")
  }
  if (!hasNewsPrimaryProvider()) {
    warnings.push("NEWS_API_URL/NEWS_API_KEY missing; falling back to Google News RSS.")
  }
  if (!hasMarketPrimaryProvider()) {
    warnings.push("MARKET_DATA_API_URL/MARKET_DATA_API_KEY missing; falling back to Yahoo snapshot.")
  }
  if (!hasRedisProvider()) {
    warnings.push("Redis is not configured; falling back to in-memory TTL cache.")
  }
  if (!Array.isArray(portfolioConfig.fullTextAllowedDomains) || portfolioConfig.fullTextAllowedDomains.length === 0) {
    warnings.push("PORTFOLIO_FULLTEXT_ALLOWED_DOMAINS is empty; third-party full-text extraction is disabled.")
  }
  return warnings
}

export function validatePortfolioConfigAtStartup() {
  const warnings = getPortfolioConfigWarnings()
  if (isProductionEnv() && !isNonEmpty(portfolioConfig.secUserAgent)) {
    throw new Error("SEC_USER_AGENT is required in production.")
  }
  return warnings
}
