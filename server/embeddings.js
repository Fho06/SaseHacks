import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

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