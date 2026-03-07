import express from "express"
import multer from "multer"
import cors from "cors"
import { createRequire } from "module"

const require = createRequire(import.meta.url)
const pdfParse = require("pdf-parse")
console.log("pdfParse:", pdfParse)

import { chunkText } from "./chunker.js"
import { embedText } from "./embeddings.js"
import { answerQuestion } from "./rag.js"
import { db } from "./mongodb.js"


console.log(await embedText("hello world"));


const app = express()

app.use(cors())
app.use(express.json())
app.get("/", (req, res) => {
  res.json({ status: "server running" })
})

// ensure file is stored in memory so req.file.buffer exists
const upload = multer({ storage: multer.memoryStorage() })

/*
UPLOAD DOCUMENT
*/
app.post("/upload", upload.single("files"), async (req, res) => {
  try {

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" })
    }

    const buffer = req.file.buffer

    const parser = new pdfParse.PDFParse({ data: buffer })
    const data = await parser.getText()

    const text = data.text

    const chunks = chunkText(text)

    // DEBUG: verify chunking worked
console.log("Total chunks:", chunks.length)

if (chunks.length > 0) {
  console.log("First chunk preview:", chunks[0].slice(0, 200))
}

    // run embeddings in parallel (faster)
    await Promise.all(
      chunks.map(async (chunk, i) => {

        const embedding = await embedText(chunk)

        await db.collection("chunks").insertOne({
          text: chunk,
          embedding,
          chunkIndex: i
        })

      })
    )

    res.json({
      message: "Document indexed",
      chunks: chunks.length
    })

  } catch (err) {

    console.error(err)

    res.status(500).json({
      error: "Failed to process document"
    })

  }
})

/*
ASK QUESTION
*/
app.post("/ask", async (req, res) => {
  try {

    const { question } = req.body

    if (!question) {
      return res.status(400).json({ error: "Question required" })
    }

    const result = await answerQuestion(question)

    res.json(result)

  } catch (err) {

    console.error(err)

    res.status(500).json({
      error: "Failed to answer question"
    })

  }
})

app.listen(5050, () => {
  console.log("Server running on port 5050")
})