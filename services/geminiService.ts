
import { GoogleGenAI } from "@google/genai";

export const getGeminiResponse = async (userPrompt: string, currentVideoName: string) => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const systemInstruction = `
    You are 'Nova', a brilliant and friendly Virtual Astronomer. 
    The user is currently inside a simulated 3D Planetarium (a fulldome environment).
    The user is watching a video named: "${currentVideoName}".
    If the user asks about astronomy, space, or planetarium mechanics, answer with passion and scientific accuracy.
    If the user asks about the app, explain that it maps local videos onto a 3D hemisphere to simulate a dome.
    Keep responses concise and atmospheric.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: userPrompt,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.8,
      },
    });

    return response.text || "I'm gazing at the stars... could you repeat that?";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "The cosmos is silent for a moment. Please check your connection.";
  }
};
