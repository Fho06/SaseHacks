import { embedText } from "./embeddings.js"
import { answerQuestion } from "./rag.js"
import { db } from "./mongodb.js"

export async function handleChat(req, res) {
  try {
    const { question } = req.body

    if (!question) {
      return res.status(400).json({ error: "Question required" })
    }

    console.log("Question:", question)

    /*
    STEP 1 — embed question
    */
    const questionEmbedding = await embedText(question)

    /*
    STEP 2 — vector search
    */
    const results = await db.collection("chunks").aggregate([
      {
        $vectorSearch: {
          index: "vector_index",
          path: "embedding",
          queryVector: questionEmbedding,
          numCandidates: 100,
          limit: 5
        }
      },
      {
        $project: {
          text: 1,
          sectionTitle: 1,
          citation: 1,
          score: { $meta: "vectorSearchScore" }
        }
      }
    ]).toArray()

    console.log("Retrieved chunks:", results.length)
    const count = await db.collection("documents").countDocuments()
console.log("Total docs:", count)

    /*
    STEP 3 — build context
    */
    const context = results
      .map((c, i) => `Source ${i + 1}:\n${c.text}`)
      .join("\n\n")

    const prompt = `
You are a financial document assistant.

Answer the question ONLY using the context.

Context:
${context}

Question:
${question}

Return a clear answer.
`

    /*
    STEP 4 — Gemini answer
    */
    const answer = await answerQuestion(prompt)

    /*
    STEP 5 — send response
    */
    res.json({
      answer,
      sources: results.map(r => ({
        text: r.text.slice(0, 200),
        section: r.sectionTitle || null
      }))
    })

  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Chat failed" })
  }
}