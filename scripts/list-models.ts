
import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";
config();

async function listModels() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    const response = await ai.models.list();
    console.log("Response:", JSON.stringify(response, null, 2));
  } catch (error) {
    console.error("Error listing models:", error);
  }
}

listModels();
