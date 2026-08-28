-- Migration 006: AI Conversations
-- Depends on: 001_users.sql, 004_document_chunks.sql

CREATE TABLE ai_conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
    title TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ai_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID REFERENCES ai_conversations(id) ON DELETE CASCADE,
    role TEXT NOT NULL, -- 'user' or 'assistant'
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE ai_citations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID REFERENCES ai_messages(id) ON DELETE CASCADE,
    chunk_id UUID REFERENCES document_chunks(id) ON DELETE CASCADE,
    relevance_score FLOAT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_ai_conv_user ON ai_conversations(user_id);
CREATE INDEX idx_ai_conv_org ON ai_conversations(organization_id);
CREATE INDEX idx_ai_msg_conv ON ai_messages(conversation_id);
CREATE INDEX idx_ai_citations_msg ON ai_citations(message_id);

-- Row Level Security
ALTER TABLE ai_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_citations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own conversations"
ON ai_conversations FOR SELECT
USING (user_id = auth.uid());

CREATE POLICY "Users can access messages of their conversations"
ON ai_messages FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM ai_conversations 
        WHERE ai_conversations.id = ai_messages.conversation_id 
        AND ai_conversations.user_id = auth.uid()
    )
);

CREATE POLICY "Users can access citations of their messages"
ON ai_citations FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM ai_messages
        JOIN ai_conversations ON ai_conversations.id = ai_messages.conversation_id
        WHERE ai_messages.id = ai_citations.message_id
        AND ai_conversations.user_id = auth.uid()
    )
);
