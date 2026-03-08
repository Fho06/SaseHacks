"use client"

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react"
import FileUpload, { type UploadedDocument } from "@/components/documents/FileUpload"
import DocumentChatWorkspace from "@/components/documents/DocumentChatWorkspace"
import { getAuthHeader } from "@/lib/api-auth"
import { useAuth } from "@/providers/AuthProvider"
import Navbar from "@/components/landing/Navbar"
import ProblemSection from "@/components/landing/ProblemSection"
import HeroSection from "@/components/landing/HeroSection"
import FeaturesSection from "@/components/landing/FeatureSection"
import HowItWorksSection from "@/components/landing/HowItWorksSection"
import UseCasesSection from "@/components/landing/UseCasesSection"
import TechStackSection from "@/components/landing/TechStackSection"
import TrustSection from "@/components/landing/TrustSection"
import Footer from "@/components/landing/Footer"

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
    .replace(/[\u2022\u00B7]/g, "")
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

const TechStackBadge = ({ label, icon: Icon }: { label: string; icon: ReactNode }) => (
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/50 text-sm text-foreground">
    {Icon}
    <span>{label}</span>
  </div>
)

export default function FinVoiceLanding() {
  const { user } = useAuth()
  const [promptInput, setPromptInput] = useState("")
  const [sessionId, setSessionId] = useState("")
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([])
  const [loadError, setLoadError] = useState<string | null>(null)
  const [isAsking, setIsAsking] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)
  const [askResponse, setAskResponse] = useState<AskResponse | null>(null)
  const [summary, setSummary] = useState<FinancialSummary | null>(null)
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const [isResummarizing, setIsResummarizing] = useState(false)
  const [documentId, setDocumentId] = useState<string | null>(null)
  const [ttsMessage, setTtsMessage] = useState<string | null>(null)
  const uploadedCount = uploadedDocs.length
  const statusMessage =
    loadError ||
    askError ||
    ttsMessage ||
    (uploadedCount > 0
      ? `Session ready (${uploadedCount} uploaded document${uploadedCount > 1 ? "s" : ""}).`
      : "Upload documents to activate RAG-backed question answering.")

  useEffect(() => {
    const controller = new AbortController()
    let cancelled = false

    async function loadUserDocuments() {
      if (!user) {
        setSessionId("")
        setUploadedDocs([])
        setSummary(null)
        setSummaryError(null)
        setDocumentId(null)
        setLoadError(null)
        return
      }

      try {
        const response = await fetch(`${API_BASE_URL}/documents`, {
          method: "GET",
          headers: {
            ...(await getAuthHeader())
          },
          signal: controller.signal
        })
        if (cancelled) return

        const payload = await response.json()
        if (!response.ok) {
          throw new Error(payload?.error || "Failed to load documents")
        }

        const docs: UploadedDocument[] = Array.isArray(payload?.files) ? payload.files : []
        if (cancelled) return

        setUploadedDocs(docs)
        setSessionId(docs[0]?.sessionId || "")
        setDocumentId(docs[0]?.documentId || null)
        setSummary(docs[0]?.summary || null)
        setSummaryError(null)
        setLoadError(null)
      } catch (error) {
        if (cancelled) return
        if (error instanceof DOMException && error.name === "AbortError") {
          return
        }
        setLoadError(error instanceof Error ? error.message : "Failed to load documents")
      }
    }

    void loadUserDocuments()

    return () => {
      cancelled = true
      controller.abort()
    }
  }, [user])
  const [conversationMode, setConversationMode] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [ttsLoading, setTtsLoading] = useState(false)
  const [isSpeaking, setIsSpeaking] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const stopSpeech = useCallback(() => {
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
  }, [])

  const speakWithBrowserTts = useCallback((text: string) => {
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
  }, [])

  const speakText = useCallback(
    async (text: string) => {
      const cleaned = text.trim()
      if (!cleaned || !ttsEnabled) return

      stopSpeech()
      setTtsLoading(true)
      setTtsMessage(null)

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
          setTtsMessage(`ElevenLabs unavailable (${reason}). Using browser voice.`)
        } catch (fallbackError) {
          const reason = fallbackError instanceof Error ? fallbackError.message : "Unable to play speech"
          setTtsMessage(reason)
          stopSpeech()
        }
      } finally {
        setTtsLoading(false)
      }
    },
    [speakWithBrowserTts, stopSpeech, ttsEnabled]
  )

  useEffect(() => {
    return () => stopSpeech()
  }, [stopSpeech])

  useEffect(() => {
    if (!ttsEnabled) {
      stopSpeech()
      setTtsMessage(null)
    }
  }, [ttsEnabled, stopSpeech])

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
  }, [askResponse?.answer, isSpeaking, speakText, stopSpeech, ttsEnabled, ttsLoading])

  
  async function handlePromptSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmedPrompt = promptInput.trim()
    if (!trimmedPrompt) return
    if (uploadedCount === 0) {
      setAskError("Upload at least one document before asking a question.")
      return
    }

    setIsAsking(true)
    setAskError(null)

    try {
      const response = await fetch(`${API_BASE_URL}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeader())
        },
        body: JSON.stringify({
          question: trimmedPrompt,
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
    setSummaryError(null)

    try {
      const res = await fetch(`${API_BASE_URL}/resummarize/${documentId}`, {
        method: "POST",
        headers: {
          ...(await getAuthHeader())
        }
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data?.error || "Failed to regenerate summary")

      setSummary(data)
      setSummaryError(null)

    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to regenerate summary"
      setSummaryError(message)
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

      <Navbar onConversation={() => setConversationMode(true)} />
      {/* Hero Section */}
      <HeroSection
        sessionId={sessionId}
        uploadedDocs={uploadedDocs}
        setSessionId={setSessionId}
        setUploadedDocs={setUploadedDocs}
        setDocumentId={setDocumentId}
        summary={summary}
        setSummary={setSummary}
        summaryError={summaryError}
        setSummaryError={setSummaryError}
        handleResummarize={handleResummarize}
        documentId={documentId}
        isResummarizing={isResummarizing}
        promptInput={promptInput}
        setPromptInput={setPromptInput}
        handlePromptSubmit={handlePromptSubmit}
        isAsking={isAsking}
        askResponse={askResponse}
        ttsEnabled={ttsEnabled}
        setTtsEnabled={setTtsEnabled}
        stopSpeech={stopSpeech}
        isSpeaking={isSpeaking}
        ttsLoading={ttsLoading}
        speakText={speakText}
        uploadedCount={uploadedCount}
        statusMessage={statusMessage}
        setConversationMode={setConversationMode}
      />

      {/* Problem Section */}
      <ProblemSection />

      {/* Features Section */}
      <FeaturesSection />

      {/* How It Works */}
      <HowItWorksSection />

      {/* Use Cases */}
      <UseCasesSection />

      {/* Tech Stack */}
      <TechStackSection />

      {/* Trust & Safety */}
      <TrustSection />

      {/* Footer */}
      <Footer />
    </div>
  )
}
