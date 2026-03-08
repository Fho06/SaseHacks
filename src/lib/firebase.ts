import { initializeApp, getApps, type FirebaseApp } from "firebase/app"
import { getAuth, GoogleAuthProvider, type Auth } from "firebase/auth"

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
}

function isPlaceholder(value: string) {
  return value.startsWith("YOUR_")
}

export const isFirebaseConfigured = Object.values(firebaseConfig).every((value) => {
  if (typeof value !== "string") return false
  const trimmed = value.trim()
  if (!trimmed.length) return false
  return !isPlaceholder(trimmed)
})

let app: FirebaseApp | null = null
let auth: Auth | null = null

if (isFirebaseConfigured) {
  app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig)
  auth = getAuth(app)
}

export { auth }
export const googleProvider = new GoogleAuthProvider()
