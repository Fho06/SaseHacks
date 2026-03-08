import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from "react"
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type AuthError,
  type User
} from "firebase/auth"
import { auth, googleProvider, isFirebaseConfigured } from "@/lib/firebase"

type AuthContextValue = {
  user: User | null
  loading: boolean
  error: string | null
  isConfigured: boolean
  signInWithGoogle: () => Promise<void>
  signOutUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function mapFirebaseError(error: unknown) {
    const fallback = "Google sign-in failed. Please try again."
    const firebaseError = error as AuthError | undefined
    const code = firebaseError?.code || ""

    if (code === "auth/api-key-not-valid") {
      return "Firebase web config is invalid. Update VITE_FIREBASE_* in root .env and restart Vite."
    }
    if (code === "auth/popup-closed-by-user") {
      return "Sign-in popup was closed before completion."
    }
    if (code === "auth/cancelled-popup-request") {
      return "Another sign-in popup request is already in progress."
    }
    if (code === "auth/network-request-failed") {
      return "Network error during sign-in. Check connection and try again."
    }

    return fallback
  }

  useEffect(() => {
    if (!auth || !isFirebaseConfigured) {
      setLoading(false)
      return
    }

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser)
      setLoading(false)
    })

    return unsubscribe
  }, [])

  async function signInWithGoogle() {
    if (!auth || !isFirebaseConfigured) {
      setError("Firebase auth is not configured. Add VITE_FIREBASE_* values.")
      return
    }

    try {
      setError(null)
      await signInWithPopup(auth, googleProvider)
    } catch (signInError) {
      setError(mapFirebaseError(signInError))
    }
  }

  async function signOutUser() {
    if (!auth || !isFirebaseConfigured) return

    try {
      setError(null)
      await signOut(auth)
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Sign-out failed.")
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      error,
      isConfigured: isFirebaseConfigured,
      signInWithGoogle,
      signOutUser
    }),
    [user, loading, error]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider.")
  }

  return context
}
