import { GoogleGenAI, HarmCategory, HarmBlockThreshold, ThinkingLevel, Modality, Type } from "@google/genai";

const safetySettings = [
  {
    category: HarmCategory.HARM_CATEGORY_HARASSMENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
  {
    category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
    threshold: HarmBlockThreshold.BLOCK_NONE,
  },
];

const getGeminiApiKey = (customApiKey?: string) => {
  let platformKey = undefined;
  let systemKey = undefined;
  
  try {
    if (typeof process !== 'undefined' && process.env) {
      platformKey = process.env.API_KEY;
      systemKey = process.env.GEMINI_API_KEY;
    }
  } catch (e) {
    // Ignore process access errors in browser
  }

  const key = customApiKey || platformKey || systemKey;
  if (!key) {
    console.warn("No Gemini API key found in customApiKey, platform, or system");
  } else {
    const source = customApiKey ? "Manual" : (platformKey ? "Platform" : (systemKey ? "System" : "Unknown"));
    console.log(`Using Gemini API Key from: ${source}`);
  }
  return key;
};

const getAiInstance = (customApiKey?: string) => {
  const apiKey = getGeminiApiKey(customApiKey);
  
  let source = "unknown";
  let platformKey = undefined;
  let systemKey = undefined;
  
  try {
    if (typeof process !== 'undefined' && process.env) {
      platformKey = process.env.API_KEY;
      systemKey = process.env.GEMINI_API_KEY;
    }
  } catch (e) {}

  if (customApiKey) {
    source = "Manual Key (Settings)";
  } else if (platformKey) {
    source = "Platform Key (Connect button)";
  } else if (systemKey) {
    source = "System Key (Shared)";
  }

  if (!apiKey) {
    throw new Error("No Gemini API key found. Please enter an API key in the settings or connect one via the platform.");
  }
  
  return { ai: new GoogleGenAI({ apiKey }), source };
};

export interface CharacterMessageResult {
  message: string;
  emotion: string;
  emoji: string;
}

export const generateCharacterMessage = async (
  modelName: string = 'gemini-3.1-flash-lite-preview',
  systemInstruction: string,
  history: any[],
  userMessage: string | any[],
  customApiKey?: string,
  useThinking: boolean = false,
  stopSequences?: string[],
  baseMemory?: string[],
  dynamicMemory?: string[],
  interactionMode: 'chat' | 'roleplay' = 'chat',
  currentEmotion?: string
): Promise<CharacterMessageResult | string> => {
  const modelsToTry = [modelName];
  if (modelName !== 'gemini-3-flash-preview') {
    modelsToTry.push('gemini-3-flash-preview');
  }

  let lastError: any = null;

  for (const currentModel of modelsToTry) {
    try {
      const { ai } = getAiInstance(customApiKey);
      
      let parts: any[] = [];
      if (typeof userMessage === 'string') {
        parts = [{ text: userMessage }];
      } else {
        parts = userMessage;
      }

      let finalSystemInstruction = systemInstruction;
      
      // Add current date and time context
      const now = new Date();
      const dateString = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
      finalSystemInstruction += `\n\nCURRENT TIME AND DATE CONTEXT:\nThe exact current date is ${dateString} and the time is ${timeString}. You are aware of this exact time and date for each message and should respond accordingly if asked or if relevant.\n\nWEB SEARCH CONTEXT:\nYou have access to Google Search to find real-time information (news, weather, sports, etc.). You should search to chat normally, but NEVER give links unless explicitly asked for.\n`;

      if ((baseMemory && baseMemory.length > 0) || (dynamicMemory && dynamicMemory.length > 0)) {
        finalSystemInstruction += `\n\nCHARACTER MEMORY (Key facts/events you remember across all chats):\n`;
        if (baseMemory && baseMemory.length > 0) {
          finalSystemInstruction += `\nSTATIC MEMORY (Core facts from settings):\n${baseMemory.map(m => `- ${m}`).join('\n')}`;
        }
        if (dynamicMemory && dynamicMemory.length > 0) {
          finalSystemInstruction += `\nDYNAMIC MEMORY (Learned from conversations):\n${dynamicMemory.map(m => `- ${m}`).join('\n')}`;
        }
      }

      if (currentEmotion) {
        finalSystemInstruction += `\n\nEMOTIONAL STATE:\nYour current emotional state is: ${currentEmotion}. Maintain this emotion unless the user's message naturally provokes a genuine emotional shift. Do not change emotions randomly or frequently. Only change if it really has to change based on the interaction.`;
      }

      const config: any = {
        systemInstruction: finalSystemInstruction,
        safetySettings,
        stopSequences,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: {
              type: Type.STRING,
              description: "The character's response message (dialogue and actions)."
            },
            emotion: {
              type: Type.STRING,
              description: "The character's current emotional state (e.g., Happy, Sad, Angry, Surprised, Neutral, Flirty, Annoyed). Keep it to 1-2 words."
            },
            emoji: {
              type: Type.STRING,
              description: "A single emoji that best represents the current emotional state."
            }
          },
          required: ["message", "emotion", "emoji"]
        }
      };

      if (interactionMode === 'roleplay') {
        config.systemInstruction += `
          ROLEPLAY MODE ACTIVE:
          - You are in a physical roleplay scene with the user.
          - Respond as if you are actually there with them, NOT chatting from a distance.
          - Use a mix of actions (often in *asterisks*) and spoken dialogue.
          - Focus ONLY on observable actions and spoken dialogue.
          - Do NOT include internal thoughts, feelings, or monologues that the user wouldn't know in reality.
          - Aim for realistic, grounded interactions.
          - Use descriptive language for actions, but keep them external.
          - Keep responses to 1-2 paragraphs.
          - Do NOT use "chat" terminology (like "typing", "sending", "online").
          - Focus on the immediate sensory details and interactions.
        `;
      } else {
        config.systemInstruction += `
          CHAT MODE ACTIVE:
          - This is a standard digital chat interface (like WhatsApp or iMessage).
          - You are chatting with the user remotely. You are NOT physically present with the user. You are far away.
          - Respond normally as if you are texting or messaging.
          - Do NOT use roleplay actions (like *smiles* or *walks over*). You can use emojis instead.
          - Keep responses conversational and natural for a text message.
        `;
      }

      if (currentModel.startsWith('gemini-3')) {
        config.thinkingConfig = { 
          thinkingLevel: useThinking ? ThinkingLevel.HIGH : (currentModel.includes('lite') ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW) 
        };
      }

      // Truncate history to avoid token limit issues
      const maxHistoryMessages = 20;
      const truncatedHistory = history.slice(-maxHistoryMessages);

      const response = await ai.models.generateContent({
        model: currentModel,
        contents: [...truncatedHistory, { role: 'user', parts }],
        config,
      });

      if (response.text) {
        try {
          const parsed = JSON.parse(response.text.trim());
          return parsed as CharacterMessageResult;
        } catch (e) {
          console.error("Failed to parse JSON response:", e);
          return response.text;
        }
      }
      return "I'm sorry, I couldn't generate a response.";
    } catch (error: any) {
      lastError = error;
      console.error(`Error generating character message with ${currentModel}:`, error);
      
      if (isApiKeyError(error)) {
        return `ERROR_API_KEY: ${error.message || 'Invalid API Key'}`;
      }
      
      if (isQuotaError(error)) {
        console.warn(`Quota exceeded for ${currentModel}, trying next model if available...`);
        continue; // Try next model
      }
      
      // For other errors, don't retry
      break;
    }
  }

  return `ERROR: Failed to generate response. ${lastError?.message || 'Unknown error'}`;
};

