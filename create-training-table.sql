CREATE TABLE IF NOT EXISTS negotiation_training_data (
  id SERIAL PRIMARY KEY,
  deal_id UUID NOT NULL REFERENCES chatbot_deals(id) ON UPDATE CASCADE ON DELETE CASCADE,
  user_id INTEGER NOT NULL,
  round INTEGER NOT NULL DEFAULT 0,
  suggestions_json JSONB NOT NULL,
  conversation_context TEXT,
  config_snapshot JSONB,
  llm_model VARCHAR(100),
  generation_source VARCHAR(50) NOT NULL DEFAULT 'llm' CHECK (generation_source IN ('llm', 'fallback')),
  selected_scenario VARCHAR(50),
  selected_suggestion TEXT,
  deal_outcome VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_training_data_deal_id ON negotiation_training_data(deal_id);
CREATE INDEX IF NOT EXISTS idx_training_data_user_id ON negotiation_training_data(user_id);
CREATE INDEX IF NOT EXISTS idx_training_data_created_at ON negotiation_training_data(created_at);
CREATE INDEX IF NOT EXISTS idx_training_data_generation_source ON negotiation_training_data(generation_source);
