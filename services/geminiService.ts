import { GoogleGenAI } from "@google/genai";
import { Region } from '../types';

let genAI: GoogleGenAI | null = null;

if (process.env.API_KEY) {
  genAI = new GoogleGenAI({ apiKey: process.env.API_KEY });
}

export const generateCommentary = async (
  regionScores: Record<Region, number>,
  leadingRegion: Region
): Promise<string> => {
  if (!genAI) return "Waiting for API Key...";

  const prompt = `
  You are an intense, hyped-up E-sports commentator for a "Tank Battle" pixel game.
  The current scores by region are:
  ${JSON.stringify(regionScores)}
  
  The leading region is currently: ${leadingRegion}.

  Generate a ONE sentence, exciting shout-out about the current state of the battle in Traditional Chinese (Taiwan).
  Focus on the rivalry between regions (e.g., if Taichung is winning, say they are dominating).
  Be dramatic! Use exclamation marks!
  `;

  try {
    const response = await genAI.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text.trim();
  } catch (error) {
    console.error("Gemini commentary failed:", error);
    return "連線不穩定，戰況激烈！"; // Fallback
  }
};
