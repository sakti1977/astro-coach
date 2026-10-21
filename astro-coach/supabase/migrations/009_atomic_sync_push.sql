-- Atomic cloud sync: one transaction for profile + observations, guarded by a
-- server-managed revision.
--
-- Before this, /api/sync ran upsert -> delete -> insert as separate calls: a
-- failed insert after a successful delete wiped the user's cloud observations,
-- and two devices could both pass the timestamp check and overwrite each other.
--
-- Purely additive and safe to apply before the matching code deploys:
--   * `revision` defaults to 0 for every existing row.
--   * `sync_push` is a new function nothing calls until the new route ships, and
--     the route falls back to the old write path while the function is missing.

ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0;

-- Returns {"ok": true, "revision": n} on success, or
-- {"ok": false, "conflict": true, "revision": n} when p_expected_revision is
-- given, p_force is false and the row has moved on since the caller last saw it.
-- p_observations NULL leaves observations untouched (an omitted field must not
-- wipe cloud memory); an empty array clears them.
-- Keys absent from p_profile keep their stored value, matching the previous
-- supabase-js upsert (which skipped undefined fields); an explicit JSON null
-- stores SQL NULL.
CREATE OR REPLACE FUNCTION public.sync_push(
  p_user_id UUID,
  p_profile JSONB,
  p_observations JSONB,
  p_expected_revision INTEGER,
  p_force BOOLEAN DEFAULT FALSE
) RETURNS JSONB
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_current INTEGER;
  v_new INTEGER;
BEGIN
  -- Serialise concurrent pushes for this user.
  SELECT revision INTO v_current
  FROM public.user_profiles
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF FOUND
     AND p_expected_revision IS NOT NULL
     AND NOT COALESCE(p_force, FALSE)
     AND v_current <> p_expected_revision THEN
    RETURN jsonb_build_object('ok', FALSE, 'conflict', TRUE, 'revision', v_current);
  END IF;

  INSERT INTO public.user_profiles AS up (
    user_id, birth_data, chart, dashas, validation, goals, habits, chat_history, coaching,
    updated_at, revision
  ) VALUES (
    p_user_id,
    NULLIF(p_profile -> 'birth_data', 'null'::jsonb),
    NULLIF(p_profile -> 'chart', 'null'::jsonb),
    NULLIF(p_profile -> 'dashas', 'null'::jsonb),
    NULLIF(p_profile -> 'validation', 'null'::jsonb),
    NULLIF(p_profile -> 'goals', 'null'::jsonb),
    NULLIF(p_profile -> 'habits', 'null'::jsonb),
    NULLIF(p_profile -> 'chat_history', 'null'::jsonb),
    NULLIF(p_profile -> 'coaching', 'null'::jsonb),
    NOW(),
    1
  )
  ON CONFLICT (user_id) DO UPDATE SET
    birth_data   = CASE WHEN p_profile ? 'birth_data'   THEN NULLIF(p_profile -> 'birth_data', 'null'::jsonb)   ELSE up.birth_data   END,
    chart        = CASE WHEN p_profile ? 'chart'        THEN NULLIF(p_profile -> 'chart', 'null'::jsonb)        ELSE up.chart        END,
    dashas       = CASE WHEN p_profile ? 'dashas'       THEN NULLIF(p_profile -> 'dashas', 'null'::jsonb)       ELSE up.dashas       END,
    validation   = CASE WHEN p_profile ? 'validation'   THEN NULLIF(p_profile -> 'validation', 'null'::jsonb)   ELSE up.validation   END,
    goals        = CASE WHEN p_profile ? 'goals'        THEN NULLIF(p_profile -> 'goals', 'null'::jsonb)        ELSE up.goals        END,
    habits       = CASE WHEN p_profile ? 'habits'       THEN NULLIF(p_profile -> 'habits', 'null'::jsonb)       ELSE up.habits       END,
    chat_history = CASE WHEN p_profile ? 'chat_history' THEN NULLIF(p_profile -> 'chat_history', 'null'::jsonb) ELSE up.chat_history END,
    coaching     = CASE WHEN p_profile ? 'coaching'     THEN NULLIF(p_profile -> 'coaching', 'null'::jsonb)     ELSE up.coaching     END,
    updated_at   = NOW(),
    revision     = up.revision + 1
  RETURNING up.revision INTO v_new;

  IF p_observations IS NOT NULL THEN
    DELETE FROM public.coaching_observations WHERE user_id = p_user_id;

    INSERT INTO public.coaching_observations (
      user_id, observation_id, "timestamp", text, category, exchange_index
    )
    SELECT p_user_id, o.observation_id, o."timestamp", o.text, o.category, o.exchange_index
    FROM jsonb_to_recordset(p_observations) AS o(
      observation_id TEXT,
      "timestamp" TIMESTAMPTZ,
      text TEXT,
      category TEXT,
      exchange_index INTEGER
    );
  END IF;

  RETURN jsonb_build_object('ok', TRUE, 'revision', v_new);
END;
$$;

-- Service-role only (NON_NEGOTIABLES.md #1): never callable via /rest/v1/rpc
-- by anon or signed-in browsers.
REVOKE EXECUTE ON FUNCTION public.sync_push(UUID, JSONB, JSONB, INTEGER, BOOLEAN)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_push(UUID, JSONB, JSONB, INTEGER, BOOLEAN)
  TO service_role;
