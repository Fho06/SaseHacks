import FinVoiceLanding from "@/app/page"
import { ThemeProvider } from "@/components/theme-provider"
import { AuthProvider } from "@/providers/AuthProvider"

function App() {
  return (
    <AuthProvider>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
        <FinVoiceLanding />
      </ThemeProvider>
    </AuthProvider>
  )
}

export default App
