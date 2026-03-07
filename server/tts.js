import { ElevenLabsClient } from "elevenlabs"
import dotenv from "dotenv"

dotenv.config()

const elevenlabs = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY
})

export async function generateSpeech(text) {

  const audioStream = await elevenlabs.generate({
    voice: "Rachel",
    text,
    model_id: "eleven_multilingual_v2"
  })

  const chunks = []

  for await (const chunk of audioStream) {
    chunks.push(chunk)
  }

  return Buffer.concat(chunks)
}