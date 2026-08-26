/**
 * MANAK — voice interaction contracts.
 *
 * Voice is a first-class MANAK affordance (many users are more comfortable
 * speaking a regional language than typing it). Speech-to-text and
 * text-to-speech both run server-side; keys never reach the browser.
 */

import type { LanguageCode } from './api';
import type { AIAnswer } from './ai';

export type VoiceSessionStatus =
  | 'idle'
  | 'recording'
  | 'transcribing'
  | 'thinking'
  | 'speaking'
  | 'error';

/** Audio container the client uploads. Browser MediaRecorder typically gives webm. */
export type AudioFormat = 'webm' | 'mp4' | 'wav' | 'ogg';

export interface TranscribeRequest {
  /** Base64-encoded audio, or use multipart upload on the same route. */
  audioBase64?: string;
  format: AudioFormat;
  /** Hint for the recogniser; omit to auto-detect. */
  language?: LanguageCode;
}

export interface TranscribeResponse {
  transcript: string;
  /** Detected language, which may differ from the hint. */
  detectedLanguage: LanguageCode;
  /** 0..1 recogniser confidence. */
  confidence: number;
  durationMs: number;
}

export interface SynthesizeRequest {
  text: string;
  language: LanguageCode;
  /** Named voice preset; server maps to the provider's voice id. */
  voice?: 'default' | 'female' | 'male';
}

export interface SynthesizeResponse {
  /** Base64 audio the client can play directly. */
  audioBase64: string;
  format: AudioFormat;
  durationMs: number;
}

/** One round trip: speech in, grounded answer out, speech back. */
export interface VoiceQueryResponse {
  transcript: string;
  detectedLanguage: LanguageCode;
  answer: AIAnswer;
  /** Null when the client opted out of audio playback. */
  audioBase64: string | null;
}

/** Waveform samples for the recording visualiser, normalised 0..1. */
export type WaveformSamples = number[];

export const MAX_RECORDING_SECONDS = 60;
export const WAVEFORM_BAR_COUNT = 48;
