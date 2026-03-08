import test from "node:test"
import assert from "node:assert/strict"
import {
  evaluateSourceCompliance,
  resetSourceComplianceStateForTests,
  trimSnippet
} from "../portfolio/source-compliance.js"
import { portfolioConfig } from "../portfolio/config.js"

test("evaluateSourceCompliance blocks unlicensed domains for full-text extraction", async () => {
  resetSourceComplianceStateForTests()
  const result = await evaluateSourceCompliance("https://example.com/news-item", {
    fullTextAllowedDomains: ["licensed.com"]
  })

  assert.equal(result.decision, "snippet_only")
  assert.equal(result.reason, "unlicensed_domain")
})

test("evaluateSourceCompliance enforces robots disallow before crawling", async () => {
  resetSourceComplianceStateForTests()
  const originalFetch = global.fetch
  global.fetch = async () => ({
    ok: true,
    text: async () => "User-agent: *\nDisallow: /",
    headers: {
      get: () => "text/plain"
    }
  })

  try {
    const result = await evaluateSourceCompliance("https://robots-disallow.example.com/private/article", {
      fullTextAllowedDomains: ["example.com"]
    })

    assert.equal(result.decision, "snippet_only")
    assert.equal(result.reason, "robots_disallow")
  } finally {
    global.fetch = originalFetch
  }
})

test("evaluateSourceCompliance enforces per-source rate limits", async () => {
  resetSourceComplianceStateForTests()
  const originalFetch = global.fetch
  global.fetch = async () => ({
    ok: true,
    text: async () => "User-agent: *\nAllow: /",
    headers: {
      get: () => "text/plain"
    }
  })

  try {
    const first = await evaluateSourceCompliance("https://rate-limit-source.example.com/a", {
      fullTextAllowedDomains: ["example.com"],
      rateLimitWindowMs: 60_000,
      rateLimitMaxRequests: 1
    })

    const second = await evaluateSourceCompliance("https://rate-limit-source.example.com/b", {
      fullTextAllowedDomains: ["example.com"],
      rateLimitWindowMs: 60_000,
      rateLimitMaxRequests: 1
    })

    assert.equal(first.decision, "full_text")
    assert.equal(second.decision, "snippet_only")
    assert.equal(second.reason, "rate_limited")
  } finally {
    global.fetch = originalFetch
  }
})

test("trimSnippet enforces snippet size limits", () => {
  const text = "A".repeat(1000)
  const trimmed = trimSnippet(text)
  assert.ok(trimmed.length <= portfolioConfig.maxSnippetChars)
  assert.ok(trimmed.length >= 32)
})
