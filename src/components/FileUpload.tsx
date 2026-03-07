import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { UploadCloud, FileText } from "lucide-react"

export default function FileUpload() {
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles])
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"],
      "text/plain": [".txt"]
    }
  })

  async function uploadFiles() {
    if (files.length === 0) return

    setUploading(true)

    const formData = new FormData()

    files.forEach(file => {
      formData.append("files", file)
    })

    await fetch("http://localhost:5000/upload", {
      method: "POST",
      body: formData
    })

    setUploading(false)
    alert("Upload complete")
  }

  return (
    <div className="space-y-6">

      {/* Upload box */}
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
        ${isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"}`}
      >
        <input {...getInputProps()} />

        <UploadCloud className="mx-auto mb-3 text-gray-500" size={40} />

        <p className="text-lg font-semibold">
          Drag & drop financial documents
        </p>

        <p className="text-sm text-gray-500">
          Upload PDFs, earnings transcripts, analyst notes
        </p>
      </div>

      {/* File list */}
      {files.length > 0 && (
        <div className="space-y-2">

          <h3 className="font-semibold">Uploaded Files</h3>

          {files.map((file, i) => (
            <div
              key={i}
              className="flex items-center gap-3 p-3 border rounded-lg bg-white"
            >
              <FileText size={18} />
              <span>{file.name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Upload button */}
      {files.length > 0 && (
        <button
          onClick={uploadFiles}
          disabled={uploading}
          className="px-6 py-2 bg-black text-white rounded-lg hover:opacity-90"
        >
          {uploading ? "Uploading..." : "Upload Documents"}
        </button>
      )}

    </div>
  )
}