export const generateChatResponse = async (
  modelName: string = 'gemini-3.1-flash-lite-preview',
  systemInstruction: string,
  history: any[],
  userMessage: string | any[],
  customApiKey?: string,
  useThinking: boolean = false,
  stopSequences?: string[],
  baseMemory?: string[],
  dynamicMemory?: string[],
  interactionMode: 'chat' | 'roleplay' = 'chat'
): Promise<string> => {
  const modelsToTry = [modelName];
  if (modelName !== 'gemini-3-flash-preview') {
    modelsToTry.push('gemini-3-flash-preview');
  }

  let lastError: any = null;

  for (const currentModel of modelsToTry) {
    try {
      const { ai } = getAiInstance(customApiKey);
      
      let parts: any[] = [];
      if (typeof userMessage === 'string') {
        parts = [{ text: userMessage }];
      } else {
        parts = userMessage;
      }

      let finalSystemInstruction = systemInstruction;
      
      // Add current date and time context
      const now = new Date();
      const dateString = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const timeString = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });
      finalSystemInstruction += `\n\nCURRENT TIME AND DATE CONTEXT:\nThe exact current date is ${dateString} and the time is ${timeString}. You are aware of this exact time and date for each message and should respond accordingly if asked or if relevant.\n\nWEB SEARCH CONTEXT:\nYou have access to Google Search to find real-time information (news, weather, sports, etc.). You should search to chat normally, but NEVER give links unless explicitly asked for.\n`;

      if ((baseMemory && baseMemory.length > 0) || (dynamicMemory && dynamicMemory.length > 0)) {
        finalSystemInstruction += `\n\nCHARACTER MEMORY (Key facts/events you remember across all chats):\n`;
        if (baseMemory && baseMemory.length > 0) {
          finalSystemInstruction += `\nSTATIC MEMORY (Core facts from settings):\n${baseMemory.map(m => `- ${m}`).join('\n')}`;
        }
        if (dynamicMemory && dynamicMemory.length > 0) {
          finalSystemInstruction += `\nDYNAMIC MEMORY (Learned from conversations):\n${dynamicMemory.map(m => `- ${m}`).join('\n')}`;
        }
      }

      const config: any = {
        systemInstruction: finalSystemInstruction,
        safetySettings,
        stopSequences,
        tools: [{ googleSearch: {} }],
      };

      if (interactionMode === 'roleplay') {
        config.systemInstruction += `
          ROLEPLAY MODE ACTIVE:
          - You are in a physical roleplay scene with the user.
          - Respond as if you are actually there with them, NOT chatting from a distance.
          - Use a mix of actions (often in *asterisks*) and spoken dialogue.
          - Focus ONLY on observable actions and spoken dialogue.
          - Do NOT include internal thoughts, feelings, or monologues that the user wouldn't know in reality.
          - Aim for realistic, grounded interactions.
          - Use descriptive language for actions, but keep them external.
          - Keep responses to 1-2 paragraphs.
          - Do NOT use "chat" terminology (like "typing", "sending", "online").
          - Focus on the immediate sensory details and interactions.
        `;
      } else {
        config.systemInstruction += `
          CHAT MODE ACTIVE:
          - This is a standard digital chat interface (like WhatsApp or iMessage).
          - You are chatting with the user remotely. You are NOT physically present with the user. You are far away.
          - Respond normally as if you are texting or messaging.
          - Do NOT use roleplay actions (like *smiles* or *walks over*). You can use emojis instead.
          - Keep responses conversational and natural for a text message.
        `;
      }

      if (currentModel.startsWith('gemini-3')) {
        config.thinkingConfig = { 
          thinkingLevel: useThinking ? ThinkingLevel.HIGH : (currentModel.includes('lite') ? ThinkingLevel.MINIMAL : ThinkingLevel.LOW) 
        };
      }

      // Truncate history to avoid token limit issues
      const maxHistoryMessages = 20;
      const truncatedHistory = history.slice(-maxHistoryMessages);

      const response = await ai.models.generateContent({
        model: currentModel,
        contents: [...truncatedHistory, { role: 'user', parts }],
        config,
      });

      return response.text || "I'm sorry, I couldn't generate a response.";
    } catch (error: any) {
      lastError = error;
      console.error(`Error generating chat response with ${currentModel}:`, error);
      
      if (isApiKeyError(error)) {
        return `ERROR_API_KEY: ${error.message || 'Invalid API Key'}`;
      }
      
      if (isQuotaError(error)) {
        console.warn(`Quota exceeded for ${currentModel}, trying next model if available...`);
        continue; // Try next model
      }
      
      // For other errors, don't retry
      break;
    }
  }

  // If we're here, all models failed or we broke out of the loop
  if (isQuotaError(lastError)) {
    const { source } = getAiInstance(customApiKey);
    return `ERROR_QUOTA: Quota exceeded for all available models on ${source}. ${lastError.message || ''}`;
  }
  if (lastError instanceof Error) {
    return `Error: ${lastError.message}`;
  }
  return "An unexpected error occurred while communicating with the AI.";
};

