-- AstraFlow Migration 003: Add Push Tokens for notifications
-- Run in Supabase SQL Editor

CREATE TABLE push_tokens (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  token VARCHAR(255) NOT NULL,
  platform VARCHAR(10) DEFAULT 'expo',
  alerts_enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_push_tokens_user ON push_tokens(user_id);
CREATE UNIQUE INDEX idx_push_tokens_token ON push_tokens(token);
