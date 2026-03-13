export type FinancialSummary = {
  title: string
  summary: string
  keyMetrics: string[]
  majorRisks: string[]
  managementTone: string
  redFlags: string[]
}

function normalizeList(value: unknown): string[] {
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
    return Object.entries(value as Record<string, unknown>)
      .map(([key, entryValue]) => {
        const trimmedValue = String(entryValue ?? "").trim()
        return trimmedValue ? `${key}: ${trimmedValue}` : key.trim()
      })
      .filter(Boolean)
  }

  return []
}

export function normalizeFinancialSummary(value: unknown): FinancialSummary | null {
  if (!value || typeof value !== "object") {
    return null
  }

  const source = value as Record<string, unknown>
  const summary = String(source.summary ?? "").trim()

  if (!summary) {
    return null
  }

  return {
    title: String(source.title ?? "AI Financial Briefing").trim() || "AI Financial Briefing",
    summary,
    keyMetrics: normalizeList(source.keyMetrics),
    majorRisks: normalizeList(source.majorRisks),
    managementTone: String(source.managementTone ?? "").trim(),
    redFlags: normalizeList(source.redFlags)
  }
}
