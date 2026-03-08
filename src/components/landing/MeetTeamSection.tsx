"use client"

type TeamMember = {
  name: string
  role: string
  image: string
}

export default function MeetTeamSection() {
  const team: TeamMember[] = [
    {
      name: "Fabian Ho Chang",
      role: "Co-Founder / SWE",
      image: "/team/fabian.png",
    },
    {
      name: "Gabriel Wong",
      role: "Co-Founder / SWE",
      image: "/team/gabriel.png",
    },
  ]

  return (
    <section id="team" className="py-24 scroll-mt-24">
      <div className="container mx-auto px-4">

        {/* Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl font-bold mb-4 text-balance">
            Meet the Team
          </h2>

          <p className="text-muted-foreground max-w-2xl mx-auto text-balance">
            The builders behind FinVoice AI — combining AI, finance, and modern web technologies to create a new kind of research copilot.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 max-w-3xl mx-auto">

          {team.map((member) => (
            <div
              key={member.name}
              className="rounded-xl border border-border/50 bg-card/50 overflow-hidden hover:border-primary/30 transition-colors"
            >

              {/* Image */}
              <div className="w-full h-56 overflow-hidden">
                <img
                  src={member.image}
                  alt={member.name}
                  className="w-full h-full object-cover"
                />
              </div>

              {/* Text */}
              <div className="p-6 text-center">
                <h3 className="text-lg font-semibold">{member.name}</h3>

                <p className="text-sm text-muted-foreground mt-1">
                  {member.role}
                </p>
              </div>

            </div>
          ))}

        </div>

      </div>
    </section>
  )
}