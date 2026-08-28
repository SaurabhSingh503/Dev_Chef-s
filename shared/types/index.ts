export type Role = 'individual' | 'organization' | 'admin';

export type AuthUser = {
  id: string;
  email: string;
  role: Role;
  name: string;
  organizationName?: string;
};

export type ApiSuccess<T> = {
  success: true;
  data: T;
  message?: string;
};

export type ApiError = {
  success: false;
  error: {
    code: string;
    message: string;
  };
};

export type Page<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

// Domain Entities
export type Standard = {
  id: string;
  code: string;
  title: string;
  category: string;
  industry: string;
  status: 'current' | 'under_review';
  description: string;
};

export type Laboratory = {
  id: string;
  name: string;
  city: string;
  state: string;
  pin: string;
  address: string;
  distanceKm?: number;
  latitude?: number;
  longitude?: number;
  services: string[];
  status: string;
};

export type Handbook = {
  id: string;
  title: string;
  category: string;
  description?: string;
  pages: number;
  updated?: string;
  audience?: 'BIS' | 'Organization';
};

export type Report = {
  id: string;
  title: string;
  status: string;
};

// AI & RAG Contracts
export type RagCitation = {
  document_id: string;
  document_title: string;
  page: number | null;
  section: string | null;
  clause: string | null;
  chunk_id: string;
  relevance: number;
};

export type RagSource = {
  title: string;
  reference: string;
};

export type RagAnswer = {
  answer: string;
  sources: RagSource[];
  citations: RagCitation[];
  confidence: number | null;
  relatedStandards: string[];
  suggestedQuestions: string[];
  grounding?: "supported" | "partially_supported" | "insufficient_information";
};

// Frontend Chat Types
export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  citations?: RagCitation[];
  confidence?: number;
};
