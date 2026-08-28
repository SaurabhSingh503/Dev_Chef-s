import { supabase } from '../config/supabase.js';
import { ragClient } from './ragService.js';
import { AppError } from '../utils/appError.js';

export const aiService = {
  async ask(userId: string, question: string, language: string, conversationId?: string) {
    let activeConversationId = conversationId;

    if (activeConversationId) {
      // Validate ownership
      const { data: conv, error: convErr } = await supabase
        .from('ai_conversations')
        .select('id, user_id')
        .eq('id', activeConversationId)
        .single();
        
      if (convErr || !conv) throw new AppError(404, 'NOT_FOUND', 'Conversation not found');
      if (conv.user_id !== userId) throw new AppError(403, 'FORBIDDEN', 'Unauthorized access to conversation');
    } else {
      // Create conversation
      const { data: newConv, error: newConvErr } = await supabase
        .from('ai_conversations')
        .insert({ user_id: userId, title: question.substring(0, 50) })
        .select('id')
        .single();
        
      if (newConvErr || !newConv) {
        console.error('Failed to create conversation:', newConvErr);
        throw new AppError(500, 'INTERNAL_ERROR', 'Failed to create conversation');
      }
      activeConversationId = newConv.id;
    }

    // Persist user message
    const { data: userMsg, error: userMsgErr } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: activeConversationId,
        role: 'user',
        content: question
      })
      .select('id')
      .single();
      
    if (userMsgErr || !userMsg) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to persist user message');

    // Call RAG
    const ragAnswer = await ragClient.ask(question, language);

    // Persist assistant message
    const { data: assistantMsg, error: asstMsgErr } = await supabase
      .from('ai_messages')
      .insert({
        conversation_id: activeConversationId,
        role: 'assistant',
        content: ragAnswer.answer,
        metadata: {
          sources: ragAnswer.sources,
          confidence: ragAnswer.confidence,
          relatedStandards: ragAnswer.relatedStandards,
          suggestedQuestions: ragAnswer.suggestedQuestions,
          grounding: ragAnswer.grounding
        }
      })
      .select('id')
      .single();

    if (asstMsgErr || !assistantMsg) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to persist assistant message');

    // Persist citations if any
    if (ragAnswer.citations && ragAnswer.citations.length > 0) {
      const citationInserts = ragAnswer.citations.map(c => ({
        message_id: assistantMsg.id,
        chunk_id: c.chunk_id,
        relevance_score: c.relevance
      }));
      
      const { error: citErr } = await supabase
        .from('ai_citations')
        .insert(citationInserts);
        
      if (citErr) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to persist citations');
    }

    // Update conversation timestamp
    await supabase.from('ai_conversations').update({ updated_at: new Date().toISOString() }).eq('id', activeConversationId);

    return {
      ...ragAnswer,
      conversationId: activeConversationId
    };
  },

  async listConversations(userId: string) {
    const { data, error } = await supabase
      .from('ai_conversations')
      .select('id, title, created_at, updated_at, ai_messages(count)')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });
      
    if (error) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to retrieve conversations');
    return data.map(conv => ({
      id: conv.id,
      title: conv.title,
      createdAt: conv.created_at,
      updatedAt: conv.updated_at,
      // Supabase sometimes returns [{ count: number }] or directly { count: number }
       
      messageCount: (() => {
        const count = Array.isArray(conv.ai_messages) 
          ? conv.ai_messages[0]?.count || 0 
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          : (conv.ai_messages as any)?.count || 0;
        return count;
      })()
    }));
  },

  async getConversation(userId: string, conversationId: string) {
    const { data: conv, error: convErr } = await supabase
      .from('ai_conversations')
      .select('id, title, user_id, created_at')
      .eq('id', conversationId)
      .single();
      
    if (convErr || !conv) throw new AppError(404, 'NOT_FOUND', 'Conversation not found');
    if (conv.user_id !== userId) throw new AppError(403, 'FORBIDDEN', 'Unauthorized access to conversation');
    
    // Retrieve messages and metadata
    const { data: messages, error: msgErr } = await supabase
      .from('ai_messages')
      .select(`
        id, role, content, metadata, created_at,
        ai_citations(
          chunk_id, relevance_score,
          document_chunks(
            page, section, clause,
            documents(id, title)
          )
        )
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
      
    if (msgErr) throw new AppError(500, 'INTERNAL_ERROR', 'Failed to retrieve messages');
    
    const mappedMessages = messages.map(msg => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const citations = msg.ai_citations?.map((cit: any) => {
        // Handle Supabase sometimes returning relationships as arrays or objects depending on the schema inference
        const chunk = Array.isArray(cit.document_chunks) ? cit.document_chunks[0] : cit.document_chunks;
        const doc = chunk ? (Array.isArray(chunk.documents) ? chunk.documents[0] : chunk.documents) : null;
        return {
          document_id: doc?.id,
          document_title: doc?.title,
          page: chunk?.page,
          section: chunk?.section,
          clause: chunk?.clause,
          chunk_id: cit.chunk_id,
          relevance: cit.relevance_score
        };
      }) || [];
      
      return {
        id: msg.id,
        role: msg.role,
        content: msg.content,
        metadata: msg.metadata || {},
        citations,
        createdAt: msg.created_at
      };
    });
    
    return {
      id: conv.id,
      title: conv.title,
      messages: mappedMessages
    };
  }
};
