"use client"

import { useState, useRef } from "react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  ArrowRight,
  Upload,
  MessageSquare,
  Award,
  BarChart3,
  Database,
  Zap,
  Shield,
  Volume2,
  CheckCircle2,
  Code2,
  FileText,
  Github,
  Sun,
  Moon,
  Play,
} from "lucide-react"

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

const TechStackBadge = ({ label, icon: Icon }: { label: string; icon: React.ReactNode }) => (
  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 border border-border/50 text-sm text-foreground">
    {Icon}
    <span>{label}</span>
  </div>
)

export default function FinVoiceLanding() {
  const [selectedExample, setSelectedExample] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const examples = [
    {
      question: "What are the biggest risks mentioned in this quarter's filing?",
      answer:
        "The filing highlights three primary risks: (1) market volatility impacts, (2) regulatory changes in key jurisdictions, and (3) supply chain disruptions.",
      source: "10-Q Filing, Risk Factors Section",
    },
    {
      question: "Summarize liquidity and debt risk.",
      answer:
        "Current ratio is 1.8x with $2.3B in cash. Total debt decreased 12% YoY to $4.5B. Interest coverage ratio at 3.2x indicates stable debt servicing capability.",
      source: "Earnings Call Transcript, Q3 2024",
    },
    {
      question: "Did management sound more cautious this quarter?",
      answer:
        "Management used cautious language 23% more frequently than Q2, with increased mentions of 'challenges' and 'headwinds'. However, guidance remained unchanged.",
      source: "10-Q, MD&A Section",
    },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Sticky Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                FV
              </div>
              <span className="text-lg font-semibold tracking-tight hidden sm:block">FinVoice Copilot</span>
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
            <ThemeToggle />
            <a
              href="https://github.com"
              className="hidden sm:flex items-center justify-center h-9 w-9 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              aria-label="GitHub"
            >
              <Github className="h-4 w-4" />
            </a>
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
              Try Demo
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="pt-32 pb-20 md:pt-40 md:pb-32">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center mb-12">
            <div className="mb-6 flex justify-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                RAG-Powered Financial Intelligence
              </span>
            </div>
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-6 text-balance leading-tight">
              Turn dense filings into grounded, voice-enabled financial insight
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto text-balance mb-8 leading-relaxed">
              Upload 10-Ks, 10-Qs, earnings call transcripts, and analyst notes. Ask questions in natural language. Get source-backed answers with citations and optional voice playback.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center mb-8">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                Launch Demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="border-border">
                Explore Stack
              </Button>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              <TechStackBadge label="MongoDB Atlas" icon={<Database className="h-3.5 w-3.5 text-primary" />} />
              <TechStackBadge label="Gemini API" icon={<Zap className="h-3.5 w-3.5 text-primary" />} />
              <TechStackBadge label="ElevenLabs" icon={<Volume2 className="h-3.5 w-3.5 text-primary" />} />
              <TechStackBadge label="RAG-Powered" icon={<Award className="h-3.5 w-3.5 text-primary" />} />
            </div>
          </div>

          {/* Product Preview Mock */}
          <div className="max-w-5xl mx-auto mt-16">
            <div className="rounded-2xl border border-border/50 overflow-hidden bg-card shadow-2xl">
              <div className="bg-secondary/50 px-6 py-4 border-b border-border/50 flex items-center gap-3">
                <div className="flex gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
                </div>
                <span className="text-xs text-muted-foreground font-mono flex-1 text-left">FinVoice Copilot Dashboard</span>
              </div>
              <div className="grid grid-cols-4 gap-px bg-border/20">
                {/* Left Sidebar */}
                <div className="col-span-1 bg-secondary/30 p-4 border-r border-border/50">
                  <div className="space-y-3">
                    <div className="h-8 bg-secondary rounded px-3 flex items-center text-xs text-muted-foreground">
                      Documents
                    </div>
                    {["10-K 2024", "10-Q Q3", "Earnings Call"].map((doc, i) => (
                      <div
                        key={i}
                        className={`h-8 rounded px-3 flex items-center text-xs gap-2 transition-colors ${
                          i === 0
                            ? "bg-primary/20 text-primary border border-primary/30"
                            : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        <FileText className="h-3 w-3" />
                        {doc}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Chat Area */}
                <div className="col-span-3 p-6 space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <div className="bg-secondary/50 rounded-lg p-4 text-sm">
                        <p className="text-foreground font-medium mb-1">What are the biggest risks mentioned in this quarter's filing?</p>
                        <p className="text-muted-foreground text-xs">You · 2 min ago</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 text-sm space-y-3">
                        <p className="text-foreground font-medium">Risk factors identified:</p>
                        <ul className="space-y-2 text-muted-foreground text-xs">
                          <li className="flex gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                            <span>Market volatility impacts on revenue</span>
                          </li>
                          <li className="flex gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                            <span>Regulatory changes in key jurisdictions</span>
                          </li>
                          <li className="flex gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                            <span>Supply chain disruption risks</span>
                          </li>
                        </ul>
                        <div className="pt-3 border-t border-primary/20 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <button className="h-7 w-7 flex items-center justify-center rounded bg-primary/20 hover:bg-primary/30 text-primary transition-colors">
                              <Play className="h-3 w-3 fill-current" />
                            </button>
                            <span className="text-xs text-muted-foreground">Listen with voice</span>
                          </div>
                          <span className="text-xs text-primary/70 font-mono">Source: 10-Q, Risk Factors</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <input
                      type="text"
                      placeholder="Ask about this filing..."
                      className="flex-1 bg-secondary/50 border border-border/50 rounded-lg px-4 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30"
                      disabled
                    />
                    <button className="h-10 w-10 flex items-center justify-center rounded-lg bg-primary/20 text-primary hover:bg-primary/30 transition-colors" disabled>
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-24 border-t border-border/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">The financial intelligence challenge</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-balance">
              Financial documents are dense, slow to review, and generic AI tools hallucinate. FinVoice Copilot solves this with explainable, grounded analysis.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: BarChart3,
                title: "Document Overload",
                problem: "10-Ks, 10-Qs, and earnings transcripts are dense and time-consuming to analyze.",
                solution: "Instant AI parsing and structured summaries.",
              },
              {
                icon: AlertCircle,
                title: "Untrusted AI Outputs",
                problem: "Generic AI models hallucinate or lack source grounding in financial contexts.",
                solution: "Every answer backed by specific citations from source documents.",
              },
              {
                icon: Zap,
                title: "Slow Due Diligence",
                problem: "Manual comparison and deep-dive analysis takes hours or days.",
                solution: "Real-time insights and red-flag detection across filings.",
              },
            ].map((item, i) => (
              <Card key={i} className="bg-secondary/30 border-border/50">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{item.problem}</p>
                  <p className="text-sm text-primary font-medium">{item.solution}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">Powerful features for financial research</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-balance">
              Built for equity researchers, analysts, and finance professionals.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Upload, title: "Upload Financial PDFs", desc: "10-Ks, 10-Qs, earnings transcripts, analyst reports." },
              {
                icon: MessageSquare,
                title: "Natural Language Queries",
                desc: "Ask questions in plain English, get structured insights.",
              },
              {
                icon: Award,
                title: "Citation-Backed Answers",
                desc: "Every response includes source references and page numbers.",
              },
              {
                icon: Volume2,
                title: "Voice Playback",
                desc: "Listen to answers with ElevenLabs voice synthesis.",
              },
              {
                icon: Zap,
                title: "AI Summaries",
                desc: "Auto-generate executive summaries and key takeaways.",
              },
              {
                icon: BarChart3,
                title: "Red-Flag Detection",
                desc: "Highlight risks, anomalies, and material changes.",
              },
              {
                icon: Database,
                title: "Fast Search",
                desc: "Vector search across earnings calls and filings instantly.",
              },
              {
                icon: Code2,
                title: "Structured Insights",
                desc: "Export findings in JSON for integration with your tools.",
              },
            ].map((feature, i) => (
              <Card key={i} className="bg-card/50 border-border/50 hover:border-primary/30 transition-all group">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-sm font-semibold mb-2">{feature.title}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">How it works</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-balance">
              Five-step RAG pipeline for grounded financial analysis.
            </p>
          </div>

          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-5 gap-6">
            {[
              { num: "1", title: "Upload", desc: "Drop filing or transcript" },
              { num: "2", title: "Parse", desc: "Chunk and index content" },
              { num: "3", title: "Retrieve", desc: "RAG finds relevant evidence" },
              { num: "4", title: "Generate", desc: "Gemini creates grounded answer" },
              { num: "5", title: "Deliver", desc: "Voice or text with citations" },
            ].map((item, i) => (
              <div key={i} className="text-center relative">
                <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/30 flex items-center justify-center mx-auto mb-4">
                  <span className="text-lg font-bold text-primary">{item.num}</span>
                </div>
                <h3 className="text-sm font-semibold mb-2">{item.title}</h3>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
                {i < 4 && (
                  <div className="hidden md:block absolute top-6 -right-3 w-6 h-0.5 bg-gradient-to-r from-primary/30 to-transparent" />
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-24 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">Built for every finance professional</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {[
              {
                title: "Equity Research",
                desc: "Compare earnings trends, track management commentary shifts, and flag guidance changes across multiple quarters.",
              },
              {
                title: "Earnings Call Copilot",
                desc: "Instant Q&A on earnings calls. Search for specific mentions, tonality shifts, and forward guidance.",
              },
              {
                title: "Finance Learning",
                desc: "Student-friendly queries. Learn how to read 10-Ks with guided analysis and contextual explanations.",
              },
              {
                title: "M&A Due Diligence",
                desc: "Accelerate target company analysis. Extract key metrics, flag risks, and compare to market peers.",
              },
            ].map((useCase, i) => (
              <Card key={i} className="bg-card/50 border-border/50 hover:border-primary/30 transition-all">
                <CardContent className="p-6">
                  <h3 className="text-base font-semibold mb-2">{useCase.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{useCase.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section id="tech-stack" className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">Modern fintech stack</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-balance">
              Built with cutting-edge open-source tools and APIs for performance, reliability, and explainability.
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 max-w-5xl mx-auto mb-12">
            {[
              "Next.js",
              "TypeScript",
              "MongoDB Atlas",
              "Atlas Vector Search",
              "Gemini API",
              "ElevenLabs",
              "Tailwind CSS",
              "shadcn/ui",
              "Vercel",
              "RAG",
            ].map((tech) => (
              <div
                key={tech}
                className="px-4 py-3 rounded-lg border border-border/50 bg-card/50 text-center text-sm font-medium text-foreground hover:border-primary/30 transition-colors"
              >
                {tech}
              </div>
            ))}
          </div>

          <div className="max-w-3xl mx-auto bg-secondary/30 border border-border/50 rounded-lg p-8">
            <p className="text-sm text-muted-foreground leading-relaxed">
              <strong>Architecture:</strong> FinVoice Copilot uses MongoDB Atlas for document storage and vector embeddings, Gemini for semantic understanding and answer generation, and ElevenLabs for natural voice synthesis. Our RAG pipeline ensures every answer is grounded in source documents, not hallucinations. Deployed on Vercel for sub-100ms response times and built with Next.js for seamless full-stack development.
            </p>
          </div>
        </div>
      </section>

      {/* Trust & Safety */}
      <section id="trust" className="py-24 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">Built for trust and transparency</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto text-balance">
              FinVoice Copilot is a research assistant, not financial advice.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {[
              {
                icon: CheckCircle2,
                title: "Source-Backed Answers",
                desc: "Every response includes specific citations. Know exactly where claims originate.",
              },
              {
                icon: Shield,
                title: "Explainable Workflow",
                desc: "See the retrieval process and reasoning. No black-box answers.",
              },
              {
                icon: Award,
                title: "Research Tool Only",
                desc: "FinVoice Copilot does not provide investment advice. It accelerates research and due diligence.",
              },
            ].map((item, i) => (
              <Card key={i} className="bg-card/50 border-border/50">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <item.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="text-base font-semibold mb-2">{item.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="max-w-2xl mx-auto mt-12 p-6 bg-primary/5 border border-primary/20 rounded-lg text-center">
            <p className="text-xs text-muted-foreground italic">
              <strong>Disclaimer:</strong> FinVoice Copilot is a document intelligence and research assistant. It does not provide financial advice, investment recommendations, or analysis. Always verify findings with original documents and consult a financial advisor.
            </p>
          </div>
        </div>
      </section>

      {/* Example Questions */}
      <section className="py-24">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">Try these questions</h2>
            <p className="text-muted-foreground">See what FinVoice Copilot can do with real documents.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto mb-12">
            {examples.map((ex, i) => (
              <Card
                key={i}
                onClick={() => setSelectedExample(i)}
                className={`cursor-pointer border-border/50 transition-all ${
                  selectedExample === i ? "border-primary/50 bg-primary/5" : "hover:border-primary/30 bg-card/50"
                }`}
              >
                <CardContent className="p-6">
                  <p className="text-sm font-medium mb-1 text-balance">{ex.question}</p>
                  <p className="text-xs text-muted-foreground">Click to preview answer</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="max-w-3xl mx-auto">
            <Card className="bg-primary/10 border-primary/20">
              <CardContent className="p-8">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs text-primary/60 font-mono uppercase tracking-wide mb-2">Question</p>
                    <p className="text-base font-medium">{examples[selectedExample].question}</p>
                  </div>
                  <div className="border-t border-primary/20 pt-4">
                    <p className="text-xs text-primary/60 font-mono uppercase tracking-wide mb-2">Answer</p>
                    <p className="text-sm text-foreground leading-relaxed">{examples[selectedExample].answer}</p>
                  </div>
                  <div className="border-t border-primary/20 pt-4 flex items-center justify-between">
                    <span className="text-xs text-primary/70 font-mono">{examples[selectedExample].source}</span>
                    <button className="h-8 w-8 flex items-center justify-center rounded-lg bg-primary/20 hover:bg-primary/30 text-primary transition-colors">
                      <Volume2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 bg-secondary/20">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">Ready to unlock financial intelligence?</h2>
            <p className="text-muted-foreground mb-8 max-w-xl mx-auto text-balance">
              Join researchers and analysts using FinVoice Copilot to accelerate due diligence and investment analysis.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90">
                Launch Demo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="border-border">
                View Architecture
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border/30">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
                  FV
                </div>
                <span className="font-semibold">FinVoice</span>
              </div>
              <p className="text-xs text-muted-foreground">Voice-enabled financial document intelligence.</p>
            </div>
            <div>
              <p className="text-xs font-semibold mb-3 text-foreground">Product</p>
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
              <p className="text-xs font-semibold mb-3 text-foreground">Resources</p>
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li>
                  <a href="#" className="hover:text-foreground transition-colors">
                    Documentation
                  </a>
                </li>
                <li>
                  <a href="https://github.com" className="hover:text-foreground transition-colors">
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
              <p className="text-xs font-semibold mb-3 text-foreground">Legal</p>
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
              © 2024 FinVoice Copilot. Built for financial intelligence. Not investment advice.
            </p>
            <p className="text-xs text-muted-foreground">Hackathon MVP · Powered by RAG & Gemini</p>
          </div>
        </div>
      </footer>
    </div>
  )
}
