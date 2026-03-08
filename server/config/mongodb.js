import { MongoClient } from "mongodb"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: [path.resolve(dirname, ".env"), path.resolve(dirname, "../.env")] })

const uri = process.env.MONGODB_URI
if (!uri) {
  throw new Error("MONGODB_URI is not set")
}

console.log("Connecting to MongoDB Atlas...")

const client = new MongoClient(uri)

await client.connect()

console.log("MongoDB connected")

export const db = client.db("ragDB")
