import { db } from "./mongodb.js";
import { embedText } from "./embeddings.js";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

export async function answerQuestion(question) {

  // create embedding for the question
  const questionEmbedding = await embedText(question);

  // vector search in MongoDB
  const results = await db.collection("chunks").aggregate([
    {
      $vectorSearch: {
        index: "vector_index",
        path: "embedding",
        queryVector: questionEmbedding,
        numCandidates: 100,
        limit: 5
      }
    }
  ]).toArray();

  console.log("Retrieved chunks:", results.length);

  const context = results.map(r => r.text).join("\n\n");

  const prompt = `
You are a financial research assistant.

Use ONLY the provided context to answer.

Context:
${context}

Question:
${question}
`;

  // correct call for @google/genai
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: prompt
  });

  return {
    answer: response.text,
    sources: results
  };
}