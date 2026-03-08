import { GoogleGenAI } from "@google/genai"

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
})

export async function generateSlides(
  briefing,
  instructions = "",
  existingSlides = null
) {

  let prompt

  /*
  MODE 1 — GENERATE NEW PRESENTATION
  */

  if (!existingSlides) {

    prompt = `
You are an expert presentation designer creating investor-grade financial slides similar to decks used by consulting firms and investment banks.

Use the financial analysis below to generate a professional presentation.

Analysis:
${JSON.stringify(briefing)}

User instructions:
${instructions || "None"}

Return STRICT JSON only.

Schema:

{
 "title": "",
 "theme": "corporate",
 "accentColor": "#2563eb",
 "slides": [
  {
   "type": "title",
   "background": "gradient",
   "layout": "center",
   "title": "",
   "subtitle": ""
  },
  {
   "type": "bullets",
   "background": "dark",
   "layout": "left",
   "title": "",
   "bullets": []
  },
  {
   "type": "metric",
   "background": "dark",
   "title": "",
   "value": "",
   "change": ""
  },
  {
   "type": "twoColumn",
   "background": "dark",
   "title": "",
   "left": [],
   "right": []
  },
  {
   "type": "chart",
   "background": "dark",
   "title": "",
   "labels": [],
   "values": []
  },
  {
   "type": "insight",
   "background": "gradient",
   "layout": "center",
   "title": "",
   "text": ""
  }
 ]
}

Rules:

• Generate 6–8 slides total  
• Short executive bullet points  
• Bullet slides: 3–5 bullets  
• Each bullet < 15 words  
• Professional finance style  
• No paragraphs  

Slide guidelines:

• Title slide uses gradient background  
• Data slides use dark background  
• Metric slides highlight key financial numbers  
• Chart slides show trends (revenue, margins, growth)  

Return ONLY JSON.
`

  } else {

  /*
  MODE 2 — EDIT EXISTING SLIDES
  */

    prompt = `
You are editing an existing financial presentation.

Current slide deck:
${JSON.stringify(existingSlides)}

User request:
${instructions}

Modify the slides according to the request.

Rules:

• Maintain professional investor presentation style
• Keep slide structure valid
• Keep 6–8 slides total
• Bullet slides must have 3–5 bullets
• Each bullet < 15 words
• Do not remove required chart or metric fields

Return the FULL updated slide deck JSON.

Return ONLY JSON.
`
  }

  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt,
    config: {
      responseMimeType: "application/json"
    }
  })

  const text =
    response.candidates?.[0]?.content?.parts?.[0]?.text ||
    response.text ||
    ""

  /*
  Safety cleaning in case model wraps JSON
  */

  const jsonStart = text.indexOf("{")
  const jsonEnd = text.lastIndexOf("}") + 1
  const cleaned = text.slice(jsonStart, jsonEnd)

  try {

    const parsed = JSON.parse(cleaned)

    if (!parsed || !Array.isArray(parsed.slides)) {
      throw new Error("Invalid slide deck returned")
    }

    return parsed

  } catch (err) {

    console.error("Gemini returned invalid JSON:", cleaned)

    throw new Error("Slide generation failed")
  }
}