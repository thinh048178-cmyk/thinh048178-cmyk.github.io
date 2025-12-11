
import { Injectable } from '@angular/core';
import { GoogleGenAI } from "@google/genai";

// Define interfaces for type safety
export interface Source {
  uri: string;
  title: string;
}

export interface FactCheckResult {
  analysis: string;
  sources: Source[];
  truthPercentage: number;
  verdict: 'True' | 'False' | 'Mixed' | 'Unverifiable';
}

@Injectable({
  providedIn: 'root'
})
export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    // IMPORTANT: The API key is sourced from environment variables.
    // Do not hardcode or expose the API key in the client-side code.
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API_KEY environment variable not set.");
    }
    this.ai = new GoogleGenAI({ apiKey });
  }

  async factCheck(claim: string): Promise<FactCheckResult> {
    const model = 'gemini-2.5-flash';
    const systemInstruction = `You are an impartial and objective fact-checker. Your task is to analyze the user's statement for factual accuracy using the provided web search results.
Your response MUST start with the following three lines, exactly as specified, with no other text before them:
1. A verdict line: \`[VERDICT: verdict]\`, where \`verdict\` is one of \`True\`, \`False\`, \`Mixed\`, or \`Unverifiable\`.
2. A percentage line: \`[TRUTH_PERCENTAGE: percentage]\`, where \`percentage\` is a number between 0 and 100. For an \`Unverifiable\` verdict, this MUST be 0. For a \`True\` verdict, it should be high (e.g., 90-100). For \`False\`, it should be low (e.g., 0-10). For \`Mixed\`, it should be in the middle.
3. An analysis header line: \`[ANALYSIS]\`

After these three lines, provide a concise, neutral summary of your findings in well-formatted markdown. Conclude by restating whether the claim is broadly true, false, a mix of true and false, or lacks sufficient evidence.
Do not include any personal opinions, biases, or moral judgments.
For claims that are personal opinions, hypothetical, speculative, or cannot be verified using web search (e.g., "who is more likely to have taken my wallet?"), your verdict MUST be \`Unverifiable\`.`;

    try {
      const response = await this.ai.models.generateContent({
        model: model,
        contents: `${systemInstruction}\n\nUser statement: "${claim}"`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });

      const rawText = response.text;
      
      const verdictMatch = rawText.match(/\[VERDICT:\s*(.*?)\]/);
      const percentageMatch = rawText.match(/\[TRUTH_PERCENTAGE:\s*(\d+)\]/);
      const analysisStartIndex = rawText.indexOf('[ANALYSIS]');
      
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources: Source[] = groundingChunks
        .filter((chunk: any) => chunk.web && chunk.web.uri && chunk.web.title)
        .map((chunk: any) => ({
          uri: chunk.web.uri,
          title: chunk.web.title,
        }));

      if (!verdictMatch || !percentageMatch || analysisStartIndex === -1) {
        console.error("Response format from AI is invalid, treating as Unverifiable:", rawText);
        return {
            analysis: "The AI's response was not in the expected format. It might be that this claim cannot be verified with the available information.\n\n" + rawText,
            sources: sources,
            truthPercentage: 0,
            verdict: 'Unverifiable'
        };
      }

      const verdict = verdictMatch[1].trim() as 'True' | 'False' | 'Mixed' | 'Unverifiable';
      const truthPercentage = parseInt(percentageMatch[1], 10);
      const analysis = rawText.substring(analysisStartIndex + '[ANALYSIS]'.length).trim();
      
      return { analysis, sources, truthPercentage, verdict };

    } catch (error) {
      console.error('Error calling Gemini API:', error);
      throw new Error('Failed to get a response from the AI. Please check the console for more details.');
    }
  }
}
