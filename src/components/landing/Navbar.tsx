"use client"

import { Button } from "@/components/ui/button"
import LoginButton from "@/components/LoginButton"
import { useTheme } from "next-themes"
import { ArrowRight, Github, Sun, Moon } from "lucide-react"

function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  return (
    <button
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className="h-9 w-9 flex items-center justify-center rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
      aria-label="Toggle theme"
    >
      <Sun className="h-4 w-4 hidden dark:block" />
      <Moon className="h-4 w-4 block dark:hidden" />
    </button>
  )
}

export default function Navbar({ onConversation }: { onConversation: () => void }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <div className="flex items-center gap-2">
            <img src="/logo.png" alt="FinVoice logo" className="h-8 w-8 rounded-md object-contain" />
            <span className="text-lg font-semibold tracking-tight hidden sm:block">FinVoice AI</span>
          </div>

          <nav className="hidden lg:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              How It Works
            </a>
            <a href="#use-cases" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Use Cases
            </a>
            <a href="#tech-stack" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Tech Stack
            </a>
            <a href="#trust" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Trust & Safety
            </a>
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <LoginButton />

          <ThemeToggle />

          <a
            href="https://github.com"
            className="hidden sm:flex items-center justify-center h-9 w-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            aria-label="GitHub"
          >
            <Github className="h-4 w-4" />
          </a>

          <Button
            type="button"
            size="sm"
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={onConversation}
          >
            Conversation Mode
            <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </header>
  )
}