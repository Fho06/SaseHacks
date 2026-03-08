import { cacheWrap } from "./cache.js"
import { getSecUserAgent, portfolioConfig } from "./config.js"

const sourceRateState = new Map()

function normalizeWhitespace(value) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function clampLength(value, maxChars) {
  const safeMax = Math.max(32, Number(maxChars) || 32)
  return normalizeWhitespace(value).slice(0, safeMax)
}

function normalizeAllowlistDomain(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\/.*$/, "")
}

function getUrlParts(rawUrl) {
  try {
    const parsed = new URL(rawUrl)
    const hostname = String(parsed.hostname || "").toLowerCase().replace(/^www\./, "")
    const pathWithQuery = `${parsed.pathname || "/"}${parsed.search || ""}` || "/"
    return {
      valid: true,
      hostname,
      origin: parsed.origin,
      pathWithQuery
    }
  } catch {
    return {
      valid: false,
      hostname: "",
      origin: "",
      pathWithQuery: "/"
    }
  }
}

function isHostnameLicensed(hostname, allowlist = portfolioConfig.fullTextAllowedDomains) {
  const normalizedHost = normalizeAllowlistDomain(hostname)
  if (!normalizedHost) return false

  return allowlist.some((entry) => {
    const normalizedEntry = normalizeAllowlistDomain(entry)
    if (!normalizedEntry) return false
    return normalizedHost === normalizedEntry || normalizedHost.endsWith(`.${normalizedEntry}`)
  })
}

function parseRobotsGroups(content) {
  const groups = []
  let currentAgents = []
  let currentRules = []

  const lines = String(content || "").split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.replace(/#.*$/, "").trim()
    if (!line) continue

    const separatorIndex = line.indexOf(":")
    if (separatorIndex <= 0) continue

    const field = line.slice(0, separatorIndex).trim().toLowerCase()
    const value = line.slice(separatorIndex + 1).trim()

    if (field === "user-agent") {
      if (currentAgents.length > 0 && currentRules.length > 0) {
        groups.push({ agents: currentAgents, rules: currentRules })
        currentAgents = []
        currentRules = []
      }
      currentAgents.push(value.toLowerCase())
      continue
    }

    if (field === "allow" || field === "disallow") {
      if (currentAgents.length === 0) continue
      currentRules.push({ type: field, path: value })
    }
  }

  if (currentAgents.length > 0) {
    groups.push({ agents: currentAgents, rules: currentRules })
  }

  return groups
}

function matchUserAgentGroups(groups, userAgent) {
  const uaToken = String(userAgent || "").toLowerCase().split(/[\/\s]/)[0]
  let maxSpecificity = -1
  const matched = []

  for (const group of groups) {
    const agents = Array.isArray(group?.agents) ? group.agents : []
    let specificity = -1

    for (const agent of agents) {
      if (!agent) continue
      if (agent === "*") {
        specificity = Math.max(specificity, 1)
        continue
      }
      if (uaToken.includes(agent) || agent.includes(uaToken)) {
        specificity = Math.max(specificity, agent.length)
      }
    }

    if (specificity < 0) continue
    if (specificity > maxSpecificity) {
      maxSpecificity = specificity
      matched.length = 0
      matched.push(group)
      continue
    }
    if (specificity === maxSpecificity) {
      matched.push(group)
    }
  }

  return matched
}

function escapeRegex(value) {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&")
}

function robotsRuleMatches(path, rulePath) {
  if (!rulePath) return false
  const escaped = escapeRegex(rulePath)
    .replace(/\\\*/g, ".*")
    .replace(/\\\$/g, "$")
  const pattern = new RegExp(`^${escaped}`)
  return pattern.test(path)
}

function evaluateRobotsRules(rules, pathWithQuery) {
  let winner = null
  const path = pathWithQuery || "/"

  for (const rule of rules) {
    const rulePath = String(rule?.path || "")
    if (!rulePath && rule?.type === "disallow") {
      continue
    }
    if (!robotsRuleMatches(path, rulePath || "/")) continue

    const candidate = {
      type: rule.type === "allow" ? "allow" : "disallow",
      path: rulePath,
      specificity: rulePath.length
    }

    if (!winner || candidate.specificity > winner.specificity) {
      winner = candidate
      continue
    }

    if (
      winner &&
      candidate.specificity === winner.specificity &&
      candidate.type === "allow" &&
      winner.type !== "allow"
    ) {
      winner = candidate
    }
  }

  if (!winner) {
    return { allowed: true, matchedRule: null }
  }

  return {
    allowed: winner.type === "allow",
    matchedRule: winner
  }
}

async function loadRobotsTxt(origin) {
  const cacheKey = `robots:${origin}`
  return cacheWrap(cacheKey, portfolioConfig.robotsCacheTtlMs, async () => {
    try {
      const robotsUrl = `${origin.replace(/\/+$/, "")}/robots.txt`
      const response = await fetch(robotsUrl, {
        headers: {
          "User-Agent": getSecUserAgent()
        }
      })

      if (!response.ok) {
        return {
          status: "unavailable",
          robotsUrl,
          content: "",
          fetchedAt: new Date().toISOString()
        }
      }

      const content = await response.text()
      return {
        status: "ok",
        robotsUrl,
        content: String(content || "").slice(0, 200_000),
        fetchedAt: new Date().toISOString()
      }
    } catch {
      return {
        status: "error",
        robotsUrl: `${origin.replace(/\/+$/, "")}/robots.txt`,
        content: "",
        fetchedAt: new Date().toISOString()
      }
    }
  })
}

