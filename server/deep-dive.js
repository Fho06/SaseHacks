import { GoogleGenAI } from "@google/genai"
import { answerQuestion } from "./rag.js"

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
})

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const MAX_WEB_SOURCES = toPositiveInt(process.env.DEEP_DIVE_MAX_WEB_SOURCES, 4)
const MAX_HISTORY_MESSAGES = toPositiveInt(process.env.DEEP_DIVE_MAX_HISTORY_MESSAGES, 10)
const MAX_WEB_SNIPPET_CHARS = toPositiveInt(process.env.DEEP_DIVE_MAX_WEB_SNIPPET_CHARS, 500)

function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim()
}

function truncate(value, max) {
  const text = cleanText(value)
  if (text.length <= max) return text
  return `${text.slice(0, max - 3)}...`
}

function flattenRelatedTopics(input, acc = []) {
  if (!Array.isArray(input)) return acc

  for (const item of input) {
    if (!item) continue

    if (Array.isArray(item.Topics)) {
      flattenRelatedTopics(item.Topics, acc)
      continue
    }

    if (item.Text && item.FirstURL) {
      acc.push({
        title: cleanText(item.Text.split(" - ")[0] || item.Text),
        url: item.FirstURL,
        snippet: truncate(item.Text, MAX_WEB_SNIPPET_CHARS),
        provider: "duckduckgo"
      })
    }
  }

  return acc
}

async function searchOnlineSources(query, limit = MAX_WEB_SOURCES) {
  try {
    const endpoint = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`
    const response = await fetch(endpoint)

    if (!response.ok) {
      return []
    }

    const payload = await response.json()
    const candidates = []

    if (payload?.AbstractURL && payload?.AbstractText) {
      candidates.push({
        title: cleanText(payload.Heading || "Reference"),
        url: payload.AbstractURL,
        snippet: truncate(payload.AbstractText, MAX_WEB_SNIPPET_CHARS),
        provider: "duckduckgo"
      })
    }

    flattenRelatedTopics(payload?.RelatedTopics, candidates)

    const seen = new Set()
    const deduped = []

    for (const source of candidates) {
      if (!source.url || seen.has(source.url)) continue
      seen.add(source.url)
      deduped.push(source)
      if (deduped.length >= limit) break
    }

    return deduped
  } catch {
    return []
  }
}

function serializeConversation(conversation) {
  if (!Array.isArray(conversation)) return ""

  return conversation
    .slice(-MAX_HISTORY_MESSAGES)
    .map((message) => {
      const role = message?.role === "assistant" ? "assistant" : "user"
      return `${role}: ${truncate(message?.content || "", 800)}`
    })
    .join("\n")
}

function buildEvidenceBlock(dbSources, webSources) {
  const dbLines = dbSources.map((source, index) => {
    const file = source?.filename || "unknown"
    const chunk = source?.chunkIndex ?? "n/a"
    return `[D${index + 1}] file=${file} chunk=${chunk}\n${truncate(source?.text || "", 1200)}`
  })

  const webLines = webSources.map((source, index) => {
    return `[W${index + 1}] title=${source.title}\nurl=${source.url}\nsnippet=${source.snippet}`
  })

  return {
    dbEvidence: dbLines.join("\n\n"),
    webEvidence: webLines.join("\n\n")
  }
}

export async function handleDeepDive(req, res) {
  try {
    const question = cleanText(req.body?.question)
    const previousAnswer = cleanText(req.body?.previousAnswer)
    const documentId = cleanText(req.body?.documentId) || null
    const sessionId = cleanText(req.body?.sessionId) || null
    const conversation = Array.isArray(req.body?.conversation) ? req.body.conversation : []

    if (!question) {
      return res.status(400).json({ error: "Question required" })
    }

    const dbResult = await answerQuestion(question, {
      documentId,
      sessionId,
      hybrid: true,
      limit: 5
    })

    const webQuery = `${question} ${truncate(previousAnswer, 180)}`.trim()
    const webSources = await searchOnlineSources(webQuery, MAX_WEB_SOURCES)

    const dbSources = Array.isArray(dbResult?.sources) ? dbResult.sources.slice(0, 6) : []
    const historyBlock = serializeConversation(conversation)
    const evidence = buildEvidenceBlock(dbSources, webSources)

    const prompt = `
You are FinVoice Deep Dive mode.
Answer the follow-up question using:
1) retrieved database evidence from uploaded files
2) online sources

Rules:
- Prefer database evidence for document-grounded statements.
- When using web information, cite using [W#] markers.
- When using database evidence, cite using [D#] markers.
- If evidence is missing, explicitly say what is uncertain.
- Return plain text paragraphs only.

Previous answer context:
${truncate(previousAnswer, 2000) || "none"}

Conversation history:
${historyBlock || "none"}

Database evidence:
${evidence.dbEvidence || "none"}

Web evidence:
${evidence.webEvidence || "none"}

Follow-up question:
${question}
`

    const generation = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL_DEEP_DIVE || "gemini-2.5-flash",
      contents: prompt,
      config: {
        maxOutputTokens: toPositiveInt(process.env.DEEP_DIVE_MAX_OUTPUT_TOKENS, 900)
      }
    })

    res.json({
      answer: cleanText(generation?.text || "No deep-dive answer generated."),
      dbSources: dbSources.map((source, index) => ({
        id: `D${index + 1}`,
        filename: source.filename || "unknown",
        chunkIndex: source.chunkIndex ?? null,
        documentId: source.documentId || null,
        text: truncate(source.text || "", 500)
      })),
      webSources: webSources.map((source, index) => ({
        id: `W${index + 1}`,
        title: source.title,
        url: source.url,
        snippet: source.snippet,
        provider: source.provider
      }))
    })
  } catch (error) {
    console.error("Deep dive error:", error)
    res.status(500).json({
      error: "Deep dive request failed"
    })
  }
}
