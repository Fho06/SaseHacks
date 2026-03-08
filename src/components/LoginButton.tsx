import { Button } from "@/components/ui/button"
import { useAuth } from "@/providers/AuthProvider"

export default function LoginButton() {
  const {
    user,
    loading,
    error,
    isConfigured,
    signInWithGoogle,
    signOutUser
  } = useAuth()

  if (!isConfigured) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-border text-muted-foreground"
        disabled
      >
        Configure Firebase Auth
      </Button>
    )
  }

  if (loading) {
    return (
      <Button type="button" variant="outline" size="sm" className="border-border" disabled>
        Loading Auth...
      </Button>
    )
  }

  if (user) {
    return (
      <div className="flex items-center gap-2">
        <span className="hidden max-w-[180px] truncate text-xs text-muted-foreground sm:block">
          {user.displayName || user.email || "Signed in"}
        </span>
        <Button type="button" size="sm" variant="outline" className="border-border" onClick={() => void signOutUser()}>
          Sign Out
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end gap-1 min-h-[2.25rem]">
      <Button type="button" size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => void signInWithGoogle()}>
        Sign in with Google
      </Button>
      {error ? <p className="max-w-[320px] truncate text-[11px] leading-tight text-destructive text-right">{error}</p> : null}
    </div>
  )
}
