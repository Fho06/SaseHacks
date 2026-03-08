import { useMemo, useRef, useState, type FormEvent } from "react"
import { ArrowLeft, Globe, FileText, Send } from "lucide-react"
import { Button } from "@/components/ui/button"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5050"

type DeepDiveDbSource = {
  id: string
  filename: string
  chunkIndex: number | null
  documentId: string | null
  text: string
}

type DeepDiveWebSource = {
  id: string
  title: string
  url: string
  snippet: string
  provider: string
}

type ChatMessage = {
  role: "user" | "assistant"
  content: string
  dbSources?: DeepDiveDbSource[]
  webSources?: DeepDiveWebSource[]
}

type DeepDiveChatProps = {
  sessionId: string
  documentId?: string | null
  previousAnswer: string
  onBack: () => void
}

export default function DeepDiveChat({ sessionId, documentId, previousAnswer, onBack }: DeepDiveChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: "Deep Dive mode is active. Ask follow-up questions and I will combine your uploaded document evidence with online sources, including citations."
    }
  ])
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const viewportRef = useRef<HTMLDivElement | null>(null)

  const conversationPayload = useMemo(
    () => messages.map((message) => ({ role: message.role, content: message.content })),
    [messages]
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const question = input.trim()
    if (!question || isLoading) return

    setError(null)
    setInput("")

    const nextMessages = [...messages, { role: "user" as const, content: question }]
    setMessages(nextMessages)
    setIsLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/deep-dive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          question,
          sessionId,
          documentId: documentId || null,
          previousAnswer,
          conversation: conversationPayload
        })
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "Deep dive request failed")
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: payload?.answer || "No answer generated.",
          dbSources: Array.isArray(payload?.dbSources) ? payload.dbSources : [],
          webSources: Array.isArray(payload?.webSources) ? payload.webSources : []
        }
      ])

      requestAnimationFrame(() => {
        if (viewportRef.current) {
          viewportRef.current.scrollTop = viewportRef.current.scrollHeight
        }
      })
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Deep dive request failed")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/60 bg-background/80 backdrop-blur">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label="Back to landing page"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <p className="text-sm font-semibold">Deep Dive Chat</p>
              <p className="text-xs text-muted-foreground">Document + web grounded follow-up analysis</p>
            </div>
          </div>
          <span className="rounded-md border border-border/60 px-2 py-1 text-xs text-muted-foreground">Gemini</span>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="mx-auto flex max-w-5xl flex-col gap-4">
          <div className="rounded-xl border border-border/60 bg-secondary/20 p-4 text-sm text-muted-foreground">
            <p className="mb-1 text-xs uppercase tracking-wide">Previous Answer Context</p>
            <p>{previousAnswer}</p>
          </div>

          <div ref={viewportRef} className="h-[58vh] overflow-y-auto rounded-xl border border-border/60 bg-card/30 p-4">
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div key={`${message.role}-${index}`} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[85%] rounded-xl border px-4 py-3 text-sm leading-relaxed ${
                      message.role === "user"
                        ? "border-primary/40 bg-primary/15 text-primary"
                        : "border-border/60 bg-secondary/40 text-foreground"
                    }`}
                  >
                    <p>{message.content}</p>

                    {message.role === "assistant" && ((message.dbSources?.length || 0) > 0 || (message.webSources?.length || 0) > 0) ? (
                      <div className="mt-3 space-y-2 text-xs text-muted-foreground">
                        {(message.dbSources?.length || 0) > 0 ? (
                          <details className="rounded-md border border-border/60 bg-background/50 p-2">
                            <summary className="cursor-pointer font-medium">
                              <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3" /> Document Citations ({message.dbSources?.length || 0})</span>
                            </summary>
                            <div className="space-y-2 pt-2">
                              {message.dbSources?.map((source) => (
                                <p key={source.id}>
                                  {source.id}: {source.filename} (chunk {source.chunkIndex ?? "n/a"}) - {source.text}
                                </p>
                              ))}
                            </div>
                          </details>
                        ) : null}

                        {(message.webSources?.length || 0) > 0 ? (
                          <details className="rounded-md border border-border/60 bg-background/50 p-2">
                            <summary className="cursor-pointer font-medium">
                              <span className="inline-flex items-center gap-1"><Globe className="h-3 w-3" /> Web Citations ({message.webSources?.length || 0})</span>
                            </summary>
                            <div className="space-y-2 pt-2">
                              {message.webSources?.map((source) => (
                                <p key={source.id}>
                                  {source.id}: <a href={source.url} target="_blank" rel="noreferrer" className="underline">{source.title}</a> - {source.snippet}
                                </p>
                              ))}
                            </div>
                          </details>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ))}

              {isLoading ? (
                <div className="flex justify-start">
                  <div className="rounded-xl border border-border/60 bg-secondary/40 px-4 py-3 text-sm text-muted-foreground">
                    Thinking...
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-xl border border-border/60 bg-card/40 p-3">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="Ask a deeper follow-up question..."
                className="h-12 flex-1 rounded-md border border-border bg-background/70 px-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
              <Button type="submit" disabled={isLoading || !input.trim()} className="bg-primary text-primary-foreground hover:bg-primary/90">
                Send
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
          </form>
        </div>
      </main>
    </div>
  )
}
