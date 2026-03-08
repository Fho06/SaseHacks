import dotenv from "dotenv"
import { MongoClient } from "mongodb"
import path from "path"
import { fileURLToPath } from "url"
import { embedText } from "../embeddings.js"
import {
  CHUNKS_COLLECTION,
  TEXT_INDEX_NAME,
  VECTOR_INDEX_NAME,
  VECTOR_PATH
} from "../search-indexes.js"

const dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: [path.resolve(dirname, "../.env"), path.resolve(dirname, "../../.env")] })

async function upsertSearchIndex(db, { name, definition, type }) {
  const existing = await db.command({
    listSearchIndexes: CHUNKS_COLLECTION,
    name
  })
  const exists = (existing?.cursor?.firstBatch || []).length > 0

  if (exists) {
    await db.command({
      updateSearchIndex: CHUNKS_COLLECTION,
      name,
      definition
    })
    console.log(`Updated search index: ${name}`)
    return
  }

  await db.command({
    createSearchIndexes: CHUNKS_COLLECTION,
    indexes: [
      {
        name,
        ...(type ? { type } : {}),
        definition
      }
    ]
  })
  console.log(`Created search index: ${name}`)
}

function isSearchCommandUnsupported(error) {
  const message = String(error?.message || "").toLowerCase()
  return error?.codeName === "CommandNotFound" || message.includes("command not found")
}

async function ensureMongoIndexes(db) {
  const collection = db.collection(CHUNKS_COLLECTION)

  await collection.createIndex({ userId: 1, sessionId: 1, documentId: 1 }, { name: "user_session_document_idx" })
  await collection.createIndex({ sessionId: 1, documentId: 1 }, { name: "session_document_idx" })
  await collection.createIndex({ userId: 1, documentId: 1, chunkIndex: 1 }, { name: "user_document_chunk_idx" })
  await collection.createIndex({ documentId: 1, chunkIndex: 1 }, { name: "document_chunk_idx" })
  await collection.createIndex({ userId: 1, createdAt: -1 }, { name: "user_created_at_idx" })
  await collection.createIndex({ filename: 1 }, { name: "filename_idx" })
  await collection.createIndex({ createdAt: -1 }, { name: "created_at_idx" })
  console.log("Ensured MongoDB indexes for user/session/document metadata")
}

async function main() {
  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error("MONGODB_URI is not set")
  }

  const client = new MongoClient(uri)
  await client.connect()
  const db = client.db("ragDB")

  try {
    const probeEmbedding = await embedText("dimension probe")
    const numDimensions = probeEmbedding.length

    const vectorDefinition = {
      fields: [
        {
          type: "vector",
          path: VECTOR_PATH,
          numDimensions,
          similarity: "cosine"
        },
        { type: "filter", path: "userId" },
        { type: "filter", path: "sessionId" },
        { type: "filter", path: "documentId" },
        { type: "filter", path: "filename" },
        { type: "filter", path: "sourceType" }
      ]
    }

    const textDefinition = {
      mappings: {
        dynamic: false,
        fields: {
          text: { type: "string" },
          filename: { type: "string" },
          sourceType: { type: "string" }
        }
      }
    }

    try {
      await upsertSearchIndex(db, {
        name: VECTOR_INDEX_NAME,
        type: "vectorSearch",
        definition: vectorDefinition
      })
      await upsertSearchIndex(db, {
        name: TEXT_INDEX_NAME,
        definition: textDefinition
      })
    } catch (error) {
      if (!isSearchCommandUnsupported(error)) {
        throw error
      }
      console.warn(
        "Search index commands are unavailable on this cluster. " +
        "Create Atlas Search indexes manually or use an Atlas cluster that supports Search."
      )
    }

    await ensureMongoIndexes(db)

    console.log(`Index setup complete. Vector dimensions: ${numDimensions}`)
  } finally {
    await client.close()
  }
}

main().catch((error) => {
  console.error("Failed to setup indexes:", error)
  process.exitCode = 1
})
