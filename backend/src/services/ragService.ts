import { env } from '../config/env.js';
export type RagAnswer={
  answer:string;
  sources:{title:string;reference:string}[];
  citations:{document_id:string;document_title:string;page:number|null;section:string|null;clause:string|null;chunk_id:string;relevance:number;source:string|null;file_name:string|null}[];
  confidence:number|null;
  relatedStandards:string[];
  suggestedQuestions:string[];
  grounding?:"supported"|"partially_supported"|"insufficient_information";
};
export interface RagClient{ask(question:string,language:string):Promise<RagAnswer>;health():Promise<'connected'|'not_configured'|'unavailable'>;}
class HttpRagClient implements RagClient{async ask(question:string,language:string){const response=await fetch(`${env.RAG_SERVICE_URL}/query`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({question,language})});if(!response.ok)throw new Error('RAG request failed');return response.json() as Promise<RagAnswer>;}async health(){try{return (await fetch(`${env.RAG_SERVICE_URL}/health`)).ok?'connected':'unavailable';}catch{return 'unavailable';}}}
class UnconfiguredRagClient implements RagClient{async ask(question:string):Promise<RagAnswer>{return {answer:`RAG is not connected. Your question (“${question}”) was accepted but no authoritative response can be generated until RAG_SERVICE_URL is configured.`,sources:[],citations:[],confidence:0,relatedStandards:[],suggestedQuestions:[]};}async health(){return 'not_configured' as const;}}
export const ragClient:RagClient=env.RAG_SERVICE_URL?new HttpRagClient():new UnconfiguredRagClient();
