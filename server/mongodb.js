import { MongoClient } from "mongodb"
import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(dirname, "./.env") })

const uri = process.env.MONGODB_URI

console.log("Connecting to:", uri)

const client = new MongoClient(uri)

await client.connect()

console.log("MongoDB connected")

export const db = client.db("ragDB")