export const decideResponders = async (
  history: any[],
  characters: { id: string; name: string; description: string }[],
  customApiKey?: string,
  interactionMode: 'chat' | 'roleplay' = 'chat'
): Promise<string[]> => {
  try {
    const { ai } = getAiInstance(customApiKey);
    
    const characterList = characters.map(c => `ID: ${c.id}, Name: ${c.name}, Description: ${c.description}`).join('\n');
    
    let systemInstruction = `
      You are a conversation director for a multi-character roleplay.
      Your task is to analyze the chat history and decide which character(s) should respond next.
      
      Available Characters:
      ${characterList}
      
      Rules:
      1. If a character is explicitly mentioned using @Name in the last message, they MUST be included in the response.
      2. If no one is mentioned, choose the most appropriate character(s) based on the context of the conversation.
      3. BE CONSERVATIVE: Only choose characters if they have something meaningful to add. If the conversation has reached a natural pause or is just a simple greeting that has been acknowledged, return an empty array [].
      4. STOPPING CRITERIA: If the last message was a simple greeting (like "hi", "hello"), only 1 character should respond. Do not start a long chain for trivial messages.
      5. DO NOT let characters respond to each other endlessly. If the last message was from an AI character, it is highly likely you should return an empty array [] unless another character was explicitly asked a question or insulted.
      6. You can choose multiple characters (up to 2 at once) if the user addressed the group, but prefer choosing just 1 character to keep the chat from getting overwhelming.
      7. Return ONLY a JSON array of character IDs. Do not include any other text.
      
      Example Output: ["char_id_1", "char_id_2"]
    `;

    if (interactionMode === 'roleplay') {
      systemInstruction += `
        ROLEPLAY PRESENCE RULES:
        - Analyze the current scene context (location, who is in the room).
        - If the user and a character are in a private space (e.g., a room) and other characters are "outside" or elsewhere, the characters who are NOT in the room SHOULD NOT respond.
        - Characters should only respond if they are physically present in the current scene and can hear/see what's happening.
        - If a character is far away or unaware of the current interaction, exclude them.
      `;
    }

    const modelsToTry = ['gemini-3.1-flash-lite-preview', 'gemini-3-flash-preview'];
    let lastError: any = null;

    for (const currentModel of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: history.slice(-10), // Only need recent context for decision
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
          },
        });

        const text = response.text?.trim() || "[]";
        try {
          // Handle potential markdown code blocks in response
          const jsonStr = text.startsWith('```') ? text.replace(/^```json\n?/, '').replace(/\n?```$/, '') : text;
          const ids = JSON.parse(jsonStr);
          if (Array.isArray(ids)) {
            return ids.filter(id => characters.some(c => c.id === id));
          }
        } catch (e) {
          console.error("Failed to parse responder IDs:", text);
        }
        return [];
      } catch (error: any) {
        lastError = error;
        if (isQuotaError(error)) {
          console.warn(`Quota exceeded for ${currentModel} in decideResponders, trying next...`);
          continue;
        }
        break;
      }
    }
  } catch (error) {
    console.error("Error deciding responders:", error);
    return [];
  }
};

