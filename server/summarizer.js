import { GoogleGenAI } from "@google/genai"

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
})

export async function generateFinancialSummary(text, filename) {

  const truncatedText = text.slice(0, 30000)

  const prompt = `
You are a financial analyst.

Analyze the following financial document and return ONLY valid JSON.

JSON format:
{
  "title": "AI Financial Briefing",
  "summary": "1-2 sentence summary",
  "keyMetrics": [],
  "majorRisks": [],
  "managementTone": "",
  "redFlags": []
}

Rules:
- Do not invent numbers
- Be concise
- Prefer 2–5 items per list
- Return JSON only

Document: ${filename}

Text:
${truncatedText}
`

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt
  })

  const raw = response.text

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error("Failed to parse summary JSON")
  }

  return parsed
}