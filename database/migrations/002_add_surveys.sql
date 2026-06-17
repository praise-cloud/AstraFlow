-- AstraFlow Migration 002: Add Surveys table
-- Run in Supabase SQL Editor

CREATE TABLE surveys (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  business_type business_type NOT NULL,
  monthly_fuel_spend NUMERIC(10,2),
  impact_level VARCHAR(20),
  concern_areas TEXT[],
  comments TEXT,
  submitted_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_surveys_user ON surveys(user_id);
CREATE INDEX idx_surveys_impact ON surveys(impact_level);
CREATE INDEX idx_surveys_business ON surveys(business_type);
