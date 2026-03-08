import { getSecUserAgent } from "./config.js"
import {
  evaluateSourceCompliance,
  trimExtractedContent,
  trimSnippet
} from "./source-compliance.js"

function stripHtmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function buildAuditEntry(article, compliance, extractionStatus, snippetChars, contentChars) {
  return {
    checkedAt: new Date().toISOString(),
    articleId: article?.articleId || null,
    provider: article?.provider || "unknown",
    source: article?.source || "unknown",
    url: article?.url || null,
    domain: compliance?.domain || "",
    decision: compliance?.decision || "snippet_only",
    reason: compliance?.reason || "unknown",
    extractionStatus,
    licensedDomain: Boolean(compliance?.licensedDomain),
    robots: compliance?.robots || null,
    rateLimit: compliance?.rateLimit || null,
    snippetChars,
    contentChars
  }
}

function auditLog(entry) {
  try {
    console.info("[portfolio-source-audit]", JSON.stringify(entry))
  } catch {
    console.info("[portfolio-source-audit] unable to serialize entry")
  }
}

export async function extractArticleContent(article) {
  const safeSnippet = trimSnippet(article?.snippet || "")

  if (!article?.url) {
    const audit = buildAuditEntry(
      article,
      { decision: "snippet_only", reason: "missing_url", licensedDomain: false, robots: null, rateLimit: null, domain: "" },
      "snippet_only",
      safeSnippet.length,
      safeSnippet.length
    )
    auditLog(audit)

    return {
      ...article,
      snippet: safeSnippet,
      content: safeSnippet,
      extractionStatus: "snippet_only",
      complianceAudit: audit
    }
  }

  const compliance = await evaluateSourceCompliance(article.url)

  if (compliance.decision !== "full_text") {
    const audit = buildAuditEntry(article, compliance, "snippet_only", safeSnippet.length, safeSnippet.length)
    auditLog(audit)

    return {
      ...article,
      snippet: safeSnippet,
      content: safeSnippet,
      extractionStatus: "snippet_only",
      complianceAudit: audit
    }
  }

  try {
    const response = await fetch(article.url, {
      redirect: "follow",
      headers: {
        "User-Agent": getSecUserAgent()
      }
    })

    if (!response.ok) {
      const audit = buildAuditEntry(
        article,
        { ...compliance, reason: "fetch_failed" },
        "failed",
        safeSnippet.length,
        safeSnippet.length
      )
      auditLog(audit)

      return {
        ...article,
        snippet: safeSnippet,
        content: safeSnippet,
        extractionStatus: "failed",
        complianceAudit: audit
      }
    }

    const html = await response.text()
    const extracted = trimExtractedContent(stripHtmlToText(html))
    const content = extracted || safeSnippet
    const extractionStatus = extracted ? "full_text" : "snippet_only"
    const audit = buildAuditEntry(article, compliance, extractionStatus, safeSnippet.length, content.length)
    auditLog(audit)

    return {
      ...article,
      snippet: safeSnippet,
      content,
      extractionStatus,
      complianceAudit: audit
    }
  } catch {
    const audit = buildAuditEntry(
      article,
      { ...compliance, reason: "fetch_error" },
      "failed",
      safeSnippet.length,
      safeSnippet.length
    )
    auditLog(audit)

    return {
      ...article,
      snippet: safeSnippet,
      content: safeSnippet,
      extractionStatus: "failed",
      complianceAudit: audit
    }
  }
}
