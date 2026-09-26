-- Thumbs up/down on coaching replies (quality signal; SPEC.md §2.5 groundwork).
-- Written only by /api/coach/feedback with the service-role client, scoped to
-- the verified NextAuth user id (NON_NEGOTIABLES.md #1). RLS is on with a
-- read-own policy only, so the anon key can never write here.
CREATE TABLE IF NOT EXISTS coach_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- The assistant message's own timestamp: the stable id the client has for it.
  message_timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  rating SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
  reason TEXT CHECK (reason IN ('not_accurate', 'too_generic', 'not_helpful', 'too_long', 'other')),
  -- The coach's reply (never the user's messages), so a rating can be read in context.
  reply TEXT NOT NULL,
  phase TEXT,
  tone TEXT,
  model TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, message_timestamp)
);

CREATE INDEX IF NOT EXISTS idx_coach_feedback_user_id ON coach_feedback(user_id);
CREATE INDEX IF NOT EXISTS idx_coach_feedback_created_at ON coach_feedback(created_at);

ALTER TABLE coach_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own coach feedback" ON coach_feedback;
CREATE POLICY "Users can view their own coach feedback"
  ON coach_feedback FOR SELECT
  USING (auth.uid() = user_id);
