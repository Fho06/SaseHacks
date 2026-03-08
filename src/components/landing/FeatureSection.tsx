"use client"

import { Card, CardContent } from "@/components/ui/card"
import {
  Upload,
  MessageSquare,
  Award,
  Volume2,
  Zap,
  BarChart3,
  Database,
  Code2,
} from "lucide-react"

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24">
      <div className="container mx-auto px-4">

        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">
            Powerful features for financial research
          </h2>

          <p className="text-muted-foreground max-w-2xl mx-auto text-balance">
            Built for equity researchers, analysts, and finance professionals.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">

          {[
            {
              icon: Upload,
              title: "Upload Financial PDFs",
              desc: "10-Ks, 10-Qs, earnings transcripts, analyst reports."
            },
            {
              icon: MessageSquare,
              title: "Natural Language Queries",
              desc: "Ask questions in plain English, get structured insights."
            },
            {
              icon: Award,
              title: "Citation-Backed Answers",
              desc: "Every response includes source references and page numbers."
            },
            {
              icon: Volume2,
              title: "Voice Playback",
              desc: "Listen to answers with ElevenLabs voice synthesis."
            },
            {
              icon: Zap,
              title: "AI Summaries",
              desc: "Auto-generate executive summaries and key takeaways."
            },
            {
              icon: BarChart3,
              title: "Red-Flag Detection",
              desc: "Highlight risks, anomalies, and material changes."
            },
            {
              icon: Database,
              title: "Fast Search",
              desc: "Vector search across earnings calls and filings instantly."
            },
            {
              icon: Code2,
              title: "Structured Insights",
              desc: "Export findings in JSON for integration with your tools."
            },
          ].map((feature, i) => (

            <Card
              key={i}
              className="bg-card/50 border-border/50 hover:border-primary/30 transition-all group"
            >
              <CardContent className="p-6">

                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="h-5 w-5 text-primary" />
                </div>

                <h3 className="text-sm font-semibold mb-2">
                  {feature.title}
                </h3>

                <p className="text-xs text-muted-foreground leading-relaxed">
                  {feature.desc}
                </p>

              </CardContent>
            </Card>

          ))}

        </div>

      </div>
    </section>
  )
}