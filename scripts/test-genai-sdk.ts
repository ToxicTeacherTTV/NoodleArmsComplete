
import { GoogleGenAI } from "@google/genai";
import { config } from "dotenv";
config();

async function testGenAI() {
  console.log("Testing GoogleGenAI SDK...");
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  
  try {
    console.log("Sending request...");
    const result = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: "Say hello",
      config: {
        responseMimeType: "text/plain"
      }
    });
    
    console.log("Response received.");
    console.log("Keys in result:", Object.keys(result));
    console.log("result.text:", result.text);
    
    if (typeof result.text === 'function') {
        console.log("result.text():", result.text());
    }
    
  } catch (error) {
    console.error("Error:", error);
  }
}

testGenAI();
