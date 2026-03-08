import test from "node:test"
import assert from "node:assert/strict"
import { verifyFirebaseAuth } from "../auth.js"

test("verifyFirebaseAuth returns 401 when token is missing", async () => {
  const req = { headers: {} }
  const responseState = { statusCode: 200, body: null }
  const res = {
    status(code) {
      responseState.statusCode = code
      return this
    },
    json(payload) {
      responseState.body = payload
      return this
    }
  }

  let nextCalled = false
  await verifyFirebaseAuth(req, res, () => {
    nextCalled = true
  })

  assert.equal(nextCalled, false)
  assert.equal(responseState.statusCode, 401)
  assert.equal(responseState.body.error, "Missing auth token. Sign in with Google first.")
})

