import { useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { ArrowLeft, FileText, Moon, Play, Send, Square, Sun, Trash2, Volume2, VolumeX } from "lucide-react"
import { useTheme } from "next-themes"
import FileUpload, { type UploadedDocument } from "@/components/FileUpload"
import { Button } from "@/components/ui/button"
import { getAuthHeader } from "@/lib/api-auth"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5050"
const ALL_FILES_ID = "__all_files__"

type AskSource = {
  documentId?: string
  filename?: string
  chunkIndex?: number
}

type ChatMessage = {
  id: string
  role: "user" | "assistant"
  content: string
  sources?: AskSource[]
  scopeLabel?: string
}

type DocumentChatWorkspaceProps = {
  initialSessionId?: string
  initialUploadedDocs?: UploadedDocument[]
  onBack: () => void
}

function formatAnswerText(raw: string) {
  return String(raw || "")
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

function buildContextualQuestion(question: string, history: ChatMessage[]) {
  const recentTurns = history.slice(-6)
  if (recentTurns.length === 0) return question

  const historyBlock = recentTurns
    .map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`)
    .join("\n")

  return `Use the prior chat context only if relevant to resolve references.\n\nConversation so far:\n${historyBlock}\n\nCurrent question:\n${question}`
}

function nowId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export default function DocumentChatWorkspace({
  initialSessionId,
  initialUploadedDocs = [],
  onBack
}: DocumentChatWorkspaceProps) {
  const { theme, setTheme } = useTheme()
  const [sessionId, setSessionId] = useState(initialSessionId || "")
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>(initialUploadedDocs)
  const [selectedDocumentId, setSelectedDocumentId] = useState<string>(ALL_FILES_ID)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: nowId(),
      role: "assistant",
      content: "Conversation mode is ready. Upload files, pick a file (or All files), and ask follow-up questions."
    }
  ])
  const [input, setInput] = useState("")
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ttsEnabled, setTtsEnabled] = useState(false)
  const [ttsLoading, setTtsLoading] = useState(false)
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const audioUrlRef = useRef<string | null>(null)
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null)

  const selectedDoc = useMemo(
    () => uploadedDocs.find((doc) => doc.documentId === selectedDocumentId) || null,
    [uploadedDocs, selectedDocumentId]
  )

  const selectedScopeLabel = selectedDocumentId === ALL_FILES_ID
    ? "All uploaded files"
    : selectedDoc?.filename || "Selected file"

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

    setTtsLoading(false)
    setSpeakingMessageId(null)
  }

  function speakWithBrowserTts(text: string, messageId: string) {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) {
      throw new Error("Speech synthesis is unavailable in this browser")
    }

    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = 1
    utterance.pitch = 1
    utterance.volume = 1
    utterance.onstart = () => {
      setTtsLoading(false)
      setSpeakingMessageId(messageId)
    }
    utterance.onend = () => setSpeakingMessageId(null)
    utterance.onerror = () => setSpeakingMessageId(null)

    utteranceRef.current = utterance
    window.speechSynthesis.speak(utterance)
  }

  async function speakText(text: string, messageId: string) {
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

      audio.onended = () => setSpeakingMessageId(null)
      audio.onpause = () => setSpeakingMessageId(null)
      audio.onplay = () => {
        setTtsLoading(false)
        setSpeakingMessageId(messageId)
      }

      await audio.play()
    } catch (playError) {
      try {
        speakWithBrowserTts(cleaned, messageId)
        const reason = playError instanceof Error ? playError.message : "ElevenLabs unavailable"
        setError(`ElevenLabs unavailable (${reason}). Using browser voice.`)
      } catch (fallbackError) {
        const reason = fallbackError instanceof Error ? fallbackError.message : "Unable to play speech"
        setError(reason)
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
    if (!ttsEnabled) {
      stopSpeech()
    }
  }, [ttsEnabled])

  useEffect(() => {
    setSessionId(initialSessionId || "")
  }, [initialSessionId])

  useEffect(() => {
    setUploadedDocs(initialUploadedDocs)
  }, [initialUploadedDocs])

  async function handleRemoveDocument(documentId: string) {
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeader())
        },
        body: JSON.stringify({ sessionId })
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to remove document")
      }

      setUploadedDocs((prev) => prev.filter((doc) => doc.documentId !== documentId))
      if (selectedDocumentId === documentId) {
        setSelectedDocumentId(ALL_FILES_ID)
      }
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove document")
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const question = input.trim()
    if (!question || isSending) return

    if (uploadedDocs.length === 0) {
      setError("Upload at least one file before starting the conversation.")
      return
    }

    setError(null)
    setInput("")

    const userMessage: ChatMessage = {
      id: nowId(),
      role: "user",
      content: question,
      scopeLabel: selectedScopeLabel
    }

    setMessages((prev) => [...prev, userMessage])
    setIsSending(true)

    try {
      const questionWithHistory = buildContextualQuestion(question, messages)
      const response = await fetch(`${API_BASE_URL}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(await getAuthHeader())
        },
        body: JSON.stringify({
          question: questionWithHistory,
          hybrid: true,
          limit: 5,
          ...(selectedDocumentId !== ALL_FILES_ID ? { documentId: selectedDocumentId } : {})
        })
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to answer question")
      }

      const assistantMessage: ChatMessage = {
        id: nowId(),
        role: "assistant",
        content: formatAnswerText(payload?.answer || "No answer generated."),
        sources: Array.isArray(payload?.sources) ? payload.sources : [],
        scopeLabel: selectedScopeLabel
      }

      setMessages((prev) => [...prev, assistantMessage])
      if (ttsEnabled) {
        void speakText(assistantMessage.content, assistantMessage.id)
      }

      requestAnimationFrame(() => {
        if (viewportRef.current) {
          viewportRef.current.scrollTop = viewportRef.current.scrollHeight
        }
      })
    } catch (askErr) {
      setError(askErr instanceof Error ? askErr.message : "Failed to answer question")
    } finally {
      setIsSending(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/50 bg-background/85 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <p className="text-sm font-semibold">Conversation Mode</p>
              <p className="text-xs text-muted-foreground">RAG answers grounded in your uploaded files</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTtsEnabled((prev) => !prev)}
              className={`flex h-9 items-center gap-1 rounded-lg border px-2 text-xs transition-colors ${
                ttsEnabled
                  ? "border-primary/40 bg-primary/15 text-primary"
                  : "border-border/60 bg-background/40 text-muted-foreground hover:bg-secondary"
              }`}
              title="Toggle text to speech"
            >
              {ttsEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
              <span>{ttsEnabled ? "TTS On" : "TTS Off"}</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Toggle theme"
              title="Toggle light/dark mode"
            >
              <Sun className="h-4 w-4 hidden dark:block" />
              <Moon className="h-4 w-4 block dark:hidden" />
            </button>
            <span className="rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground">Gemini + Atlas</span>
          </div>
        </div>
      </header>

      <main className="h-[calc(100vh-4rem)]">
        <div className="grid h-full grid-cols-1 md:grid-cols-[320px_1fr]">
          <aside className="border-r border-border/50 bg-card/20 p-3">
            <div className="mb-3 rounded-lg border border-border/60 bg-card/40 p-3">
              <p className="mb-2 text-sm font-medium">Upload Files</p>
              <FileUpload
                sessionId={sessionId || undefined}
                initialUploadedDocs={uploadedDocs}
                showInternalLists={false}
                onSessionUpdate={({ sessionId: nextSessionId, uploadedDocs: nextUploadedDocs }) => {
                  setSessionId(nextSessionId)
                  setUploadedDocs(nextUploadedDocs)
                }}
              />
            </div>

            <div className="mb-2 rounded-md bg-secondary/30 px-3 py-2 text-sm text-foreground">Documents</div>

            <button
              type="button"
              onClick={() => setSelectedDocumentId(ALL_FILES_ID)}
              className={`mb-2 w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                selectedDocumentId === ALL_FILES_ID
                  ? "border-primary/50 bg-primary/15 text-primary"
                  : "border-border/60 bg-background/40 text-muted-foreground hover:bg-secondary/40"
              }`}
            >
              All files context
            </button>

            <div className="space-y-2 overflow-y-auto pr-1" style={{ maxHeight: "calc(100vh - 300px)" }}>
              {uploadedDocs.map((doc) => {
                const isActive = selectedDocumentId === doc.documentId
                return (
                  <div
                    key={doc.documentId}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                      isActive
                        ? "border-primary/50 bg-primary/15 text-primary"
                        : "border-border/60 bg-background/40 text-muted-foreground"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedDocumentId(doc.documentId)}
                      className="min-w-0 flex-1 text-left"
                      title={doc.filename}
                    >
                      <div className="flex items-center gap-2">
                        <FileText className="h-3.5 w-3.5 shrink-0" />
                        <span className="truncate">{doc.filename}</span>
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveDocument(doc.documentId)}
                      className="ml-2 rounded border border-border/60 p-1 text-muted-foreground hover:bg-secondary/40"
                      aria-label={`Remove ${doc.filename}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          </aside>

          <section className="flex h-full flex-col bg-background">
            <div ref={viewportRef} className="flex-1 overflow-y-auto p-4">
              <div className="mx-auto max-w-5xl space-y-4">
                {messages.map((message) => (
                  <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-xl border px-4 py-3 text-sm leading-relaxed ${
                        message.role === "user"
                          ? "border-primary/50 bg-primary/15 text-primary"
                          : "border-border/60 bg-secondary/35 text-foreground"
                      }`}
                    >
                      <p>{message.content}</p>
                      {message.scopeLabel ? (
                        <p className="mt-2 text-[11px] text-muted-foreground">Scope: {message.scopeLabel}</p>
                      ) : null}
                      {message.role === "assistant" ? (
                        <div className="mt-2 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (speakingMessageId === message.id) {
                                stopSpeech()
                              } else if (!ttsLoading) {
                                void speakText(message.content, message.id)
                              }
                            }}
                            disabled={!ttsEnabled || ttsLoading || !message.content.trim()}
                            className="flex h-7 items-center gap-1 rounded-md border border-border/60 bg-background/40 px-2 text-[11px] text-muted-foreground transition-colors enabled:hover:bg-secondary/40 enabled:hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {speakingMessageId === message.id ? (
                              <>
                                <Square className="h-3.5 w-3.5" />
                                <span>Stop</span>
                              </>
                            ) : (
                              <>
                                <Play className="h-3.5 w-3.5" />
                                <span>{ttsLoading ? "Loading..." : "Play voice"}</span>
                              </>
                            )}
                          </button>
                        </div>
                      ) : null}
                      {message.role === "assistant" && (message.sources?.length || 0) > 0 ? (
                        <details className="mt-2 rounded-md border border-border/60 bg-background/50 p-2">
                          <summary className="cursor-pointer text-xs uppercase tracking-wide text-muted-foreground">
                            View Sources ({message.sources?.length || 0})
                          </summary>
                          <div className="space-y-1 pt-2">
                            {message.sources?.slice(0, 8).map((source, index) => (
                              <p key={`${source.documentId || "doc"}-${index}`} className="text-xs text-muted-foreground">
                                [{index + 1}] {source.filename || "unknown"} (chunk {source.chunkIndex ?? "n/a"})
                              </p>
                            ))}
                          </div>
                        </details>
                      ) : null}
                    </div>
                  </div>
                ))}

                {isSending ? (
                  <div className="flex justify-start">
                    <div className="rounded-xl border border-border/60 bg-secondary/35 px-4 py-3 text-sm text-muted-foreground">
                      Thinking...
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="border-t border-border/50 p-3">
              <form onSubmit={handleSubmit} className="mx-auto flex max-w-5xl gap-3">
                <input
                  type="text"
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder="Ask about the selected file or all files..."
                  className="h-12 flex-1 rounded-md border border-border bg-secondary/20 px-4 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                />
                <Button type="submit" disabled={isSending || !input.trim()} className="h-12 bg-primary text-primary-foreground hover:bg-primary/90">
                  <Send className="h-4 w-4" />
                </Button>
              </form>
              {error ? <p className="mx-auto mt-2 max-w-5xl text-xs text-destructive">{error}</p> : null}
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
