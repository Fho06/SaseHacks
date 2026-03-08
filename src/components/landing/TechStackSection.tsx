"use client"

export default function TechStackSection() {
  return (
    <section id="tech-stack" className="py-24 scroll-mt-24 bg-secondary/20">
      <div className="container mx-auto px-4">

        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">
            Modern Fintech Stack
          </h2>

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
            <strong>Architecture:</strong> FinVoice AI uses MongoDB Atlas for document storage and vector embeddings, Gemini for semantic understanding and answer generation, and ElevenLabs for natural voice synthesis. Our RAG pipeline ensures every answer is grounded in source documents, not hallucinations. Deployed on Vercel for sub-100ms response times and built with Next.js for seamless full-stack development.
          </p>

        </div>

      </div>
    </section>
  )
}