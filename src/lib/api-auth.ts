import { auth } from "@/lib/firebase"

export async function getAuthHeader(): Promise<Record<string, string>> {
  if (!auth?.currentUser) {
    return {}
  }

  const token = await auth.currentUser.getIdToken()
  if (!token) {
    return {}
  }

  return {
    Authorization: `Bearer ${token}`
  }
}
