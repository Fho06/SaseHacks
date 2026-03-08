import { GoogleGenAI } from "@google/genai"

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
})

export async function generateFinancialSummary(text, filename) {

  const truncatedText = text.slice(0, 25000)

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
- If risks are not explicitly listed, infer them from the document context
- Use short bullet points
- Prefer 2-5 items per list
- Output JSON only
- No markdown
- No code blocks

Document: ${filename}

Text:
${truncatedText}
`

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt
  })

  const raw = response.candidates?.[0]?.content?.parts?.[0]?.text || ""

  console.log("Gemini summary raw:", raw)

  let parsed

  try {
    parsed = JSON.parse(raw)
  } catch (err) {
    console.error("Failed to parse summary JSON:", raw)

    return {
      title: "AI Financial Briefing",
      summary: "Summary generation failed.",
      keyMetrics: [],
      majorRisks: [],
      managementTone: "",
      redFlags: []
    }
  }

  return parsed
}