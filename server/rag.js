import { db } from "./mongodb.js"
import { embedText } from "./embeddings.js"
import { GoogleGenerativeAI } from "@google/generative-ai"
import { CHUNKS_COLLECTION, TEXT_INDEX_NAME, VECTOR_INDEX_NAME, VECTOR_PATH } from "./search-indexes.js"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" })

function reciprocalRankFusion(vectorResults, textResults, limit) {
  const rankK = 60
  const scoreMap = new Map()
  const docMap = new Map()

  vectorResults.forEach((doc, index) => {
    const id = String(doc._id)
    scoreMap.set(id, (scoreMap.get(id) || 0) + 1 / (rankK + index + 1))
    docMap.set(id, doc)
  })

  textResults.forEach((doc, index) => {
    const id = String(doc._id)
    scoreMap.set(id, (scoreMap.get(id) || 0) + 1 / (rankK + index + 1))
    if (!docMap.has(id)) {
      docMap.set(id, doc)
    }
  })

  return [...scoreMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id, fusionScore]) => ({
      ...docMap.get(id),
      fusionScore
    }))
}

function buildFilter(options) {
  const filter = {}
  if (options.documentId) filter.documentId = options.documentId
  if (options.sessionId) filter.sessionId = options.sessionId
  return Object.keys(filter).length > 0 ? filter : null
}

async function runVectorSearch(questionEmbedding, options) {
  const filter = buildFilter(options)

  return db.collection(CHUNKS_COLLECTION).aggregate([
    {
      $vectorSearch: {
        index: VECTOR_INDEX_NAME,
        path: VECTOR_PATH,
        queryVector: questionEmbedding,
        numCandidates: 120,
        limit: options.limit,
        ...(filter ? { filter } : {})
      }
    },
    {
      $project: {
        text: 1,
        chunkIndex: 1,
        documentId: 1,
        sessionId: 1,
        filename: 1,
        sourceType: 1,
        vectorScore: { $meta: "vectorSearchScore" }
      }
    }
  ]).toArray()
}

async function runTextSearch(question, options) {
  const filter = buildFilter(options)
  const pipeline = [
    {
      $search: {
        index: TEXT_INDEX_NAME,
        text: {
          query: question,
          path: ["text", "filename", "sourceType"]
        }
      }
    }
  ]

  if (filter) {
    pipeline.push({ $match: filter })
  }

  pipeline.push(
    {
      $project: {
        text: 1,
        chunkIndex: 1,
        documentId: 1,
        sessionId: 1,
        filename: 1,
        sourceType: 1,
        textScore: { $meta: "searchScore" }
      }
    },
    { $limit: options.limit }
  )

  try {
    return await db.collection(CHUNKS_COLLECTION).aggregate(pipeline).toArray()
  } catch (error) {
    // Continue gracefully if text index has not been created yet.
    if (String(error?.message || "").toLowerCase().includes("index")) {
      return []
    }
    throw error
  }
}

async function retrieveChunks(question, questionEmbedding, options) {
  const vectorResults = await runVectorSearch(questionEmbedding, options)
  if (!options.hybrid) return vectorResults

  const textResults = await runTextSearch(question, options)
  return reciprocalRankFusion(vectorResults, textResults, options.limit)
}

export async function answerQuestion(question, options = {}) {
  const retrievalOptions = {
    documentId: options.documentId || null,
    sessionId: options.sessionId || null,
    hybrid: options.hybrid !== false,
    limit: options.limit || 5
  }

  const questionEmbedding = await embedText(question)
  const chunks = await retrieveChunks(question, questionEmbedding, retrievalOptions)
  const context = chunks
    .map((chunk, idx) => `[${idx + 1}] ${chunk.text}\nsource=${chunk.filename || "unknown"} chunk=${chunk.chunkIndex}`)
    .join("\n\n")

  const prompt = `
You are a financial research assistant.

Use only the provided context to answer.
Cite supporting snippets inline using [1], [2], etc.

Context:
${context}

Question:
${question}
`

  const response = await model.generateContent(prompt)

  return {
    answer: response.response.text(),
    sources: chunks.map((chunk) => ({
      id: chunk._id,
      sessionId: chunk.sessionId,
      documentId: chunk.documentId,
      filename: chunk.filename,
      sourceType: chunk.sourceType,
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      vectorScore: chunk.vectorScore ?? null,
      textScore: chunk.textScore ?? null,
      fusionScore: chunk.fusionScore ?? null
    }))
  }
}
