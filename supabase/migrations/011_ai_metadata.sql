-- Migration 011: AI Message Metadata
-- Depends on: 006_ai.sql

ALTER TABLE ai_messages
ADD COLUMN metadata JSONB NOT NULL DEFAULT '{}'::jsonb;
