"use client"

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import FileUpload, { type UploadedDocument } from "@/components/FileUpload"
import DocumentChatWorkspace from "@/components/DocumentChatWorkspace"
import {
  ArrowRight,
  AlertCircle,
  Upload,
  MessageSquare,
  Award,
  BarChart3,
  Database,
  Zap,
  Shield,
  Volume2,
  CheckCircle2,
  Code2,
  Github,
  Sun,
  Moon,
} from "lucide-react"
import PresentationGenerator from "@/components/PresentationGenerator"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5050"

type AskSource = {
  documentId?: string
  filename?: string
  chunkIndex?: number
}

type AskResponse = {
  answer: string
  sources: AskSource[]
}

type FinancialSummary = {
  title?: string
  summary: string
  keyMetrics?: string[]
  majorRisks?: string[]
  managementTone?: string
  redFlags?: string[]
}

function formatAnswerText(raw: string) {
  return raw
    .replace(/\[\d+\]/g, "")
    .replace(/\*\*/g, "")
    .replace(/(^|\s)\*(?=\S)/g, "$1")
    .replace(/[•·]/g, "")
    .replace(/\s+,/g, ",")
    .replace(/\s+\./g, ".")
    .replace(/\s+:/g, ":")
    .replace(/\s+;/g, ";")
    .replace(/\s+([!?])/g, "$1")
    .replace(/,\s*,+/g, ", ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 hidden dark:block" />
      <Moon className="h-4 w-4 block dark:hidden" />
    </button>
  )
}

const TechStackBadge = ({ label, icon: Icon }: { label: string; icon: ReactNode }) => (
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/50 text-sm text-foreground">
    {Icon}
    <span>{label}</span>
  </div>
)

