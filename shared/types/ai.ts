/**
 * MANAK — AI / RAG contracts.
 *
 * This is the shape the brief calls out explicitly: answer, sources, citations,
 * confidence, relatedStandards. It is produced by `rag/`, passed through
 * `backend/src/services/ai.service.ts` unchanged in meaning, and rendered by
 * `frontend/src/components/ai/*`.
 *
 * Design rule that must not be softened: MANAK is *grounded* AI. When retrieval
 * does not support an answer, the pipeline returns `answerable: false` with
 * `insufficientKnowledge` set — it never fabricates a standards citation.
 */

import type { LanguageCode } from './api';

/** Kinds of documents in the MANAK knowledge base. */
export type KnowledgeDocumentType =
  | 'standard'
  | 'handbook'
  | 'technical_document'
  | 'certification_guide'
  | 'testing_requirement'
  | 'organization_knowledge'
  | 'regulatory_reference';

/**
 * A retrieved document chunk backing an answer. Rendered as a prominent
 * SourceCard — sources are visually first-class in MANAK, not a footnote.
 */
export interface AISource {
  id: string;
  documentId: string;
  documentTitle: string;
  documentType: KnowledgeDocumentType;
  /** e.g. "IS 1234:2021" when the source is a standard. */
  standardNumber: string | null;
  /** Section/clause heading the chunk came from, when known. */
  section: string | null;
  pageNumber: number | null;
  /** The retrieved text, already cleaned. Safe to display. */
  excerpt: string;
  /** Cosine similarity mapped to 0..1. Higher is closer. */
  relevanceScore: number;
  /** Deep link or download route for the underlying document. */
  url: string | null;
  publishedDate: string | null;
}

/**
 * Maps a span of the generated answer to the source that supports it, so the UI
 * can render inline markers rather than an unattributed wall of text.
 */
export interface AICitation {
  /** 1-based marker shown in the answer, e.g. [1]. */
  marker: number;
  sourceId: string;
  /** Character offsets into `AIAnswer.answer`. */
  startOffset: number;
  endOffset: number;
  /** The exact sentence/claim being attributed. */
  claim: string;
}

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface AIConfidence {
  level: ConfidenceLevel;
  /** 0..1. Derived from retrieval scores and source agreement. */
  score: number;
  /** Plain-language reason, shown in the ConfidenceBadge tooltip. */
  rationale: string;
}

export interface RelatedStandard {
  id: string;
  standardNumber: string;
  title: string;
  /** Why it is related — shown as caption text. */
  relation: 'referenced' | 'superseded_by' | 'amends' | 'similar_scope';
}

export interface SuggestedQuestion {
  id: string;
  question: string;
}

/** Set when the knowledge base cannot support an answer. */
export interface InsufficientKnowledge {
  reason: 'no_relevant_documents' | 'low_relevance' | 'out_of_scope';
  message: string;
  /** What the user could do instead. */
  suggestions: string[];
}

/** The canonical grounded-answer payload. */
export interface AIAnswer {
  conversationId: string;
  messageId: string;
  /** Echo of the question, post-normalisation. */
  question: string;
  /**
   * When false, `answer` is an honest refusal and `insufficientKnowledge`
   * explains why. Clients must handle this state explicitly.
   */
  answerable: boolean;
  answer: string;
  sources: AISource[];
  citations: AICitation[];
  confidence: AIConfidence;
  relatedStandards: RelatedStandard[];
  suggestedQuestions: SuggestedQuestion[];
  insufficientKnowledge: InsufficientKnowledge | null;
  language: LanguageCode;
  /** End-to-end pipeline time, surfaced in admin AI analytics. */
  durationMs: number;
  createdAt: string;
}

/* ---------------------------------- requests --------------------------------- */

export interface AIQueryRequest {
  question: string;
  /** Omit to start a new conversation. */
  conversationId?: string;
  language?: LanguageCode;
  /** Narrow retrieval, e.g. only handbooks. */
  documentTypes?: KnowledgeDocumentType[];
  /** Bias retrieval toward a sector's corpus. */
  sector?: string;
  /** Restrict to a specific standard's context. */
  standardId?: string;
}

export type AIMessageRole = 'user' | 'assistant';

export interface AIMessage {
  id: string;
  role: AIMessageRole;
  content: string;
  /** Present only on assistant messages. */
  answer: AIAnswer | null;
  createdAt: string;
}

export interface AIConversation {
  id: string;
  title: string;
  messages: AIMessage[];
  language: LanguageCode;
  createdAt: string;
  updatedAt: string;
}

export interface AIConversationSummary {
  id: string;
  title: string;
  messageCount: number;
  lastMessagePreview: string;
  updatedAt: string;
}

/* ------------------------------ rag-facing shapes ---------------------------- */

/** `POST /search` on the RAG service — retrieval only, no generation. */
export interface RAGSearchRequest {
  query: string;
  topK?: number;
  documentTypes?: KnowledgeDocumentType[];
  /** Discard chunks below this similarity. */
  minScore?: number;
  sector?: string;
}

export interface RAGSearchResponse {
  query: string;
  results: AISource[];
  /** True when nothing cleared `minScore`. */
  insufficient: boolean;
  durationMs: number;
}

export interface RAGIngestRequest {
  documentId: string;
  title: string;
  documentType: KnowledgeDocumentType;
  /** Storage path or URL the RAG service can read. */
  sourceUri: string;
  standardNumber?: string;
  sector?: string;
  language?: LanguageCode;
}

export type IngestionStatus =
  | 'queued'
  | 'parsing'
  | 'chunking'
  | 'embedding'
  | 'indexed'
  | 'failed';

export interface RAGIngestResponse {
  documentId: string;
  status: IngestionStatus;
  chunkCount: number;
  /** Populated when status === 'failed'. */
  error: string | null;
}

/** Confidence thresholds shared by RAG scoring and the UI badge. */
export const CONFIDENCE_THRESHOLDS = { high: 0.75, medium: 0.5 } as const;

/** Retrieval floor. Below this the pipeline reports insufficient knowledge. */
export const MIN_RELEVANCE_SCORE = 0.35;

export const DEFAULT_TOP_K = 6;

export function confidenceLevelFor(score: number): ConfidenceLevel {
  if (score >= CONFIDENCE_THRESHOLDS.high) return 'high';
  if (score >= CONFIDENCE_THRESHOLDS.medium) return 'medium';
  return 'low';
}
