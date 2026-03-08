import admin from "firebase-admin"

function getServiceAccountConfig() {
  const projectId = process.env.FIREBASE_PROJECT_ID
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL
  const rawPrivateKey = process.env.FIREBASE_PRIVATE_KEY

  if (!projectId || !clientEmail || !rawPrivateKey) {
    return null
  }

  return {
    projectId,
    clientEmail,
    privateKey: rawPrivateKey.replace(/\\n/g, "\n")
  }
}

function ensureFirebaseAdmin() {
  if (admin.apps.length > 0) {
    return true
  }

  const serviceAccount = getServiceAccountConfig()
  if (!serviceAccount) {
    return false
  }

  try {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    })
  } catch (error) {
    console.error("Firebase Admin initialization failed:", error?.message || error)
    return false
  }

  return true
}

export async function verifyFirebaseAuth(req, res, next) {
  const header = req.headers.authorization || ""
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : ""

  if (!token) {
    return res.status(401).json({ error: "Missing auth token. Sign in with Google first." })
  }

  if (!ensureFirebaseAdmin()) {
    return res.status(500).json({
      error: "Firebase Admin is not configured. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in server/.env."
    })
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token)
    req.auth = {
      userId: decoded.uid,
      email: decoded.email || null
    }
    next()
  } catch {
    return res.status(401).json({ error: "Invalid auth token." })
  }
}
