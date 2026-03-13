"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import FileUpload, { type UploadedDocument } from "@/components/documents/FileUpload"
import PresentationGenerator from "@/components/PresentationGenerator"
import { ArrowRight, Database, Zap, Volume2, Award, Mic } from "lucide-react"
import type { ReactNode } from "react"
import { normalizeFinancialSummary, type FinancialSummary } from "@/lib/summary"

const TechStackBadge = ({ label, icon: Icon }: { label: string; icon: ReactNode }) => (
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/50 text-sm text-foreground">
    {Icon}
    <span>{label}</span>
  </div>
)

type AskSource = {
  documentId?: string
  filename?: string
  chunkIndex?: number
}

type AskResponse = {
  answer: string
  sources: AskSource[]
}

type SessionUpdatePayload = {
  sessionId: string
  uploadedDocs: UploadedDocument[]
  summaries?: Array<FinancialSummary | null>
  action?: "upload" | "delete"
}

type HeroSectionProps = {
  sessionId: string
  uploadedDocs: UploadedDocument[]
  setSessionId: (id: string) => void
  setUploadedDocs: (docs: UploadedDocument[]) => void
  setDocumentId: (id: string | null) => void
  summary: FinancialSummary | null
  setSummary: (s: FinancialSummary | null) => void
  summaryError: string | null
  setSummaryError: (s: string | null) => void
  handleResummarize: (id: string) => Promise<void>
  documentId: string | null
  isResummarizing: boolean

  promptInput: string
  setPromptInput: (v: string) => void
  handlePromptSubmit: (e: React.FormEvent<HTMLFormElement>) => void
  isAsking: boolean

  askResponse: AskResponse | null
  ttsEnabled: boolean
  setTtsEnabled: React.Dispatch<React.SetStateAction<boolean>>
  stopSpeech: () => void
  isSpeaking: boolean
  ttsLoading: boolean
  speakText: (text: string) => Promise<void>

  uploadedCount: number
  statusMessage: string
  setConversationMode: (v: boolean) => void
}

