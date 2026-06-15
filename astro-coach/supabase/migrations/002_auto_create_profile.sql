-- Auto-create user profile when a new user signs up (email or phone)
-- Runs as SECURITY DEFINER to bypass RLS
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (
    user_id,
    birth_data,
    chart,
    dashas,
    validation,
    goals,
    habits,
    chat_history,
    coaching
  )
  VALUES (
    NEW.id,
    NULL,
    NULL,
    NULL,
    '{"questions": [], "accuracyScore": 0, "confirmedThemes": [], "isValidated": false}'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '{"behaviorProfile": [], "lastUpdated": "now()", "phase": "gathering", "exchangeCount": 0, "includeReligiousSolutions": false}'::jsonb
  )
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists, then recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
