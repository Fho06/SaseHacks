import FileUpload from "./components/FileUpload"
import ChatBox from "./components/ChatBox"
import { useState } from "react"

interface Answer {
  answer: string
  sources: any[]
}

function App() {

  const [answer, setAnswer] = useState<Answer | null>(null)

  return (

    <div>

      <h1>Financial Document Copilot</h1>

      <FileUpload />

      <ChatBox setAnswer={setAnswer} />

      {answer && (
        <div>

          <h2>Answer</h2>

          <p>{answer.answer}</p>

        </div>
      )}

    </div>
  )
}

export default App