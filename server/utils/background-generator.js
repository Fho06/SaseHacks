import { GoogleGenAI } from "@google/genai"

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
})

export async function generateBackground(prompt) {

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: `
Create a minimal SVG slide background for a presentation.

Style:
- consulting firm presentation
- gradient shapes
- abstract geometry
- subtle
- dark financial theme

Description:
${prompt}

Return ONLY the SVG code.
`
  })

  const text =
    response.candidates?.[0]?.content?.parts?.[0]?.text || ""

  const svg = text
    .replace(/```svg/g, "")
    .replace(/```/g, "")
    .trim()

  return Buffer.from(svg).toString("base64")
}