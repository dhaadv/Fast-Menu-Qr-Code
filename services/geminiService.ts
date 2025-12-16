import { GoogleGenAI, Type } from "@google/genai";
import { RestaurantMenu, Language } from "../types";
import { translations } from "../utils/translations";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Schema definitions for structured output
const slugSchema = {
  type: Type.OBJECT,
  properties: {
    public_slug: { type: Type.STRING, description: "A URL-friendly slug based on the establishment name (e.g., 'joes-burgers')." }
  },
  required: ["public_slug"]
};

const menuSchema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    themeColor: { type: Type.STRING, enum: ["orange", "red", "slate", "emerald", "blue"] },
    categories: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                price: { type: Type.STRING }
              },
              required: ["name", "price"]
            }
          }
        },
        required: ["title", "items"]
      }
    }
  },
  required: ["name", "categories", "themeColor"]
};

export const generateSlug = async (establishmentName: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `Generate a public URL slug for a restaurant named "${establishmentName}". Return ONLY JSON.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: slugSchema
      }
    });
    const data = JSON.parse(response.text || "{}");
    return data.public_slug?.toLowerCase().replace(/[^a-z0-9-]/g, '-') || crypto.randomUUID().slice(0, 8);
  } catch (e) {
    return establishmentName.toLowerCase().replace(/[^a-z0-9]/g, '-') + "-" + Math.floor(Math.random()*1000);
  }
};

export const generateMenuFromAI = async (
  establishmentName: string, 
  businessType: string,
  extraDetails: string = "", 
  language: Language = 'pt',
  menuImage?: string // Optional base64 image string
): Promise<Omit<RestaurantMenu, 'id' | 'createdAt' | 'slug'>> => {
  try {
    const t = translations[language];
    const langName = language === 'pt' ? 'Portuguese' : 'English';
    let contents: any;

    if (menuImage) {
        // Vision Mode: Analyze the uploaded image
        const base64Data = menuImage.split(',')[1];
        const mimeType = menuImage.split(';')[0].split(':')[1];
        
        const prompt = `Function: generate_menu_from_image
        Context: Business Type is "${businessType}". Name is "${establishmentName}".
        Task: Extract menu items, prices and categories from the image. 
        Language: ${langName}.
        
        Rules:
        - Normalize prices to standard format (e.g. $10.00 or R$10,00).
        - Create short descriptions if missing.
        - Infer a theme color.`;

        contents = {
          parts: [
            { inlineData: { mimeType, data: base64Data } },
            { text: prompt }
          ]
        };
    } else {
        // Text Generation Mode
        const prompt = `Function: generate_menu_from_text
        Context: Business Type is "${businessType}". Name is "${establishmentName}".
        Extra Info: ${extraDetails}
        Language: ${langName}.

        Task: Create a structured menu.
        - 3 to 6 categories.
        - 3 to 5 items per category.
        - Generate commercial descriptions (max 15 words).
        - Assign realistic prices.
        - Choose a theme color (orange, red, slate, emerald, blue).`;
        
        contents = prompt;
    }

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        responseMimeType: "application/json",
        responseSchema: menuSchema
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      return {
          ...data,
          businessType
      };
    }
    throw new Error("No data returned from AI");
  } catch (error) {
    console.error("Gemini generation failed", error);
    // Fallback if AI fails (basic template)
    return {
      name: establishmentName,
      businessType: businessType,
      themeColor: "orange",
      categories: [
        {
          title: language === 'pt' ? "Populares" : "Popular Items",
          items: [
            { name: "Signature Dish", description: language === 'pt' ? "Especial da casa." : "Our house special.", price: "12.00" }
          ]
        }
      ]
    };
  }
};

export const generateMenuItemImage = async (itemName: string, itemDesc: string): Promise<string | null> => {
  try {
    const prompt = `Professional food photography, close up, studio lighting, appetizing view of: ${itemName}. ${itemDesc}. High resolution, delicious.`;
    
    // Using gemini-2.5-flash-image for standard image generation tasks
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: "1:1",
        }
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image generation failed", error);
    return null;
  }
};

export const generateItemDescription = async (
    itemName: string,
    businessType: string,
    language: Language
  ): Promise<string> => {
    try {
      const langName = language === 'pt' ? 'Portuguese' : 'English';
      const prompt = `Write a concise, mouth-watering, appetizing description (max 15 words) for a menu item named "${itemName}". The establishment is a ${businessType}. Language: ${langName}. Return ONLY the text, no quotes.`;
      
      const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: prompt,
      });
      return response.text?.trim() || "";
    } catch (e) {
        console.error("Description generation failed", e);
        return "";
    }
};

export const chatWithMenu = async (message: string, menuContext: RestaurantMenu, language: Language): Promise<string> => {
  try {
    const menuString = JSON.stringify(menuContext);
    const systemInstruction = `You are a helpful, polite waiter AI for the restaurant "${menuContext.name}". 
    Answer questions based ONLY on this menu data: ${menuString}. 
    If asked about items not on the menu, politely say you don't serve that. 
    Keep answers concise (max 3 sentences). 
    Respond in ${language === 'pt' ? 'Portuguese' : 'English'}.`;

    const response = await ai.models.generateContent({
      model: "gemini-3-pro-preview",
      contents: message,
      config: {
        systemInstruction: systemInstruction,
        thinkingConfig: { thinkingBudget: 1024 } 
      }
    });

    return response.text || "Sorry, I am busy right now.";
  } catch (error) {
    console.error("Chat failed", error);
    return language === 'pt' ? "Desculpe, estou tendo problemas para responder agora." : "Sorry, I'm having trouble responding right now.";
  }
};