import { useState } from "react"
import { useDropzone } from "react-dropzone"

type UploadedDocument = {
  sessionId: string
  documentId: string
  filename: string
  chunks: number
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, exp)
  return `${value.toFixed(exp === 0 ? 0 : 1)} ${units[exp]}`
}

function makeSessionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID()
  }
  return `session-${Date.now()}`
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5050"

export default function FileUpload() {
  const [sessionId] = useState(() => makeSessionId())
  const [queuedFiles, setQueuedFiles] = useState<File[]>([])
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDocument[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (acceptedFiles) => {
      setQueuedFiles((prev) => [...prev, ...acceptedFiles])
      setError(null)
    },
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"]
    },
    multiple: true
  })

  async function submitFiles() {
    if (queuedFiles.length === 0 || isUploading) return
    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      queuedFiles.forEach((file) => formData.append("files", file))
      formData.append("sessionId", sessionId)
      formData.append("sourceType", "user_upload")

      const response = await fetch(`${API_BASE_URL}/upload`, {
        method: "POST",
        body: formData
      })
      const payload = await response.json()

      if (!response.ok) {
        throw new Error(payload?.error || "Upload failed")
      }

      setUploadedDocs((prev) => [...prev, ...(payload.files || [])])
      setQueuedFiles([])
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Upload failed")
    } finally {
      setIsUploading(false)
    }
  }

  async function removeUploaded(documentId: string) {
    setError(null)
    try {
      const response = await fetch(`${API_BASE_URL}/documents/${documentId}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ sessionId })
      })
      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || "Failed to remove document")
      }
      setUploadedDocs((prev) => prev.filter((doc) => doc.documentId !== documentId))
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : "Failed to remove document")
    }
  }

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`rounded-xl border border-dashed p-5 text-center transition-colors ${
          isDragActive ? "border-primary/60 bg-primary/10" : "border-border bg-secondary/30 hover:bg-secondary/50"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-sm text-muted-foreground">
          {isDragActive ? "Drop files here..." : "Drag and drop PDFs/TXT files here, or click to browse"}
        </p>
      </div>

      <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <span className="truncate">Session: {sessionId}</span>
        <button
          type="button"
          onClick={submitFiles}
          disabled={queuedFiles.length === 0 || isUploading}
          className="rounded-md border border-primary/40 bg-primary/15 px-3 py-1.5 text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isUploading ? "Uploading..." : `Upload ${queuedFiles.length || ""}`.trim()}
        </button>
      </div>

      {queuedFiles.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {queuedFiles.map((file, idx) => (
            <li key={`${file.name}-${idx}`} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
              <div className="min-w-0">
                <p className="truncate">{file.name}</p>
                <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
              </div>
              <button
                type="button"
                onClick={() => setQueuedFiles((prev) => prev.filter((_, fileIdx) => fileIdx !== idx))}
                className="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary/70"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {uploadedDocs.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">Uploaded in this session</p>
          {uploadedDocs.map((doc) => (
            <div key={doc.documentId} className="flex items-center justify-between rounded-lg bg-secondary/30 px-3 py-2 text-sm">
              <div className="min-w-0">
                <p className="truncate">{doc.filename}</p>
                <p className="text-xs text-muted-foreground">{doc.chunks} chunks indexed</p>
              </div>
              <button
                type="button"
                onClick={() => removeUploaded(doc.documentId)}
                className="rounded-md border border-border px-2 py-1 text-xs hover:bg-secondary/70"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      ) : null}

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  )
}
