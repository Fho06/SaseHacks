import { answerQuestion } from "../services/rag.js"

export async function handleChat(req, res) {
  try {
    const { question } = req.body

    if (!question) {
      return res.status(400).json({
        error: "Question required"
      })
    }

    console.log("User question:", question)

    const result = await answerQuestion(question)

    res.json({
      answer: result.answer,
      sources: result.sources.map((s) => ({
        text: s.text.slice(0, 200),
        filename: s.filename,
        chunkIndex: s.chunkIndex
      }))
    })

  } catch (err) {
    console.error("Chat error:", err)

    res.status(500).json({
      error: "Chat failed"
    })
  }
}