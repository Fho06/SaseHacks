import express from "express"
import multer from "multer"
import cors from "cors"
import { createRequire } from "module"

import { chunkText } from "./chunker.js"
import { embedText } from "./embeddings.js"
import { db } from "./mongodb.js"
import { handleChat } from "./chat.js"

const require = createRequire(import.meta.url)
const pdfParse = require("pdf-parse")

const app = express()

app.use(cors())
app.use(express.json())

app.get("/", (req, res) => {
  res.json({ status: "server running" })
})

/*
CHAT ENDPOINT (RAG)
*/
app.post("/chat", handleChat)

/*
FILE UPLOAD
*/
const upload = multer({ storage: multer.memoryStorage() })

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
    

    console.log("Total chunks:", chunks.length)

    if (chunks.length > 0) {
      console.log("First chunk preview:", chunks[0].slice(0, 200))
    }

    /*
    EMBED + STORE CHUNKS
    */
    await Promise.all(
      chunks.map(async (chunk, i) => {

        const embedding = await embedText(chunk)

        await db.collection("chunks").insertOne({
          text: chunk,
          embedding,
          chunkIndex: i,
          createdAt: new Date()
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

app.listen(5050, () => {
  console.log("Server running on port 5050")
})