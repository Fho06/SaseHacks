import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(dirname, "../.env") });

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

export async function embedText(text) {

  const response = await ai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text
  });

  return response.embeddings[0].values;
}