function consumeSourceBudget(domain, options = {}) {
  const now = Date.now()
  const windowMs = Math.max(1000, Number(options.windowMs ?? portfolioConfig.sourceRateLimitWindowMs) || 1000)
  const maxRequests = Math.max(1, Number(options.maxRequests ?? portfolioConfig.sourceRateLimitMaxRequests) || 1)
  const windowStart = now - windowMs
  const queue = sourceRateState.get(domain) || []
  const filtered = queue.filter((timestamp) => timestamp >= windowStart)

  if (filtered.length >= maxRequests) {
    const retryAfterMs = Math.max(0, windowMs - (now - filtered[0]))
    sourceRateState.set(domain, filtered)
    return {
      allowed: false,
      retryAfterMs,
      countInWindow: filtered.length,
      maxRequests,
      windowMs
    }
  }

  filtered.push(now)
  sourceRateState.set(domain, filtered)
  return {
    allowed: true,
    retryAfterMs: 0,
    countInWindow: filtered.length,
    maxRequests,
    windowMs
  }
}

export async function evaluateSourceCompliance(rawUrl, options = {}) {
  const checkedAt = new Date().toISOString()
  const allowlist = Array.isArray(options.fullTextAllowedDomains)
    ? options.fullTextAllowedDomains
    : portfolioConfig.fullTextAllowedDomains
  const robotsFailClosed = typeof options.robotsFailClosed === "boolean"
    ? options.robotsFailClosed
    : portfolioConfig.robotsFailClosed

  const urlParts = getUrlParts(rawUrl)
  if (!urlParts.valid) {
    return {
      checkedAt,
      url: rawUrl || "",
      domain: "",
      decision: "snippet_only",
      reason: "invalid_url",
      licensedDomain: false,
      robots: { status: "skipped", allowed: false, matchedRule: null, robotsUrl: null },
      rateLimit: { allowed: false, retryAfterMs: 0, countInWindow: 0, maxRequests: 0, windowMs: 0 }
    }
  }

  const licensedDomain = isHostnameLicensed(urlParts.hostname, allowlist)
  if (!licensedDomain) {
    return {
      checkedAt,
      url: rawUrl,
      domain: urlParts.hostname,
      decision: "snippet_only",
      reason: "unlicensed_domain",
      licensedDomain,
      robots: { status: "skipped", allowed: false, matchedRule: null, robotsUrl: null },
      rateLimit: { allowed: false, retryAfterMs: 0, countInWindow: 0, maxRequests: 0, windowMs: 0 }
    }
  }

  const robotsTxt = await loadRobotsTxt(urlParts.origin)
  const robotsGroups = parseRobotsGroups(robotsTxt.content)
  const matchedGroups = matchUserAgentGroups(robotsGroups, getSecUserAgent())
  const rules = matchedGroups.flatMap((group) => group.rules || [])
  const robotsEvaluation = evaluateRobotsRules(rules, urlParts.pathWithQuery)

  const robotsAllowed = robotsTxt.status === "ok"
    ? robotsEvaluation.allowed
    : !robotsFailClosed

  if (!robotsAllowed) {
    return {
      checkedAt,
      url: rawUrl,
      domain: urlParts.hostname,
      decision: "snippet_only",
      reason: robotsTxt.status === "ok" ? "robots_disallow" : "robots_unavailable",
      licensedDomain,
      robots: {
        status: robotsTxt.status,
        allowed: false,
        matchedRule: robotsEvaluation.matchedRule,
        robotsUrl: robotsTxt.robotsUrl
      },
      rateLimit: { allowed: false, retryAfterMs: 0, countInWindow: 0, maxRequests: 0, windowMs: 0 }
    }
  }

  const rateLimit = consumeSourceBudget(urlParts.hostname, {
    windowMs: options.rateLimitWindowMs,
    maxRequests: options.rateLimitMaxRequests
  })
  if (!rateLimit.allowed) {
    return {
      checkedAt,
      url: rawUrl,
      domain: urlParts.hostname,
      decision: "snippet_only",
      reason: "rate_limited",
      licensedDomain,
      robots: {
        status: robotsTxt.status,
        allowed: true,
        matchedRule: robotsEvaluation.matchedRule,
        robotsUrl: robotsTxt.robotsUrl
      },
      rateLimit
    }
  }

  return {
    checkedAt,
    url: rawUrl,
    domain: urlParts.hostname,
    decision: "full_text",
    reason: "allowed",
    licensedDomain,
    robots: {
      status: robotsTxt.status,
      allowed: true,
      matchedRule: robotsEvaluation.matchedRule,
      robotsUrl: robotsTxt.robotsUrl
    },
    rateLimit
  }
}

export function trimSnippet(value) {
  return clampLength(value, portfolioConfig.maxSnippetChars)
}

export function trimExtractedContent(value) {
  return clampLength(value, portfolioConfig.maxExtractedChars)
}

export function resetSourceComplianceStateForTests() {
  sourceRateState.clear()
}
