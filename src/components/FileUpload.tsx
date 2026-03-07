import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"

type UploadItem = {
  name: string
  size: number
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B"
  const units = ["B", "KB", "MB", "GB"]
  const exp = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, exp)
  return `${value.toFixed(exp === 0 ? 0 : 1)} ${units[exp]}`
}

export default function FileUpload() {
  const [files, setFiles] = useState<UploadItem[]>([])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const next = acceptedFiles.map((file) => ({ name: file.name, size: file.size }))
    setFiles((prev) => [...prev, ...next])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"],
    },
    multiple: true,
  })

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

      {files.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {files.map((file, idx) => (
            <li key={`${file.name}-${idx}`} className="flex items-center justify-between rounded-lg bg-secondary/40 px-3 py-2">
              <span className="truncate">{file.name}</span>
              <span className="text-muted-foreground">{formatBytes(file.size)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
