import { z } from 'zod';

export interface AIResponse {
    content: string;
    processingTime: number;
    retrievedContext?: string;
    wasRegenerated?: boolean;
}

export interface ConsolidatedMemory {
    type: 'FACT' | 'PREFERENCE' | 'LORE' | 'CONTEXT';
    content: string;
    importance: number;
}

// Zod schema for validating consolidated memories from AI
export const ConsolidatedMemorySchema = z.object({
    type: z.enum(['FACT', 'PREFERENCE', 'LORE', 'CONTEXT']),
    content: z.string().min(1, 'Content cannot be empty'),
    importance: z.number().min(1).max(5)
});

export interface StoryExtractionResult {
    content: string;
    type: 'STORY' | 'LORE' | 'CONTEXT';
    importance: number;
    keywords: string[];
}

export interface AtomicFactResult {
    content: string;
    type: 'ATOMIC';
    importance: number;
    keywords: string[];
    storyContext: string;
}

export interface PodcastFactResult {
    content: string;
    type: 'TOPIC' | 'QUOTE' | 'FACT' | 'STORY' | 'MOMENT';
    keywords: string[];
    importance: number;
}

export interface DiscordMemberFactResult {
    fact: string;
    confidence: number;
    category: string;
}

export interface OptimizedMemory {
    type: 'FACT' | 'PREFERENCE' | 'LORE' | 'CONTEXT';
    content: string;
    importance: number;
    source?: string;
}
