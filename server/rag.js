import { db } from "./mongodb.js"
import { embedText } from "./embeddings.js"
import { GoogleGenerativeAI } from "@google/generative-ai"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

const model = genAI.getGenerativeModel({
  model: "gemini-1.5-flash"
})

export async function answerQuestion(question) {

  const questionEmbedding = await embedText(question)

  const results = await db.collection("chunks").aggregate([
    {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector: questionEmbedding,
        numCandidates: 100,
        limit: 5
      }
    }
  ]).toArray()

  const context = results.map(r => r.text).join("\n\n")

  const prompt = `
You are a financial research assistant.

Use only the provided context to answer.

Context:
${context}

Question:
${question}
`

  const response = await model.generateContent(prompt)

  return {
    answer: response.response.text(),
    sources: results
  }
}