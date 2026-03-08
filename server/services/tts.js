import { ElevenLabsClient } from "elevenlabs"
import dotenv from "dotenv"

dotenv.config({ path: new URL("./.env", import.meta.url) })
dotenv.config()

function getElevenLabsClient() {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not configured")
  }

  return new ElevenLabsClient({ apiKey })
}

export async function generateSpeech(text) {
  const elevenlabs = getElevenLabsClient()
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "21m00Tcm4TlvDq8ikWAM"

  const audioStream = await elevenlabs.generate({
    voice: voiceId,
    text,
    model_id: "eleven_multilingual_v2"
  })

  const chunks = []

  for await (const chunk of audioStream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks)
}
