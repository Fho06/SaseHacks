import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const models = await ai.models.list();

for await (const m of models) {
  console.log(m.name, m.supportedGenerationMethods);
}