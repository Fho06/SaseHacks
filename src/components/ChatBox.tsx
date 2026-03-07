import { useState } from "react"

interface ChatBoxProps {
  setAnswer: (data: any) => void
}

export default function ChatBox({ setAnswer }: ChatBoxProps) {

  const [question, setQuestion] = useState("")

  async function ask() {

    const res = await fetch("http://localhost:5000/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ question })
    })

    const data = await res.json()

    setAnswer(data)
  }

  return (
    <div>

      <input
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        placeholder="Ask about the document..."
      />

      <button onClick={ask}>
        Ask
      </button>

    </div>
  )
}