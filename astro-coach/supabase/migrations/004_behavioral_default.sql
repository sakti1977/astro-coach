-- Behavioral practice is the default (SPEC.md G2 / NON_NEGOTIABLES.md #11).
-- Ritual remedies remain available as an opt-in in Coach.
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
    '{"behaviorProfile": [], "lastUpdated": "now()", "phase": "gathering", "exchangeCount": 0, "planDelivered": false, "tonePreference": "jyotish", "includeReligiousSolutions": false, "preferredLanguage": "en-IN"}'::jsonb
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