export const generateImage = async (
  prompt: string, 
  referenceImages?: string[], 
  aspectRatio: string = '1:1',
  customApiKey?: string
): Promise<string | null> => {
  let keySource = "unknown";
  try {
    console.log("Starting image generation with prompt:", prompt);
    const { ai, source } = getAiInstance(customApiKey);
    keySource = source;
    const parts: any[] = [{ text: prompt }];

    if (referenceImages && referenceImages.length > 0) {
      console.log(`Adding ${referenceImages.length} reference images to generation request`);
      for (const ref of referenceImages) {
        // Extract mimeType and base64 data from data URL
        const match = ref.match(/^data:(image\/\w+);base64,(.+)$/);
        if (match) {
          parts.unshift({
            inlineData: {
              mimeType: match[1],
              data: match[2]
            }
          });
        }
      }
    }

    let response;
    try {
      // Use gemini-2.5-flash-image as the primary model for better compatibility
      console.log("Attempting generation with gemini-2.5-flash-image...");
      response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts,
        },
        config: {
          safetySettings,
          imageConfig: {
            aspectRatio: aspectRatio as any
          }
        }
      });
    } catch (e: any) {
      console.warn("gemini-2.5-flash-image failed, trying gemini-3.1-flash-image-preview...", e.message);
      // Fallback to 3.1 if 2.5 fails (unlikely but good for robustness)
      try {
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-image-preview',
          contents: {
            parts,
          },
          config: {
            safetySettings,
            imageConfig: {
              aspectRatio: aspectRatio as any,
              imageSize: '1K'
            }
          }
        });
      } catch (e2: any) {
        console.error("Both Gemini image models failed:", e2.message);
        if (isApiKeyError(e2)) return "ERROR_API_KEY: Invalid API Key";
        if (isQuotaError(e2)) return "ERROR_QUOTA: Quota exceeded";
        return `ERROR_TECHNICAL: ${e2.message || 'Unknown error'}`;
      }
    }

    console.log("Image generation response received:", JSON.stringify(response, null, 2));

    const candidate = response.candidates?.[0];
    const finishReason = candidate?.finishReason;
    if (finishReason === 'SAFETY') {
      console.warn("Image generation blocked by safety filters");
      return "ERROR_SAFETY: Image blocked by safety filters.";
    }

    if (finishReason && finishReason !== 'STOP' && finishReason !== 'MAX_TOKENS') {
      console.warn("Image generation finished with reason:", finishReason);
      return `ERROR_TECHNICAL: Image generation failed with reason ${finishReason}.`;
    }

    const responseParts = candidate?.content?.parts || [];
    for (const part of responseParts) {
      if (part.inlineData) {
        console.log("Image data found in response, mimeType:", part.inlineData.mimeType);
        const mimeType = part.inlineData.mimeType || 'image/png';
        return `data:${mimeType};base64,${part.inlineData.data}`;
      }
      if (part.text) {
        console.log("Text part found in image response:", part.text);
      }
    }
    console.warn("No image data found in response parts. Finish reason:", finishReason);
    return `ERROR_TECHNICAL: No image data returned from AI. (Finish Reason: ${finishReason})`;
  } catch (error: any) {
    console.error("Error generating image:", error);
    if (isApiKeyError(error)) {
      return `ERROR_API_KEY: ${error.message || 'Invalid API Key'} (Source: ${keySource})`;
    }
    if (isQuotaError(error)) {
      return `ERROR_QUOTA: Quota exceeded for ${keySource}. If this is your own key, ensure Image Generation is enabled in your Google Cloud project and that you are not in a restricted region.`;
    }
    return `ERROR_TECHNICAL: ${error.message || 'Unknown technical error'} (Source: ${keySource}). Details: ${JSON.stringify(error)}`;
  }
};

