function tryParseJson(value) {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  if (!trimmed) return null

  try {
    return JSON.parse(trimmed)
  } catch {
    return null
  }
}

export function getModelText(response) {
  const parts = response?.candidates?.[0]?.content?.parts
  if (Array.isArray(parts) && parts.length > 0) {
    const text = parts
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("\n")
      .trim()
    if (text) return text
  }

  if (typeof response?.text === "string" && response.text.trim()) {
    return response.text.trim()
  }

  return ""
}

export function parseModelJson(response) {
  const text = getModelText(response)
  if (!text) return null

  const direct = tryParseJson(text)
  if (direct) return direct

  const fencedBlocks = text.match(/```(?:json)?\s*[\s\S]*?```/gi) || []
  for (const block of fencedBlocks) {
    const cleaned = block.replace(/^```(?:json)?\s*/i, "").replace(/```$/i, "").trim()
    const parsed = tryParseJson(cleaned)
    if (parsed) return parsed
  }

  const firstBrace = text.indexOf("{")
  const lastBrace = text.lastIndexOf("}")
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    const candidate = text.slice(firstBrace, lastBrace + 1)
    const parsed = tryParseJson(candidate)
    if (parsed) return parsed
  }

  return null
}