export default function FinVoiceLanding() {
  const [promptInput, setPromptInput] = useState("")
  const [sessionId, setSessionId] = useState("")
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([])
  const [uploadedCount, setUploadedCount] = useState(0)
  const [isAsking, setIsAsking] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)
  const [askResponse, setAskResponse] = useState<AskResponse | null>(null)
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [isResummarizing, setIsResummarizing] = useState(false)
  const [documentId, setDocumentId] = useState<string | null>(null)
  const chatInputRef = useRef<HTMLInputElement | null>(null)
  const chatSectionRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (uploadedCount > 0 && chatSectionRef.current) {
      chatSectionRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start"
      })
    }
  }, [uploadedCount])
  const [conversationMode, setConversationMode] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [ttsLoading, setTtsLoading] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  function stopSpeech() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel()
      utteranceRef.current = null
    }

    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      audioRef.current = null
    }
    if (audioUrlRef.current) {
      URL.revokeObjectURL(audioUrlRef.current)
      audioUrlRef.current = null
    }
    setIsSpeaking(false)
  }

  function speakWithBrowserTts(text: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      throw new Error("Speech synthesis is unavailable in this browser")
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.pitch = 1
    utterance.volume = 1
    utterance.onstart = () => setIsSpeaking(true)
    utterance.onend = () => setIsSpeaking(false)
    utterance.onerror = () => setIsSpeaking(false)

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  async function speakText(text: string) {
    const cleaned = text.trim()
    if (!cleaned || !ttsEnabled) return

    stopSpeech()
    setTtsLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/speech`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: cleaned })
      })
      if (!response.ok) {
        let message = "Unable to generate speech"
        try {
          const payload = await response.json()
          if (typeof payload?.error === "string" && payload.error.trim()) {
            message = payload.error.trim()
          }
        } catch {
          // keep fallback message when body is not JSON
        }
        throw new Error(message)
      }

      const blob = await response.blob()
      if (!blob.size) {
        throw new Error("Received empty audio response")
      }
      const audioUrl = URL.createObjectURL(blob)
      const audio = new Audio(audioUrl)
      audioUrlRef.current = audioUrl
      audioRef.current = audio

      audio.onended = () => setIsSpeaking(false)
      audio.onpause = () => setIsSpeaking(false)
      audio.onplay = () => setIsSpeaking(true)

      await audio.play()
    } catch (error) {
      try {
        speakWithBrowserTts(cleaned)
        const reason = error instanceof Error ? error.message : "ElevenLabs unavailable"
        setAskError(`ElevenLabs unavailable (${reason}). Using browser voice.`)
      } catch (fallbackError) {
        const reason = fallbackError instanceof Error ? fallbackError.message : "Unable to play speech"
        setAskError(reason)
        stopSpeech()
      }
    } finally {
      setTtsLoading(false)
    }
  }

  useEffect(() => {
    return () => stopSpeech()
  }, [])

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null) {
      const element = target as HTMLElement | null
      if (!element) return false
      const tag = element.tagName
      return tag === "INPUT" || tag === "TEXTAREA" || element.isContentEditable
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (isTypingTarget(event.target)) return

      if (event.altKey && event.key.toLowerCase() === "m") {
        event.preventDefault()
        setTtsEnabled((prev) => {
          const next = !prev
          if (!next) stopSpeech()
          return next
        })
      }

      if (event.altKey && event.key.toLowerCase() === "p") {
        event.preventDefault()
        if (isSpeaking) {
          stopSpeech()
          return
        }
        if (askResponse?.answer && ttsEnabled && !ttsLoading) {
          void speakText(askResponse.answer)
        }
      }

      if (event.key === "Escape" && isSpeaking) {
        event.preventDefault()
        stopSpeech()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [askResponse?.answer, isSpeaking, ttsEnabled, ttsLoading])

  
  async function handlePromptSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedPrompt = promptInput.trim()
    if (!trimmedPrompt) return
    if (!sessionId || uploadedCount === 0) {
      setAskError("Upload at least one document in this session before asking a question.")
      return
    }

    setIsAsking(true)
    setAskError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question: trimmedPrompt,
          sessionId,
          hybrid: true,
          limit: 5
        })
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to get answer")
      }

      setAskResponse({
        answer: formatAnswerText(payload.answer || ""),
        sources: Array.isArray(payload.sources) ? payload.sources : []
      })
      if (ttsEnabled && payload.answer) {
        void speakText(formatAnswerText(payload.answer))
      }
    } catch (error) {
      setAskError(error instanceof Error ? error.message : "Failed to get answer")
    } finally {
      setIsAsking(false)
    }
  }

  async function handleResummarize(documentId: string) {
    setIsResummarizing(true)

    try {
      const res = await fetch(`${API_BASE_URL}/resummarize/${documentId}`, {
        method: "POST"
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data?.error || "Failed to regenerate summary")

      setSummary(data)

    } catch (err) {
      console.error("Resummarize failed:", err)
    } finally {
      setIsResummarizing(false)
    }
  }

  if (conversationMode) {
    return (
      <DocumentChatWorkspace
        initialSessionId={sessionId}
        initialUploadedDocs={uploadedDocs}
        onBack={() => setConversationMode(false)}
      />
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="FinVoice logo" className="h-8 w-8 rounded-md object-contain" />
              <span className="text-lg font-semibold tracking-tight hidden sm:block">FinVoice AI</span>
            </div>
            <nav className="hidden lg:flex items-center gap-6">
              <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                How It Works
              </a>
              <a href="#use-cases" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Use Cases
              </a>
              <a href="#tech-stack" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Tech Stack
              </a>
              <a href="#trust" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                Trust & Safety
              </a>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <a
              href="https://github.com"
              className="hidden sm:flex items-center justify-center h-9 w-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="GitHub"
            >
              <Github className="h-4 w-4" />
            </a>
            <Button asChild size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <a href="#demo">
                Try Demo
                <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-32">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <div className="mb-6 flex justify-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                RAG-Powered Financial Intelligence
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 text-balance leading-tight">
              Turn dense filings into grounded, voice-enabled financial insight
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto text-balance mb-8 leading-relaxed">
              Upload 10-Ks, 10-Qs, earnings call transcripts, and analyst notes. Ask questions in natural language. Get source-backed answers with citations and optional voice playback.
            </p>
            <div className="max-w-3xl mx-auto mb-8 space-y-4">
              <div className="rounded-2xl border border-border/50 bg-card/40 p-3 text-left outline-accent">
                <p className="mb-2 text-sm font-medium">Upload financial documents for context</p>
                <FileUpload
                  onSessionUpdate={({ sessionId: nextSessionId, uploadedDocs, summaries }) => {
                    setSessionId(nextSessionId)
                    setUploadedDocs(uploadedDocs)
                    setUploadedCount(uploadedDocs.length)

                    if (uploadedDocs.length > 0) {
                      setDocumentId(uploadedDocs[0].documentId)
                    }

                    if (Array.isArray(summaries) && summaries.length > 0) {
                      setSummary(summaries[0])
                    }
                  }}
                />
              </div>
              <div ref={chatSectionRef} className="scroll-mt-24">
                <form onSubmit={handlePromptSubmit} className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    value={promptInput}
                    onChange={(event) => setPromptInput(event.target.value)}
                    placeholder="Ask FinVoice a question about your documents..."
                    className="h-14 flex-1 rounded-md border border-border bg-secondary/20 px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 outline-input"
                  />
                  <Button type="submit" size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                    {isAsking ? "Asking..." : "Ask Gemini"}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </form>
              </div>
              <p className="text-xs text-muted-foreground text-left sm:text-center">
                {askError
                  ? askError
                  : uploadedCount > 0
                    ? `Session ready (${uploadedCount} uploaded document${uploadedCount > 1 ? "s" : ""}).`
                    : "Upload documents to activate RAG-backed question answering."}
              </p>

              {uploadedCount > 0 && !summary && (
                <div className="rounded-xl border border-border/60 bg-secondary/25 p-4 text-sm text-muted-foreground">
                  Generating AI financial briefing...
                </div>
              )}
              {summary && (
                <div className="rounded-xl border border-border/60 bg-secondary/25 p-4 text-left mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {summary.title || "AI Financial Briefing"}
                    </p>

                    <button
                      onClick={() => documentId && handleResummarize(documentId)}
                      disabled={!documentId || isResummarizing}
                      className="text-xs px-2 py-1 rounded border border-border hover:bg-secondary/40"
                    >
                      {isResummarizing ? "Regenerating..." : "Resummarize"}
                    </button>
                  </div>

                  <p className="text-sm mb-4">{summary.summary}</p>

                  <div className="grid md:grid-cols-2 gap-4 text-sm">

                    <div>
                      <p className="font-semibold mb-1">Key Metrics</p>
                      <ul className="list-disc pl-4 text-muted-foreground">
                        {summary.keyMetrics?.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="font-semibold mb-1">Major Risks</p>
                      <ul className="list-disc pl-4 text-muted-foreground">
                        {summary.majorRisks?.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <p className="font-semibold mb-1">Management Tone</p>
                      <p className="text-muted-foreground">{summary.managementTone}</p>
                    </div>

                    <div>
                      <p className="font-semibold mb-1">Red Flags</p>
                      <ul className="list-disc pl-4 text-muted-foreground">
                        {summary.redFlags?.map((m, i) => (
                          <li key={i}>{m}</li>
                        ))}
                      </ul>
                    </div>

                  </div>
                </div>
              )}
              
              {summary && (
                <PresentationGenerator briefing={summary} />
              )}
              {askResponse ? (
                <div className="rounded-xl border border-border/60 bg-secondary/25 p-4 text-left">
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Gemini Answer</p>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setTtsEnabled((prev) => !prev)}
                        className={`rounded-md border px-2 py-1 text-xs transition-colors ${
                          ttsEnabled
                            ? "border-primary/40 bg-primary/15 text-primary"
                            : "border-border/60 bg-background/40 text-muted-foreground"
                        }`}
                        title="Toggle text to speech (Alt+M)"
                      >
                        TTS {ttsEnabled ? "On" : "Off"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (isSpeaking) {
                            stopSpeech()
                          } else if (askResponse.answer && ttsEnabled && !ttsLoading) {
                            void speakText(askResponse.answer)
                          }
                        }}
                        disabled={!ttsEnabled || ttsLoading || !askResponse.answer}
                        className="rounded-md border border-border/60 bg-background/40 px-2 py-1 text-xs text-foreground transition-colors enabled:hover:bg-secondary/40 disabled:cursor-not-allowed disabled:opacity-50"
                        title="Play or stop speech (Alt+P, Esc)"
                      >
                        {ttsLoading ? "Loading voice..." : isSpeaking ? "Stop Voice" : "Play Voice"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          stopSpeech()
                          setConversationMode(true)
                        }}
                        className="rounded-md border border-border/60 bg-background/40 px-2 py-1 text-xs text-foreground transition-colors hover:bg-secondary/40"
                        title="Open recurring conversation mode"
                      >
                        Conversation Mode
                      </button>
                    </div>
                  </div>
                  <p className="text-sm leading-relaxed mb-3">{askResponse.answer}</p>
                  <p className="mb-3 text-[11px] text-muted-foreground">
                    Shortcuts: `Alt+M` toggle TTS, `Alt+P` play/stop latest answer, `Esc` stop.
                  </p>
                  {askResponse.sources.length > 0 ? (
                    <details className="rounded-md border border-border/60 bg-background/40 p-2">
                      <summary className="cursor-pointer text-xs uppercase tracking-wide text-muted-foreground">
                        View Citations ({askResponse.sources.length})
                      </summary>
                      <div className="space-y-1 pt-2">
                        {askResponse.sources.slice(0, 8).map((source, idx) => (
                          <p key={`${source.documentId || "doc"}-${idx}`} className="text-xs text-muted-foreground">
                            [{idx + 1}] {source.filename || "unknown"} (chunk {source.chunkIndex ?? "n/a"})
                          </p>
                        ))}
                      </div>
                    </details>
                  ) : null}
                </div>
              ) : null}
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <TechStackBadge label="MongoDB Atlas" icon={<Database className="h-3.5 w-3.5 text-primary" />} />
              <TechStackBadge label="Gemini API" icon={<Zap className="h-3.5 w-3.5 text-primary" />} />
              <TechStackBadge label="ElevenLabs" icon={<Volume2 className="h-3.5 w-3.5 text-primary" />} />
              <TechStackBadge label="RAG-Powered" icon={<Award className="h-3.5 w-3.5 text-primary" />} />
            </div>
          </div>

        </div>
      </section>

      {/* Problem Section */}
      <section className="py-24 border-t border-border/30 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">The financial intelligence challenge</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-balance">
              Financial documents are dense, slow to review, and generic AI tools hallucinate. FinVoice AI solves this with explainable, grounded analysis.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: BarChart3,
                title: "Document Overload",
                problem: "10-Ks, 10-Qs, and earnings transcripts are dense and time-consuming to analyze.",
                solution: "Instant AI parsing and structured summaries.",
              },
              {
                icon: AlertCircle,
                title: "Untrusted AI Outputs",
                problem: "Generic AI models hallucinate or lack source grounding in financial contexts.",
                solution: "Every answer backed by specific citations from source documents.",
              },
              {
                icon: Zap,
                title: "Slow Due Diligence",
                problem: "Manual comparison and deep-dive analysis takes hours or days.",
                solution: "Real-time insights and red-flag detection across filings.",
              },
            ].map((item, i) => (
              <Card key={i} className="bg-secondary/30 border-border/50">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{item.problem}</p>
                  <p className="text-sm text-primary font-medium">{item.solution}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">Powerful features for financial research</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-balance">
              Built for equity researchers, analysts, and finance professionals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Upload, title: "Upload Financial PDFs", desc: "10-Ks, 10-Qs, earnings transcripts, analyst reports." },
              {
                icon: MessageSquare,
                title: "Natural Language Queries",
                desc: "Ask questions in plain English, get structured insights.",
              },
              {
                icon: Award,
                title: "Citation-Backed Answers",
                desc: "Every response includes source references and page numbers.",
              },
              {
                icon: Volume2,
                title: "Voice Playback",
                desc: "Listen to answers with ElevenLabs voice synthesis.",
              },
              {
                icon: Zap,
                title: "AI Summaries",
                desc: "Auto-generate executive summaries and key takeaways.",
              },
              {
                icon: BarChart3,
                title: "Red-Flag Detection",
                desc: "Highlight risks, anomalies, and material changes.",
              },
              {
                icon: Database,
                title: "Fast Search",
                desc: "Vector search across earnings calls and filings instantly.",
              },
              {
                icon: Code2,
                title: "Structured Insights",
                desc: "Export findings in JSON for integration with your tools.",
              },
            ].map((feature, i) => (
              <Card key={i} className="bg-card/50 border-border/50 hover:border-primary/30 transition-all group">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold mb-2">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">How it works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-balance">
              Five-step RAG pipeline for grounded financial analysis.
            </p>
          </div>

          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-6">
            {[
              { num: "1", title: "Upload", desc: "Drop filing or transcript" },
              { num: "2", title: "Parse", desc: "Chunk and index content" },
              { num: "3", title: "Retrieve", desc: "RAG finds relevant evidence" },
              { num: "4", title: "Generate", desc: "Gemini creates grounded answer" },
              { num: "5", title: "Deliver", desc: "Voice or text with citations" },
            ].map((item, i) => (
              <div key={i} className="text-center relative">
                <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mx-auto mb-4">
                  <span className="text-lg font-bold text-primary">{item.num}</span>
                </div>
                <h3 className="text-sm font-semibold mb-2">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
                {i < 4 && (
                  <div className="hidden md:block absolute top-6 -right-3 w-6 h-0.5 bg-gradient-to-r from-primary/30 to-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">Built for every finance professional</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                title: "Equity Research",
                desc: "Compare earnings trends, track management commentary shifts, and flag guidance changes across multiple quarters.",
              },
              {
                title: "Earnings Call Copilot",
                desc: "Instant Q&A on earnings calls. Search for specific mentions, tonality shifts, and forward guidance.",
              },
              {
                title: "Finance Learning",
                desc: "Student-friendly queries. Learn how to read 10-Ks with guided analysis and contextual explanations.",
              },
              {
                title: "M&A Due Diligence",
                desc: "Accelerate target company analysis. Extract key metrics, flag risks, and compare to market peers.",
              },
            ].map((useCase, i) => (
              <Card key={i} className="bg-card/50 border-border/50 hover:border-primary/30 transition-all">
                <CardContent className="p-6">
                  <h3 className="text-base font-semibold mb-2">{useCase.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{useCase.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section id="tech-stack" className="py-24 scroll-mt-24 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">Modern fintech stack</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-balance">
              Built with cutting-edge open-source tools and APIs for performance, reliability, and explainability.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-5xl mx-auto mb-12">
            {[
              "Next.js",
              "TypeScript",
              "MongoDB Atlas",
              "Atlas Vector Search",
              "Gemini API",
              "ElevenLabs",
              "Tailwind CSS",
              "shadcn/ui",
              "Vercel",
              "RAG",
            ].map((tech) => (
              <div
                key={tech}
                className="px-4 py-3 rounded-lg border border-border/50 bg-card/50 text-center text-sm font-medium text-foreground hover:border-primary/30 transition-colors"
              >
                {tech}
              </div>
            ))}
          </div>

          <div className="max-w-3xl mx-auto bg-secondary/30 border border-border/50 rounded-lg p-8">
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong>Architecture:</strong> FinVoice AI uses MongoDB Atlas for document storage and vector embeddings, Gemini for semantic understanding and answer generation, and ElevenLabs for natural voice synthesis. Our RAG pipeline ensures every answer is grounded in source documents, not hallucinations. Deployed on Vercel for sub-100ms response times and built with Next.js for seamless full-stack development.
            </p>
          </div>
        </div>
      </section>

      {/* Trust & Safety */}
      <section id="trust" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">Built for trust and transparency</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-balance">
              FinVoice AI is a research assistant, not financial advice.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: CheckCircle2,
                title: "Source-Backed Answers",
                desc: "Every response includes specific citations. Know exactly where claims originate.",
              },
              {
                icon: Shield,
                title: "Explainable Workflow",
                desc: "See the retrieval process and reasoning. No black-box answers.",
              },
              {
                icon: Award,
                title: "Research Tool Only",
                desc: "FinVoice AI does not provide investment advice. It accelerates research and due diligence.",
              },
            ].map((item, i) => (
              <Card key={i} className="bg-card/50 border-border/50">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="max-w-2xl mx-auto mt-12 p-6 bg-primary/5 border border-primary/20 rounded-lg text-center">
            <p className="text-xs text-muted-foreground italic">
              <strong>Disclaimer:</strong> FinVoice AI is a document intelligence and research assistant. It does not provide financial advice, investment recommendations, or analysis. Always verify findings with original documents and consult a financial advisor.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-2">
                <img src="/logo.png" alt="FinVoice logo" className="h-8 w-8 rounded-md object-contain" />
                <span className="font-semibold">FinVoice</span>
              </div>
              <p className="text-xs text-muted-foreground">Voice-enabled financial document intelligence.</p>
            </div>
            <div>
              <p className="text-xs font-semibold mb-3 text-foreground">Product</p>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>
                  <a href="#features" className="hover:text-foreground transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#tech-stack" className="hover:text-foreground transition-colors">
                    Tech Stack
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Demo
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold mb-3 text-foreground">Resources</p>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="https://github.com" className="hover:text-foreground transition-colors">
                    GitHub
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    API Reference
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold mb-3 text-foreground">Legal</p>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Privacy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Terms
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Disclaimer
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-border/30 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-xs text-muted-foreground text-center md:text-left">
              (c) 2024 FinVoice AI. Built for financial intelligence. Not investment advice.
            </p>
            <p className="text-xs text-muted-foreground">Hackathon MVP - Powered by RAG & Gemini</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
