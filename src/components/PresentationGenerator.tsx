"use client"

import { useMemo, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:5050"

type Slide = {
  type: "title" | "bullets" | "insight" | "metric" | "twoColumn" | "chart" | string
  title: string
  subtitle?: string
  bullets?: string[]
  text?: string
  background?: "gradient" | "dark" | "light"
  backgroundImage?: string
  layout?: "center" | "left"
  value?: string
  change?: string
  left?: string[]
  right?: string[]
  labels?: string[]
  values?: number[]
}

type SlideDeck = {
  title: string
  theme?: "corporate" | "dark" | "minimal"
  accentColor?: string
  slides: Slide[]
}

export default function PresentationGenerator({
  briefing
}: {
  briefing: any
}) {
  const [slides, setSlides] = useState<SlideDeck | null>(null)
  const [prompt, setPrompt] = useState("")
  const [loading, setLoading] = useState(false)
  const [slideIndex, setSlideIndex] = useState(0)
  const [slidesCache, setSlidesCache] = useState<Record<string, SlideDeck>>({})

  const briefingKey = useMemo(() => {
    return JSON.stringify(briefing)
  }, [briefing])

  useEffect(() => {
    if (!briefingKey) return

    const cached = slidesCache[briefingKey]

    if (cached) {
      setSlides(cached)
      setSlideIndex(0)
    } else {
      setSlides(null)
    }

    setPrompt("")
  }, [briefingKey, slidesCache])

  async function generateSlides() {
    setLoading(true)

    try {
      const res = await fetch(
        `${API_BASE_URL}/presentation/generate-presentation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            briefing,
            instructions: prompt.trim() || undefined,
            existingSlides: slides || undefined
          })
        }
      )

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data?.error || "Failed to generate slides")
      }

      if (!data || !Array.isArray(data.slides)) {
        throw new Error("Invalid slide deck returned from server")
      }

      setSlides(data)

      setSlidesCache((prev) => ({
        ...prev,
        [briefingKey]: data
      }))

      if (!slides) {
        setSlideIndex(0)
      }
    } catch (err) {
      console.error("slide generation failed", err)
    } finally {
      setLoading(false)
    }
  }

  async function exportSlides() {
    if (!slides) return

    try {
      const res = await fetch(
        `${API_BASE_URL}/presentation/export-presentation`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(slides)
        }
      )

      if (!res.ok) {
        throw new Error("Failed to export PowerPoint")
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)

      const a = document.createElement("a")
      a.href = url
      a.download = "analysis.pptx"
      document.body.appendChild(a)
      a.click()
      a.remove()

      window.URL.revokeObjectURL(url)
    } catch (err) {
      console.error("ppt export failed", err)
    }
  }

  const currentSlide = useMemo(() => {
    if (!slides || slides.slides.length === 0) return null
    return slides.slides[slideIndex]
  }, [slides, slideIndex])

  function getSlideBackgroundClass(slide: Slide, theme?: SlideDeck["theme"]) {
    if (slide.background === "gradient") {
      return "bg-gradient-to-br from-blue-700 via-indigo-700 to-slate-900 text-white"
    }

    if (slide.background === "dark") {
      return "bg-slate-950 text-white"
    }

    if (theme === "dark") {
      return "bg-slate-950 text-white"
    }

    if (theme === "minimal") {
      return "bg-slate-50 text-slate-900"
    }

    return "bg-white text-slate-900"
  }

  function getAccentColorClass(theme?: SlideDeck["theme"]) {
    if (theme === "dark") return "bg-blue-400"
    if (theme === "minimal") return "bg-slate-400"
    return "bg-blue-600"
  }

  function renderChartSlide(slide: Slide) {
    const values = slide.values ?? []
    const labels = slide.labels ?? []

    if (values.length === 0 || labels.length === 0) {
      return (
        <div className="relative z-10 flex h-full items-center justify-center">
          <p className="text-lg opacity-70">No chart data available.</p>
        </div>
      )
    }

    const maxValue = Math.max(...values, 1)

    return (
      <div className="relative z-10 flex h-full flex-col">
        <div className="mb-8">
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
            {slide.title}
          </h2>
          <div
            className={`mt-4 h-1 w-28 rounded ${getAccentColorClass(slides?.theme)}`}
          />
        </div>

        <div className="mt-4 flex flex-1 items-end gap-6 rounded-2xl border border-white/10 bg-black/10 p-8 backdrop-blur-sm">
          {values.map((value, index) => {
            const heightPercent = Math.max((value / maxValue) * 100, 10)

            return (
              <div
                key={`${labels[index]}-${index}`}
                className="flex flex-1 flex-col items-center justify-end gap-3"
              >
                <div className="text-sm font-medium opacity-80">{value}</div>

                <div className="flex h-72 w-full items-end justify-center">
                  <div
                    className="w-full max-w-16 rounded-t-xl bg-white/80 shadow-lg transition-all"
                    style={{ height: `${heightPercent}%` }}
                  />
                </div>

                <div className="text-sm text-center opacity-80">
                  {labels[index]}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  function renderSlide(slide: Slide) {
    const titleAlignClass =
      slide.layout === "left" ? "text-left" : "text-center"
    const accentAlignClass =
      slide.layout === "left" ? "mr-auto" : "mx-auto"

    const isDarkSurface =
      slide.background === "dark" ||
      slide.background === "gradient" ||
      slides?.theme === "dark"

    const accentLineClass = isDarkSurface
      ? "bg-white/70"
      : getAccentColorClass(slides?.theme)

    if (slide.type === "chart") {
      return renderChartSlide(slide)
    }

    return (
      <div className="relative z-10 flex h-full flex-col justify-center">
        <h2
          className={`text-4xl md:text-5xl font-bold mb-4 tracking-tight ${titleAlignClass}`}
        >
          {slide.title}
        </h2>

        <div
          className={`w-24 h-1 rounded mb-8 ${accentLineClass} ${accentAlignClass}`}
        />

        {slide.bullets && (
          <ul className="mt-6 space-y-4 text-xl leading-relaxed list-disc pl-10">
            {slide.bullets.map((bullet, index) => (
              <li key={index}>{bullet}</li>
            ))}
          </ul>
        )}

        {slide.text && (
          <p
            className={`mt-6 text-xl leading-relaxed ${
              slide.layout === "left" ? "text-left" : "text-center"
            }`}
          >
            {slide.text}
          </p>
        )}
      </div>
    )
  }

  return (
    <div className="mt-10 space-y-6">
      {!slides && (
        <Button onClick={generateSlides} disabled={loading}>
          {loading ? "Generating..." : "Generate Presentation"}
        </Button>
      )}

      {slides && currentSlide && (
        <div className="space-y-6">
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Improve slides (ex: focus on risks, make slides shorter)"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
          />

          <Button
            onClick={() => {
              setSlidesCache((prev) => {
                const next = { ...prev }
                delete next[briefingKey]
                return next
              })
              generateSlides()
            }}
            variant="secondary"
            disabled={loading}
          >
            {loading ? "Regenerating..." : "Regenerate Slides"}
          </Button>

          <div
            className={`relative aspect-[16/9] w-full max-w-6xl mx-auto overflow-hidden rounded-[28px] shadow-2xl p-10 md:p-16 transition-all ${getSlideBackgroundClass(
              currentSlide,
              slides.theme
            )}`}
          >
            {renderSlide(currentSlide)}
          </div>

          <div className="flex justify-center items-center gap-6">
            <Button
              variant="outline"
              onClick={() => setSlideIndex((prev) => Math.max(prev - 1, 0))}
              disabled={slideIndex === 0}
            >
              Previous
            </Button>

            <span className="text-sm text-muted-foreground">
              Slide {slideIndex + 1} / {slides.slides.length}
            </span>

            <Button
              variant="outline"
              onClick={() =>
                setSlideIndex((prev) =>
                  Math.min(prev + 1, slides.slides.length - 1)
                )
              }
              disabled={slideIndex === slides.slides.length - 1}
            >
              Next
            </Button>
          </div>

          <div className="flex justify-center">
            <Button
              onClick={exportSlides}
              className="bg-primary text-primary-foreground"
            >
              Download PowerPoint
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}