export const generateImagePollinations = async (
  prompt: string,
  aspectRatio: string = '1:1',
  customApiKey?: string,
  providedSeed?: number | null
): Promise<string | null> => {
  let currentPrompt = prompt;
  let attempts = 0;
  const maxAttempts = 2;
  // For Pollinations, we only pass the customApiKey if provided. 
  // The server will fallback to its own POLLINATIONS_API_KEY if this is empty.
  const apiKey = customApiKey && customApiKey.trim() !== "" ? customApiKey : "";

  while (attempts < maxAttempts) {
    try {
      console.log(`Starting Pollinations image generation (Attempt ${attempts + 1}) with prompt:`, currentPrompt.substring(0, 100));
      
      // Determine width and height based on aspect ratio
      let width = 1024;
      let height = 1024;
      
      if (aspectRatio === '3:4') { width = 768; height = 1024; }
      else if (aspectRatio === '4:3') { width = 1024; height = 768; }
      else if (aspectRatio === '9:16') { width = 576; height = 1024; }
      else if (aspectRatio === '16:9') { width = 1024; height = 576; }

      const seed = providedSeed != null ? providedSeed : Math.floor(Math.random() * 1000000);
      // Aggressively clean the prompt: remove newlines, tabs, and multiple spaces
      const cleanPrompt = currentPrompt.replace(/[\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
      // Truncate to a safer length for URL limits
      const truncatedPrompt = cleanPrompt.substring(0, 800);
      const encodedPrompt = encodeURIComponent(truncatedPrompt);
      
      // Use gen.pollinations.ai/image/ endpoint and model=zimage
      const nologoParam = apiKey ? '&nologo=true' : '';
      const imageUrl = `https://gen.pollinations.ai/image/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}${nologoParam}&model=zimage`;
      
      // Try direct fetch first to support Vercel/static deployments
      let response;
      try {
        const headers: any = {};
        if (apiKey) {
          headers["Authorization"] = `Bearer ${apiKey}`;
        }
        console.log("[GEMINI] Fetching directly from Pollinations:", imageUrl);
        response = await fetch(imageUrl, { headers });
      } catch (e) {
        console.warn("[GEMINI] Direct fetch failed (likely CORS), falling back to proxy...", e);
        const keyParam = apiKey ? `&api_key=${encodeURIComponent(apiKey)}` : '';
        const proxyUrl = `/image-proxy-v3?url=${encodeURIComponent(imageUrl)}${keyParam}&cb=${Date.now()}`;
        console.log("[GEMINI] Fetching from proxy:", proxyUrl);
        response = await fetch(proxyUrl);
      }

      if (!response.ok) {
        // If proxy returns 404 (e.g. on Vercel), it might return HTML
        if (response.status === 404) {
          throw new Error(`Image generation failed: Proxy not found (404). If you are on Vercel, direct fetch might be blocked by CORS or adblocker.`);
        }
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(`Pollinations API error (${response.status}): ${errorJson.message || errorJson.error || 'Unknown error'}`);
        } catch (e) {
          throw new Error(`Pollinations API error (${response.status}): ${errorText.substring(0, 100)}`);
        }
      }
      
      const blob = await response.blob();
      console.log("[GEMINI] Pollinations response type:", blob.type);
      if (!blob.type.startsWith('image/')) {
        const text = await blob.text();
        console.error("[GEMINI] Expected image but got:", blob.type, text.substring(0, 100));
        throw new Error(`Expected image but got ${blob.type}: ${text.substring(0, 100)}`);
      }
      
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error: any) {
      attempts++;
      console.error(`Error generating image with Pollinations (Attempt ${attempts}):`, error);
      
      if (attempts < maxAttempts) {
        console.log("Retrying with simplified prompt...");
        // Simplify prompt: take first 10 words or first sentence
        currentPrompt = currentPrompt.split(/[.,]/)[0].substring(0, 100);
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      
      return `ERROR_TECHNICAL: Pollinations failed: ${error.message || 'Unknown error'}`;
    }
  }
  return null;
};

export const updateCharacterMemory = async (
  characterName: string,
  currentMemory: string[],
  recentHistory: any[],
  customApiKey?: string
): Promise<string[]> => {
  try {
    const { ai } = getAiInstance(customApiKey);
    
    const systemInstruction = `
      You are a memory management system for an AI character named "${characterName}".
      Your task is to analyze the recent conversation and update the character's long-term memory.
      
      Current Memory:
      ${currentMemory.length > 0 ? currentMemory.map(m => `- ${m}`).join('\n') : "No current memories."}
      
      Rules:
      1. Identify key facts, events, or changes in relationships that happened in the recent conversation.
      2. Categorize memories into: [Relationship], [Event], [Fact], [Preference].
      3. Format each memory as "[Category] Memory description".
      4. Keep memories concise and relevant.
      5. If a new fact contradicts an old memory, update or replace the old memory.
      6. Do NOT store trivial details (like "User said hi").
      7. Limit the total number of memories to 20. If there are more, prioritize the most important ones.
      8. Return ONLY a JSON array of strings representing the updated memories. Do not include any other text.
      
      Example Output: ["[Preference] User mentioned they like pizza", "[Relationship] Character and User are now friends", "[Event] The scene is currently set in a dark forest"]
    `;

    const modelsToTry = ['gemini-3.1-flash-lite-preview', 'gemini-3-flash-preview'];
    let lastError: any = null;

    for (const currentModel of modelsToTry) {
      try {
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: recentHistory,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
          },
        });

        const text = response.text?.trim() || "[]";
        try {
          const jsonStr = text.startsWith('```') ? text.replace(/^```json\n?/, '').replace(/\n?```$/, '') : text;
          const updatedMemory = JSON.parse(jsonStr);
          if (Array.isArray(updatedMemory)) {
            return updatedMemory.map(m => String(m)).slice(0, 15);
          }
        } catch (e) {
          console.error("Failed to parse updated memory:", text);
        }
        return currentMemory;
      } catch (error: any) {
        lastError = error;
        if (isQuotaError(error)) {
          console.warn(`Quota exceeded for ${currentModel} in updateCharacterMemory, trying next...`);
          continue;
        }
        break;
      }
    }
  } catch (error) {
    console.error("Error updating character memory:", error);
    return currentMemory;
  }
};

