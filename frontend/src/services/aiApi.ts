import type { ChatMessage, RagAnswer, AIConversationSummary } from '../types';
import { fetchWithAuth } from './api';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export const aiApi = {
  async ask(question: string, conversationId?: string, language: string = 'en'): Promise<{ message: ChatMessage, conversationId: string }> {
    const response = await fetchWithAuth(`${API_URL}/api/ai/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ question, language, conversationId })
    });
    
    if (!response.ok) {
      let errMsg = 'Failed to fetch AI response';
      try {
        const errJson = await response.json();
        if (errJson.error?.message) errMsg = errJson.error.message;
        else if (errJson.message) errMsg = errJson.message;
      } catch {
        // Ignore parse error
      }
      throw new Error(errMsg);
    }
    
    const json = await response.json();
    const data = json.data as RagAnswer & { conversationId: string };
    
    return {
      conversationId: data.conversationId,
      message: {
        id: crypto.randomUUID(),
        role: 'assistant',
        text: data.answer,
        citations: data.citations || [],
        confidence: data.confidence !== null && data.confidence !== undefined ? Math.round(data.confidence) : undefined
      }
    };
  },
  
  async getConversations(): Promise<AIConversationSummary[]> {
    const response = await fetchWithAuth(`${API_URL}/api/ai/conversations`, {
      headers: {}
    });
    if (!response.ok) throw new Error('Failed to fetch conversations');
    return (await response.json()).data;
  },
  
  async getConversationHistory(id: string) {
    const response = await fetchWithAuth(`${API_URL}/api/ai/conversations/${id}`, {
      headers: {}
    });
    if (!response.ok) throw new Error('Failed to fetch conversation history');
    return (await response.json()).data;
  }
};
