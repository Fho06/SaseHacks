"use client"

import { Card, CardContent } from "@/components/ui/card"
import { BarChart3, AlertCircle, Zap } from "lucide-react"

export default function ProblemSection() {
  return (
    <section className="py-24 border-t border-border/30 bg-secondary/20">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">
            The financial intelligence challenge
          </h2>

          <p className="text-muted-foreground max-w-2xl mx-auto text-balance">
            Financial documents are dense, slow to review, and generic AI tools hallucinate. FinVoice AI solves this with explainable, grounded analysis.
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

                <h3 className="text-base font-semibold mb-2">
                  {item.title}
                </h3>

                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  {item.problem}
                </p>

                <p className="text-sm text-primary font-medium">
                  {item.solution}
                </p>

              </CardContent>
            </Card>
          ))}

        </div>
      </div>
    </section>
  )
}