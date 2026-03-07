import FileUpload from "./components/FileUpload"
import { Sparkles } from "lucide-react"

function App() {
  return (
    <div className="min-h-screen flex justify-center bg-gradient-to-b from-slate-900 via-slate-950 to-black text-white">

      <div className="w-full max-w-5xl px-6">

        {/* Navbar */}
        <nav className="flex justify-between items-center py-6 border-b border-white/10">
          <div className="flex items-center gap-2 font-semibold text-lg">
            <Sparkles className="text-blue-400" size={20} />
            Finance Copilot
          </div>

          <span className="text-sm text-gray-400">
            AI Research Assistant
          </span>
        </nav>

        {/* Hero */}
        <section className="text-center py-20">

          <div className="inline-flex items-center gap-2 px-4 py-1 text-sm bg-blue-500/10 text-blue-300 rounded-full mb-6">
            ✦ AI-powered financial analysis
          </div>

          <h1 className="text-5xl font-bold mb-6">
            Financial Document Copilot
          </h1>

          <p className="text-gray-400 max-w-2xl mx-auto text-lg">
            Upload 10-Ks, earnings transcripts, or analyst reports and ask
            questions about risks, liquidity, management tone, and key changes.
          </p>

        </section>

        {/* Upload */}
        <section className="bg-white/5 border border-white/10 rounded-2xl p-10 mb-16">
          <h2 className="text-xl font-semibold mb-6">
            Upload Financial Documents
          </h2>

          <FileUpload />
        </section>

      </div>

    </div>
  )
}

export default App