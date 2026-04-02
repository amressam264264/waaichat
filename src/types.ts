export interface Character {
  id: string;
  name: string;
  age?: string;
  avatar?: string; // Base64 or URL
  referenceImage?: string; // High-quality reference for image generation (Legacy)
  referenceImages?: string[]; // Multiple high-quality references for image generation
  systemInstruction: string;
  description: string;
  backstory?: string;
  appearance?: string;
  voiceName?: string; // Prebuilt voice name for TTS (e.g., 'Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr')
  voiceStyle?: string; // Additional instructions for the voice (e.g., 'elderly', 'child', 'Russian accent')
  baseMemory?: string[]; // Static facts added in settings
  dynamicMemory?: string[]; // Learned facts from conversations
  memory?: string[]; // Legacy field for migration
  relationships?: Record<string, string>; // targetCharacterId -> relationship description
  relationshipToUser?: string;
  createdAt: number;
  uid: string;
}

export interface Message {
  id: string;
  role: 'user' | 'model';
  characterId?: string;
  characterName?: string;
  content: string;
  timestamp: number;
  type: 'text' | 'image';
  imageUrl?: string;
  generationPrompt?: string; // The exact prompt used to generate the image
  referenceImagesUsed?: string[]; // The exact reference images used
  replyToId?: string;
  replyToContent?: string;
  replyToAuthor?: string;
  isEdited?: boolean;
  emotion?: string;
  emotionEmoji?: string;
}

export interface Chat {
  id: string;
  characterId?: string; // Legacy support
  characterIds?: string[]; // Multiple characters in group chat
  isGroup?: boolean;
  groupName?: string;
  specificInstructions?: string;
  specificUserPersona?: string;
  lastMessageAt: number;
  lastMessageContent?: string;
  uid: string;
  isManualResponseMode?: boolean;
  lockedSeed?: number | null;
  interactionMode?: 'chat' | 'roleplay';
  lastJournaledAt?: number;
  characterEmotions?: Record<string, { emotion: string, emoji: string }>;
}

export interface UserProfile {
  name: string;
  photo?: string;
  age?: string;
  bio?: string;
  otherDetails?: string;
}

export interface JournalEntry {
  id: string;
  chatId: string;
  characterId: string;
  characterName: string;
  content: string;
  timestamp: number;
  uid: string;
}

export interface AppSettings {
  generalInstructions: string;
  imageRetryInstructions: string;
  preferredAspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9';
  preferredImageEngine: 'gemini' | 'pollinations';
  preferredTextEngine?: 'gemini' | 'groq' | 'openrouter';
  interactionMode?: 'chat' | 'roleplay';
  userPersona?: string;
  userProfile?: UserProfile;
  customApiKey?: string;
  pollinationsApiKey?: string;
  openRouterApiKey?: string;
  uid: string;
}

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}
