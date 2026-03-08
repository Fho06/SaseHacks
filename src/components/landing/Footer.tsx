"use client"

export default function Footer() {
  return (
    <footer className="py-12 border-t border-border/30">

      <div className="container mx-auto px-4">

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">

          <div className="md:col-span-1">
            <div className="flex items-center gap-2 mb-2">
              <img
                src="/logo.png"
                alt="FinVoice logo"
                className="h-8 w-8 rounded-md object-contain"
              />
              <span className="font-semibold">FinVoice</span>
            </div>

            <p className="text-xs text-muted-foreground">
              Voice-enabled financial document intelligence.
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold mb-3 text-foreground">
              Product
            </p>

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
            <p className="text-xs font-semibold mb-3 text-foreground">
              Resources
            </p>

            <ul className="space-y-2 text-xs text-muted-foreground">
              <li>
                <a href="#" className="hover:text-foreground transition-colors">
                  Documentation
                </a>
              </li>
              <li>
                <a href="https://github.com/Fho06/SaseHacks" className="hover:text-foreground transition-colors">
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
            <p className="text-xs font-semibold mb-3 text-foreground">
              Legal
            </p>

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
            (c) 2026 FinVoice AI. Built for financial intelligence. Not investment advice.
          </p>

          <p className="text-xs text-muted-foreground">
            Hackathon MVP - Powered by RAG & Gemini
          </p>

        </div>

      </div>

    </footer>
  )
}