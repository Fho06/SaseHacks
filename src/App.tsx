import FinVoiceLanding from "@/app/page"
import { ThemeProvider } from "@/components/theme-provider"

function App() {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <FinVoiceLanding />
    </ThemeProvider>
  )
}

export default App
