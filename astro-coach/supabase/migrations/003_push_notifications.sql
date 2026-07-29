-- Web Push subscriptions, one row per browser/device a user has enabled
-- notifications on. Writes go through server-side API routes using the
-- service-role key (same pattern as user_profiles sync), so RLS here is
-- defense-in-depth rather than the primary access-control path.
--
-- DROP + CREATE (rather than IF NOT EXISTS) so this migration is safe to
-- re-run after a partial failure — this table carries no data worth
-- preserving across a re-run (it's just device push-subscription pointers,
-- trivially re-populated the next time each browser re-subscribes).
DROP TABLE IF EXISTS push_subscriptions CASCADE;

CREATE TABLE push_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth_key TEXT NOT NULL,

  -- Per-type opt-out — all on by default.
  notify_dasha BOOLEAN NOT NULL DEFAULT true,
  notify_sade_sati BOOLEAN NOT NULL DEFAULT true,
  notify_sadhana BOOLEAN NOT NULL DEFAULT true,

  -- De-dupe state so the hourly cron doesn't repeat the same alert.
  last_dasha_notified_end TEXT,
  last_sade_sati_phase TEXT,
  last_sadhana_reminder_date TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- DROP + CREATE (rather than bare CREATE POLICY) so this migration is safe
-- to re-run after a partial failure, matching the IF NOT EXISTS/OR REPLACE
-- idempotency of the rest of this file.
DROP POLICY IF EXISTS "Users can view their own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can view their own push subscriptions"
  ON push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can insert their own push subscriptions"
  ON push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can update their own push subscriptions"
  ON push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users can delete their own push subscriptions"
  ON push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- Fix stale defaults in the new-user trigger (002) — it still hardcoded
-- includeReligiousSolutions: false and was missing preferredLanguage, both
-- of which the app now defaults differently (see lib/profile.ts).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (
    user_id, birth_data, chart, dashas, validation, goals, habits, chat_history, coaching
  )
  VALUES (
    NEW.id, NULL, NULL, NULL,
    '{"questions": [], "accuracyScore": 0, "confirmedThemes": [], "isValidated": false}'::jsonb,
    '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
    '{"behaviorProfile": [], "lastUpdated": "now()", "phase": "gathering", "exchangeCount": 0, "includeReligiousSolutions": true, "preferredLanguage": "en-IN"}'::jsonb
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
