"use client"

export default function HowItWorksSection() {
  return (
    <section id="how-it-works" className="py-24 bg-secondary/20">
      <div className="container mx-auto px-4">

        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">
            How it works
          </h2>

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
                <span className="text-lg font-bold text-primary">
                  {item.num}
                </span>
              </div>

              <h3 className="text-sm font-semibold mb-2">
                {item.title}
              </h3>

              <p className="text-xs text-muted-foreground">
                {item.desc}
              </p>

              {i < 4 && (
                <div className="hidden md:block absolute top-6 -right-3 w-6 h-0.5 bg-gradient-to-r from-primary/30 to-transparent" />
              )}

            </div>

          ))}

        </div>

      </div>
    </section>
  )
}