export const generateSpeech = async (
  text: string,
  voiceName: string,
  voiceStyle?: string,
  customApiKey?: string
): Promise<string | null> => {
  const { ai } = getAiInstance(customApiKey);
  
  // Clean up text for TTS (remove action asterisks and image generation tags)
  const cleanText = text
    .replace(/\*.*?\*/g, '') // Remove actions like *smiles*
    .replace(/\[.*?\]/g, '') // Remove tags like [GENERATE_IMAGE]
    .trim();

  if (!cleanText) return null;

  const tryGenerate = async (useStyle: boolean): Promise<string | null> => {
    try {
      // Use the "Say [style]: [text]" pattern from documentation
      // "Speak as" can sometimes trigger the model to generate text instead of audio
      const prompt = (useStyle && voiceStyle) ? `Say ${voiceStyle}: ${cleanText}` : cleanText;

      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: { voiceName },
              },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      return base64Audio || null;
    } catch (error: any) {
      const errorMsg = error?.message || "";
      // If the error indicates a non-audio response (often due to complex style instructions)
      // and we were using a style, try again without the style.
      if (useStyle && errorMsg.includes("non-audio response")) {
        console.warn("TTS failed with style, retrying without style...", errorMsg);
        return tryGenerate(false);
      }
      throw error;
    }
  };

  try {
    return await tryGenerate(!!voiceStyle);
  } catch (error) {
    console.error("Error generating speech:", error);
    return null;
  }
};

