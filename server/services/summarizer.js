import { GoogleGenAI } from "@google/genai"

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
})

export async function generateFinancialSummary(text, filename) {

  // skip intro boilerplate by starting later
  const startOffset = Math.floor(text.length * 0.15)

  const truncatedText = text
    .slice(startOffset, startOffset + 35000)

  const prompt = `
You are a financial analyst.

Use ONLY the provided document text.
Do NOT use outside knowledge.
Do NOT invent numbers or companies.
If information is missing, write "Not mentioned".

Return ONLY valid JSON.

JSON format:
{
  "title": "AI Financial Briefing",
  "summary": "",
  "keyMetrics": [],
  "majorRisks": [],
  "managementTone": "",
  "redFlags": []
}

Rules:
- summary: 1–2 sentences describing the document content
- keyMetrics: financial figures explicitly mentioned
- majorRisks: risks mentioned in the document
- managementTone: short phrase like "optimistic", "cautious", "neutral"
- redFlags: concerning signals found in the text
- Use 2–5 short items per list
- JSON only
- No markdown
- No explanations

Document: ${filename}

Text:
${truncatedText}
`

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt
  })

  const raw = response.text || ""

  console.log("Gemini summary raw:", raw)

  let cleaned = raw
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim()

  let parsed

  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {

    console.error("Failed to parse summary JSON:", cleaned)

    return {
      title: "AI Financial Briefing",
      summary: "Unable to generate summary from the document.",
      keyMetrics: [],
      majorRisks: [],
      managementTone: "unknown",
      redFlags: []
    }
  }

  return parsed
}