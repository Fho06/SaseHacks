import test from "node:test"
import assert from "node:assert/strict"
import { getModelText, parseModelJson } from "../portfolio/model-json.js"

test("getModelText reads candidates parts before response.text", () => {
  const response = {
    candidates: [
      {
        content: {
          parts: [{ text: "{\"a\":1}" }]
        }
      }
    ],
    text: ""
  }
  assert.equal(getModelText(response), "{\"a\":1}")
})

test("parseModelJson handles direct json", () => {
  const response = { text: "{\"ok\":true}" }
  const parsed = parseModelJson(response)
  assert.equal(parsed?.ok, true)
})

test("parseModelJson handles fenced json", () => {
  const response = {
    text: "```json\n{\"ticker\":\"MSFT\",\"growth\":{\"questions\":[]}}\n```"
  }
  const parsed = parseModelJson(response)
  assert.equal(parsed?.ticker, "MSFT")
})

test("parseModelJson handles prefixed prose with json block", () => {
  const response = {
    text: "Here is your answer:\n{\"ticker\":\"MSFT\",\"growth\":{\"questions\":[]}}"
  }
  const parsed = parseModelJson(response)
  assert.equal(parsed?.ticker, "MSFT")
})
