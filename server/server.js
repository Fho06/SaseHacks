import express from "express"
import multer from "multer"
import cors from "cors"
import { createRequire } from "module"
import { randomUUID } from "crypto"
import { answerQuestion } from "./rag.js"
import { chunkText } from "./chunker.js"
import { embedText } from "./embeddings.js"
import { db } from "./mongodb.js"
import { CHUNKS_COLLECTION, SUMMARIES_COLLECTION } from "./search-indexes.js"
import { generateSpeech } from "./tts.js"
import { handleChat } from "./chat.js"
import { generateFinancialSummary } from "./summarizer.js"
import presentationRoutes from "./presentation-routes.js"

const require = createRequire(import.meta.url)
const pdfParse = require("pdf-parse")

const app = express()

function getSpeechErrorMessage(err) {
  const fallback = "Speech generation failed"
  if (!err) return fallback

  const bodyMessage = err?.body?.detail?.message
  if (typeof bodyMessage === "string" && bodyMessage.trim()) {
    return bodyMessage.trim()
  }

  if (typeof err.message === "string" && err.message.trim()) {
    return err.message.trim()
  }

  return fallback
}

app.use(cors())
app.use(express.json())
app.use("/presentation", presentationRoutes)
app.get("/", (_req, res) => {
  res.json({ status: "server running" })
})
app.post("/chat", handleChat)


const upload = multer({ storage: multer.memoryStorage() })

app.post("/upload", upload.array("files"), async (req, res) => {
  try {
    const files = req.files
    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: "No files uploaded" })
    }

    const sessionId = typeof req.body?.sessionId === "string" && req.body.sessionId.trim()
      ? req.body.sessionId.trim()
      : randomUUID()
    const sourceType = typeof req.body?.sourceType === "string" && req.body.sourceType.trim()
      ? req.body.sourceType.trim()
      : "uploaded_file"
    const uploadedAt = new Date()
    const documents = []
    const uploadedFiles = []

    for (const file of files) {
      const documentId = randomUUID()
      let extractedText = ""
      if (file.mimetype === "text/plain") {
        extractedText = file.buffer.toString("utf-8")
      } else {
        const parser = new pdfParse.PDFParse({ data: file.buffer })
        const parsed = await parser.getText()
        extractedText = parsed.text || ""
      }
        //SUMMARY
      let summary = null
      try {
        summary = await generateFinancialSummary(
          extractedText,
          file.originalname
        )

        await db.collection(SUMMARIES_COLLECTION).insertOne({
          sessionId,
          documentId,
          filename: file.originalname,
          summary,
          createdAt: uploadedAt
        })

      } catch (err) {
        console.error("Summary generation failed:", err)
      }
      
      const chunks = chunkText(extractedText)
      const chunkDocs = []

      for (let i = 0; i < chunks.length; i++) {
        const embedding = await embedText(chunks[i])

        chunkDocs.push({
          sessionId,
          documentId,
          filename: file.originalname || "uploaded-file.pdf",
          sourceType,
          page: null,
          chunkIndex: i,
          text: chunks[i],
          embedding,
          embeddingModel: "gemini-embedding-001",
          createdAt: uploadedAt
        })
      }

      documents.push(...chunkDocs)
      uploadedFiles.push({
        sessionId,
        documentId,
        filename: file.originalname || "uploaded-file.pdf",
        chunks: chunkDocs.length,
        summary
      })
    }

    if (documents.length > 0) {
      await db.collection(CHUNKS_COLLECTION).insertMany(documents, { ordered: false })
    }

    res.json({
      message: "Files indexed",
      sessionId,
      files: uploadedFiles,
      totalChunks: documents.length
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to process uploaded files" })
  }
})

app.delete("/documents/:documentId", async (req, res) => {
  try {
    const documentId = req.params.documentId
    if (!documentId) {
      return res.status(400).json({ error: "documentId is required" })
    }

    const sessionId = typeof req.body?.sessionId === "string" && req.body.sessionId.trim()
      ? req.body.sessionId.trim()
      : null
    const filter = sessionId ? { documentId, sessionId } : { documentId }

    const result = await db.collection(CHUNKS_COLLECTION).deleteMany(filter)

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "No chunks found for that document" })
    }

    res.json({
      message: "Document removed from session",
      documentId,
      sessionId,
      deletedChunks: result.deletedCount
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to remove document" })
  }
})

app.post("/ask", async (req, res) => {
  try {
    const { question, documentId, sessionId, hybrid, limit } = req.body
    if (!question) {
      return res.status(400).json({ error: "Question required" })
    }

    const useHybrid = hybrid === undefined ? true : hybrid === true || hybrid === "true"
    const resultLimit = Math.max(1, Math.min(Number(limit) || 5, 10))
    const scopedDocumentId = typeof documentId === "string" && documentId.trim() ? documentId.trim() : null
    const scopedSessionId = typeof sessionId === "string" && sessionId.trim() ? sessionId.trim() : null

    const result = await answerQuestion(question, {
      documentId: scopedDocumentId,
      sessionId: scopedSessionId,
      hybrid: useHybrid,
      limit: resultLimit
    })
    res.json(result)
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: "Failed to answer question" })
  }
})


app.get("/speech", async (req, res) => {
  try {
    const text = typeof req.query?.text === "string" ? req.query.text : ""

    if (!text) {
      return res.status(400).json({ error: "Text required" })
    }
    if (text.length > 8000) {
      return res.status(400).json({ error: "Text too long for speech generation" })
    }

    const audio = await generateSpeech(text)

    res.setHeader("Content-Type", "audio/mpeg")
    res.send(audio)

  } catch (err) {
    console.error("Speech error:", err)
    res.status(500).json({ error: getSpeechErrorMessage(err) })
  }
})

app.post("/speech", async (req, res) => {
  try {
    const text = typeof req.body?.text === "string" ? req.body.text.trim() : ""

    if (!text) {
      return res.status(400).json({ error: "Text required" })
    }
    if (text.length > 8000) {
      return res.status(400).json({ error: "Text too long for speech generation" })
    }

    const audio = await generateSpeech(text)

    res.setHeader("Content-Type", "audio/mpeg")
    res.send(audio)
  } catch (err) {
    console.error("Speech error:", err)
    res.status(500).json({ error: getSpeechErrorMessage(err) })
  }
})

app.get("/summary/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params

    const doc = await db
      .collection(SUMMARIES_COLLECTION)
      .findOne({ documentId })

    if (!doc) {
      return res.status(404).json({
        error: "Summary not found"
      })
    }

    res.json(doc.summary)

  } catch (error) {
    console.error(error)
    res.status(500).json({
      error: "Failed to fetch summary"
    })
  }
})

app.post("/resummarize/:documentId", async (req, res) => {
  try {
    const { documentId } = req.params

    const chunks = await db
      .collection(CHUNKS_COLLECTION)
      .find({ documentId })
      .sort({ chunkIndex: 1 })
      .toArray()

    if (!chunks.length) {
      return res.status(404).json({ error: "Document not found" })
    }

    const text = chunks.map(c => c.text).join("\n")

    const summary = await generateFinancialSummary(
      text,
      chunks[0].filename
    )

    await db.collection(SUMMARIES_COLLECTION).updateOne(
      { documentId },
      { $set: { summary, updatedAt: new Date() } }
    )

    res.json(summary)

  } catch (err) {
    console.error("Resummarize error:", err)
    res.status(500).json({ error: "Failed to regenerate summary" })
  }
})

app.listen(5050, () => {
  console.log("Server running on port 5050")
})

