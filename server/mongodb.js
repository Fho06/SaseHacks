import { MongoClient } from "mongodb"
import dotenv from "dotenv"

dotenv.config()

const uri = process.env.MONGODB_URI

console.log("Connecting to:", uri)

const client = new MongoClient(uri)

await client.connect()

console.log("MongoDB connected")

//DB name
export const db = client.db("ragDB")