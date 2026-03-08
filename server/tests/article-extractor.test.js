import test from "node:test"
import assert from "node:assert/strict"
import { extractArticleContent } from "../portfolio/article-extractor.js"

test("extractArticleContent falls back to snippet-only when URL is missing", async () => {
  const result = await extractArticleContent({
    articleId: "missing-url-test",
    snippet: "Sample snippet content"
  })

  assert.equal(result.extractionStatus, "snippet_only")
  assert.equal(result.content, "Sample snippet content")
  assert.equal(result.complianceAudit?.reason, "missing_url")
})