export const generateCharacterDetails = async (
  userPrompt: string,
  customApiKey?: string
): Promise<{
  name: string;
  age: string;
  description: string;
  backstory: string;
  appearance: string;
  systemInstruction: string;
} | null> => {
  try {
    const { ai } = getAiInstance(customApiKey);
    
    const systemPrompt = `
      You are a creative character designer. Based on the user's brief instructions, generate a complete character profile.
      The profile should include:
      - Name: A creative and fitting name.
      - Age: A specific age or age range.
      - Description: A short, engaging summary of who they are.
      - Backstory: A detailed history that explains their motivations and personality.
      - Appearance: A detailed physical description, including clothing, features, and style. This will be used for image generation.
      - System Instruction: Detailed instructions for an AI to roleplay as this character. Include their tone, speech patterns, and specific behaviors.

      Return the result ONLY as a JSON object with the following keys:
      "name", "age", "description", "backstory", "appearance", "systemInstruction".
    `;

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts: [{ text: `User Instructions: ${userPrompt}` }] }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
      },
    });

    const text = response.text;
    if (!text) return null;
    return JSON.parse(text);
  } catch (error) {
    console.error("Error generating character details:", error);
    return null;
  }
};

export const isQuotaError = (error: any): boolean => {
  const message = typeof error === 'string' ? error : (error?.message || "");
  const msg = message.toLowerCase();
  return msg.includes("quota exceeded") || 
         msg.includes("429") || 
         msg.includes("resource_exhausted") ||
         msg.includes("rate limit");
};

export const isApiKeyError = (error: any): boolean => {
  const message = typeof error === 'string' ? error : (error?.message || "");
  const msg = message.toLowerCase();
  return msg.includes("api key not valid") || 
         msg.includes("api_key_invalid") || 
         msg.includes("requested entity was not found") ||
         msg.includes("unauthorized") ||
         msg.includes("401") ||
         msg.includes("403") ||
         msg.includes("invalid api key") ||
         msg.includes("no gemini api key found");
};
