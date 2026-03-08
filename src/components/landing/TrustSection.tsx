"use client"

import { Card, CardContent } from "@/components/ui/card"
import { CheckCircle2, Shield, Award } from "lucide-react"

export default function TrustSection() {
  return (
    <section id="trust" className="py-24">
      <div className="container mx-auto px-4">

        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">
            Built for trust and transparency
          </h2>

          <p className="text-muted-foreground max-w-2xl mx-auto text-balance">
            FinVoice AI is a research assistant, not financial advice.
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
              desc: "FinVoice AI does not provide investment advice. It accelerates research and due diligence.",
            },
          ].map((item, i) => (

            <Card key={i} className="bg-card/50 border-border/50">
              <CardContent className="p-6">

                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                  <item.icon className="h-5 w-5 text-primary" />
                </div>

                <h3 className="text-base font-semibold mb-2">
                  {item.title}
                </h3>

                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>

              </CardContent>
            </Card>

          ))}

        </div>

        <div className="max-w-2xl mx-auto mt-12 p-6 bg-primary/5 border border-primary/20 rounded-lg text-center">

          <p className="text-xs text-muted-foreground italic">
            <strong>Disclaimer:</strong> FinVoice AI is a document intelligence and research assistant. It does not provide financial advice, investment recommendations, or analysis. Always verify findings with original documents and consult a financial advisor.
          </p>

        </div>

      </div>
    </section>
  )
}