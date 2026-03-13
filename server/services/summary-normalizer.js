function normalizeList(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item ?? "").trim())
      .filter(Boolean)
  }

  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed ? [trimmed] : []
  }

  if (value && typeof value === "object") {
    return Object.entries(value)
      .map(([key, entryValue]) => {
        const trimmedValue = String(entryValue ?? "").trim()
        return trimmedValue ? `${key}: ${trimmedValue}` : String(key).trim()
      })
      .filter(Boolean)
  }

  return []
}

export function normalizeFinancialSummary(value) {
  if (!value || typeof value !== "object") {
    return null
  }

  const summary = String(value.summary ?? "").trim()

  if (!summary) {
    return null
  }

  return {
    title: String(value.title ?? "AI Financial Briefing").trim() || "AI Financial Briefing",
    summary,
    keyMetrics: normalizeList(value.keyMetrics),
    majorRisks: normalizeList(value.majorRisks),
    managementTone: String(value.managementTone ?? "").trim(),
    redFlags: normalizeList(value.redFlags)
  }
}