export default function HeroSection(props: HeroSectionProps) {
  const {
    sessionId,
    uploadedDocs,
    setSessionId,
    setUploadedDocs,
    setDocumentId,
    summary,
    setSummary,
    summaryError,
    setSummaryError,
    handleResummarize,
    documentId,
    isResummarizing,
    promptInput,
    setPromptInput,
    handlePromptSubmit,
    isAsking,
    askResponse,
    ttsEnabled,
    setTtsEnabled,
    stopSpeech,
    isSpeaking,
    ttsLoading,
    speakText,
    statusMessage,
    setConversationMode
  } = props

  const [listening, setListening] = useState(false)
  const [activeDocId, setActiveDocId] = useState<string | null>(documentId)

  const resolvedActiveDocId = activeDocId || documentId || uploadedDocs[0]?.documentId || null
  const activeDoc = uploadedDocs.find((doc) => doc.documentId === resolvedActiveDocId) || null

  function syncSummaryFromSession(
    docs: UploadedDocument[],
    summaries: Array<FinancialSummary | null> | undefined,
    preferredDocId?: string | null
  ) {
    if (!Array.isArray(summaries) || summaries.length === 0 || docs.length === 0) {
      return false
    }

    const targetDocId = preferredDocId || activeDocId || documentId || docs[0]?.documentId
    const targetIndex = docs.findIndex((doc) => doc.documentId === targetDocId)
    const normalizedSummaries = summaries.map((item) => normalizeFinancialSummary(item))

    if (targetIndex >= 0 && normalizedSummaries[targetIndex]) {
      setSummary(normalizedSummaries[targetIndex])
      setSummaryError(null)
      return true
    }

    const firstSummary = normalizedSummaries.find(Boolean)
    if (firstSummary) {
      setSummary(firstSummary)
      setSummaryError(null)
      return true
    }

    return false
  }

  function startListening() {
    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition

    if (!SpeechRecognition) {
      alert("Speech recognition not supported")
      return
    }

    const recognition = new SpeechRecognition()

    recognition.lang = "en-US"
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript
      setPromptInput(transcript)
    }

    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)

    setListening(true)
    recognition.start()
  }

  function handleTabClick(nextDocId: string) {
    setActiveDocId(nextDocId)
    setDocumentId(nextDocId)
    setSummaryError(null)
  }

  return (
    <section className="pt-13">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center mb-2">
          <div className="flex justify-center">
            <img
              src="/landing_logo.png"
              alt="FinVoice"
              className="h-50 md:h-60 lg:h-90 object-contain"
            />
          </div>

          <p className="text-lg md:text-xl text-muted-foreground max-w-4xl mx-auto text-balance mb-6 leading-relaxed">
            Upload financial documents. Ask questions. Get source-backed answers.
          </p>

          <div className="max-w-3xl mx-auto mb-8 space-y-4">
            <div className="rounded-2xl border border-border/50 bg-card/40 p-3 text-left outline-accent">
              <p className="mb-2 text-sm font-medium">Upload financial documents for context</p>

              <FileUpload
                sessionId={sessionId || undefined}
                initialUploadedDocs={uploadedDocs}
                onSessionUpdate={({
                  sessionId: nextSessionId,
                  uploadedDocs: nextUploadedDocs,
                  summaries,
                  action
                }: SessionUpdatePayload) => {
                  setSessionId(nextSessionId)
                  setUploadedDocs(nextUploadedDocs)

                  if (nextUploadedDocs.length === 0) {
                    setActiveDocId(null)
                    setDocumentId(null)
                    setSummary(null)
                    setSummaryError(null)
                    return
                  }

                  if (action === "upload") {
                    const latestDoc = nextUploadedDocs[nextUploadedDocs.length - 1]
                    setActiveDocId(latestDoc.documentId)
                    setDocumentId(latestDoc.documentId)
                    setSummary(null)
                    setSummaryError(null)

                    syncSummaryFromSession(nextUploadedDocs, summaries, latestDoc.documentId)
                    return
                  }

                  const nextActiveDocId =
                    resolvedActiveDocId &&
                    nextUploadedDocs.some((doc) => doc.documentId === resolvedActiveDocId)
                      ? resolvedActiveDocId
                      : nextUploadedDocs[0].documentId

                  setActiveDocId(nextActiveDocId)
                  setDocumentId(nextActiveDocId)

                  syncSummaryFromSession(nextUploadedDocs, summaries, nextActiveDocId)
                }}
              />

              <div className="mt-3 text-xs text-muted-foreground">
                <p className="mb-1 font-medium text-foreground/80">Works best with:</p>
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <span>📄 10-K filings</span>
                  <span>📊 10-Q reports</span>
                  <span>🎤 Earnings call transcripts</span>
                  <span>📑 Analyst reports</span>
                </div>
              </div>
            </div>

            <div className="scroll-mt-24">
              <form onSubmit={handlePromptSubmit} className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={promptInput}
                    onChange={(event) => setPromptInput(event.target.value)}
                    placeholder="Ask FinVoice a question about your documents..."
                    className="h-14 w-full rounded-md border border-border bg-secondary/20 px-4 pr-12 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 outline-input"
                  />

                  <button
                    type="button"
                    onClick={startListening}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 transition-colors ${
                      listening ? "text-primary" : "text-muted-foreground hover:text-primary"
                    }`}
                    title={listening ? "Listening..." : "Start voice input"}
                  >
                    <Mic className="h-5 w-5" />
                  </button>
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {isAsking ? "Asking..." : "Ask Fin"}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </form>
            </div>

            <p className="text-xs text-muted-foreground text-left sm:text-center">
              {statusMessage}
            </p>

            {askResponse ? (
              <div className="rounded-xl border border-border/60 bg-secondary/25 p-4 text-left">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Gemini Answer
                  </p>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setTtsEnabled((prev) => {
                          const next = !prev
                          if (!next) {
                            stopSpeech()
                          }
                          return next
                        })
                      }
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
                        <p
                          key={`${source.documentId || "doc"}-${idx}`}
                          className="text-xs text-muted-foreground"
                        >
                          [{idx + 1}] {source.filename || "unknown"} (chunk{" "}
                          {source.chunkIndex ?? "n/a"})
                        </p>
                      ))}
                    </div>
                  </details>
                ) : null}
              </div>
            ) : null}

            {isResummarizing && !summary && (
              <div className="rounded-xl border border-border/60 bg-secondary/25 p-4 text-sm text-muted-foreground">
                Generating AI financial briefing...
              </div>
            )}

            {!isResummarizing && summaryError && (
              <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
                {summaryError}
                {resolvedActiveDocId ? (
                  <button
                    type="button"
                    onClick={() => void handleResummarize(resolvedActiveDocId)}
                    className="ml-3 rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive hover:bg-destructive/10"
                  >
                    Retry
                  </button>
                ) : null}
              </div>
            )}

            {uploadedDocs.length > 0 ? (
              <div className="rounded-xl border border-border/60 bg-secondary/20 p-3 text-left">
                <div className="mb-3 flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Financial Briefings ({uploadedDocs.length})
                  </p>
                  {activeDoc ? (
                    <p className="truncate text-xs text-muted-foreground max-w-[60%]">
                      Active: {activeDoc.filename}
                    </p>
                  ) : null}
                </div>

                <div className="flex gap-2 overflow-x-auto pb-1">
                  {uploadedDocs.map((doc) => {
                    const isActive = resolvedActiveDocId === doc.documentId

                    return (
                      <button
                        key={doc.documentId}
                        type="button"
                        onClick={() => void handleTabClick(doc.documentId)}
                        className={`shrink-0 rounded-md border px-3 py-1.5 text-xs transition ${
                          isActive
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background/50 text-foreground hover:bg-secondary/60"
                        }`}
                      >
                        {doc.filename}
                      </button>
                    )
                  })}
                </div>
              </div>
            ) : null}

            {summary ? (
              <div className="rounded-xl border border-border/60 bg-secondary/25 p-4 text-left mb-4">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">
                      {summary.title || "AI Financial Briefing"}
                    </p>
                    {activeDoc ? (
                      <p className="text-xs text-muted-foreground mt-1">{activeDoc.filename}</p>
                    ) : null}
                  </div>

                  <button
                    type="button"
                    onClick={() => resolvedActiveDocId && handleResummarize(resolvedActiveDocId)}
                    disabled={!resolvedActiveDocId || isResummarizing}
                    className="text-xs px-2 py-1 rounded border border-border hover:bg-secondary/40 disabled:opacity-50"
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
                    <p className="text-muted-foreground">{summary.managementTone || "—"}</p>
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
            ) : null}

            {summary ? <PresentationGenerator briefing={summary} /> : null}
          </div>

          <div className="flex flex-wrap justify-center gap-2">
            <TechStackBadge
              label="MongoDB Atlas"
              icon={<Database className="h-3.5 w-3.5 text-primary" />}
            />
            <TechStackBadge
              label="Gemini API"
              icon={<Zap className="h-3.5 w-3.5 text-primary" />}
            />
            <TechStackBadge
              label="ElevenLabs"
              icon={<Volume2 className="h-3.5 w-3.5 text-primary" />}
            />
            <TechStackBadge
              label="RAG-Powered"
              icon={<Award className="h-3.5 w-3.5 text-primary" />}
            />
          </div>
        </div>
      </div>
    </section>
  )
}
