export type Role = 'individual' | 'organization' | 'admin';
export type Standard = { id:string; code:string; title:string; category:string; categories?:string[]; industry:string; status:string; description:string; tags?:string[]; file_name?:string; year?:string };
export type Laboratory = { id:string; name:string; address:string; city:string; district?:string; state:string; pin:string; distanceKm?:number; latitude?:number; longitude?:number; services:string[]; status:string; oslCode?:string; recognitionStatus?:string; recognitionValidUntil?:string; phone?:string; hours?:string; };
export type Handbook = { id:string; title:string; category:string; description:string; pages:number; updated:string; audience:'BIS'|'Organization' };
export type RagCitation = { document_id: string; document_title: string; page: number | null; section: string | null; clause: string | null; chunk_id: string; relevance: number; source: string | null; file_name: string | null; };
export type RagSource = { title: string; reference: string; };
export type RagAnswer = { answer: string; sources: RagSource[]; citations: RagCitation[]; confidence: number | null; relatedStandards: string[]; suggestedQuestions: string[]; grounding?: "supported" | "partially_supported" | "insufficient_information"; };
export type ChatMessage = { id:string; role:'user'|'assistant'; text:string; citations?:RagCitation[]; confidence?:number };
export type User = { name:string; email:string; role:Role; account_type: 'individual'|'organization'; product_type?:string; organizationName?:string; avatar_url?:string };

export type AIConversationSummary = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
};
