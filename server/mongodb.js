import { MongoClient } from "mongodb"
import dotenv from "dotenv"

dotenv.config()

const uri = process.env.MONGO_URI

if (!uri) {
  throw new Error("MONGO_URI is not defined in .env")
}

const client = new MongoClient(uri)

await client.connect()

export const db = client.db("ragDB")