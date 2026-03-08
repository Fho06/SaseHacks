import test from "node:test"
import assert from "node:assert/strict"

async function loadConfigModule(envOverrides = {}) {
  const keys = [
    "NODE_ENV",
    "SEC_USER_AGENT",
    "NEWS_API_URL",
    "NEWS_API_KEY",
    "MARKET_DATA_API_URL",
    "MARKET_DATA_API_KEY",
    "REDIS_URL",
    "UPSTASH_REDIS_REST_URL",
    "UPSTASH_REDIS_REST_TOKEN"
  ]

  const previous = new Map(keys.map((key) => [key, process.env[key]]))
  for (const key of keys) {
    delete process.env[key]
  }
  for (const [key, value] of Object.entries(envOverrides)) {
    process.env[key] = value
  }

  try {
    const modulePath = new URL(`../portfolio/config.js?test=${Date.now()}-${Math.random()}`, import.meta.url)
    return await import(modulePath.href)
  } finally {
    for (const key of keys) {
      const value = previous.get(key)
      if (value === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = value
      }
    }
  }
}

test("portfolio config emits explicit provider fallback warnings", async () => {
  const configModule = await loadConfigModule({})
  const warnings = configModule.getPortfolioConfigWarnings()

  assert.ok(warnings.some((item) => item.includes("SEC_USER_AGENT")))
  assert.ok(warnings.some((item) => item.includes("NEWS_API_URL/NEWS_API_KEY")))
  assert.ok(warnings.some((item) => item.includes("MARKET_DATA_API_URL/MARKET_DATA_API_KEY")))
  assert.ok(warnings.some((item) => item.includes("Redis")))
})

test("portfolio config fails fast in production when SEC_USER_AGENT is missing", async () => {
  const configModule = await loadConfigModule({})
  const previousNodeEnv = process.env.NODE_ENV
  process.env.NODE_ENV = "production"

  try {
    assert.throws(() => configModule.validatePortfolioConfigAtStartup(), /SEC_USER_AGENT is required in production/)
  } finally {
    if (previousNodeEnv === undefined) {
      delete process.env.NODE_ENV
    } else {
      process.env.NODE_ENV = previousNodeEnv
    }
  }
})

test("portfolio config reports providers available when env vars are present", async () => {
  const configModule = await loadConfigModule({
    SEC_USER_AGENT: "FinVoice/1.0 (ops@example.com)",
    NEWS_API_URL: "https://gnews.io/api/v4/search",
    NEWS_API_KEY: "fake-news-key",
    MARKET_DATA_API_URL: "https://financialmodelingprep.com/api/v3",
    MARKET_DATA_API_KEY: "fake-market-key",
    REDIS_URL: "redis://localhost:6379"
  })

  assert.equal(configModule.hasNewsPrimaryProvider(), true)
  assert.equal(configModule.hasMarketPrimaryProvider(), true)
  assert.equal(configModule.hasRedisProvider(), true)
  assert.equal(configModule.getSecUserAgent(), "FinVoice/1.0 (ops@example.com)")
})
