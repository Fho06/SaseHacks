"use client"

import { Card, CardContent } from "@/components/ui/card"

export default function UseCasesSection() {
  return (
    <section id="use-cases" className="py-24">
      <div className="container mx-auto px-4">

        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">
            Built for every finance professional
          </h2>
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

            <Card
              key={i}
              className="bg-card/50 border-border/50 hover:border-primary/30 transition-all"
            >
              <CardContent className="p-6">

                <h3 className="text-base font-semibold mb-2">
                  {useCase.title}
                </h3>

                <p className="text-sm text-muted-foreground leading-relaxed">
                  {useCase.desc}
                </p>

              </CardContent>
            </Card>

          ))}

        </div>

      </div>
    </section>
  )
}