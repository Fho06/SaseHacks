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

<<<<<<< HEAD
  async function uploadFiles() {
    if (files.length === 0) return

    setUploading(true)

    const formData = new FormData()

    files.forEach(file => {
      formData.append("files", file)
    })

    await fetch("http://localhost:5050/upload", {
      method: "POST",
      body: formData
    })

    setUploading(false)
    alert("Upload complete")
  }

=======
>>>>>>> 2d57dfed69ca62c3f2e9f2e86daf0addb6043561
  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`rounded-xl border border-dashed p-8 text-center transition-colors ${
          isDragActive ? "border-blue-400 bg-blue-500/10" : "border-white/20 bg-white/5 hover:bg-white/10"
        }`}
      >
        <input {...getInputProps()} />
        <p className="text-sm text-gray-300">
          {isDragActive ? "Drop files here..." : "Drag and drop PDFs/TXT files here, or click to browse"}
        </p>
      </div>

      {files.length > 0 ? (
        <ul className="space-y-2 text-sm">
          {files.map((file, idx) => (
            <li key={`${file.name}-${idx}`} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2">
              <span className="truncate">{file.name}</span>
              <span className="text-gray-400">{formatBytes(file.size)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
