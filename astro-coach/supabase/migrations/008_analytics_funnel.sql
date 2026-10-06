-- Privacy-light launch funnel: visit -> chart_created -> coach_message -> return within 7 days.
-- See lib/analytics.ts for exactly what is (and is not) stored: a random
-- browser-made id, an event name, a UTC day and, on a first visit, the
-- referring hostname. No IP, user agent, account id or user content.
--
-- Written only by /api/analytics/event with the service-role client
-- (NON_NEGOTIABLES.md #1). RLS is on with no policies and anon/authenticated
-- have no grants, so the public API can neither read nor write it.
CREATE TABLE IF NOT EXISTS analytics_events (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  visitor_id UUID NOT NULL,
  event TEXT NOT NULL CHECK (event IN ('visit', 'chart_created', 'coach_message')),
  day DATE NOT NULL,
  -- Referring hostname or utm_source; only set on a visitor's first visit.
  ref TEXT CHECK (ref IS NULL OR ref ~ '^[a-z0-9][a-z0-9._-]{0,63}$'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  UNIQUE (visitor_id, event, day)
);

-- Pruning (daily cron) and the funnel view both scan by day.
CREATE INDEX IF NOT EXISTS idx_analytics_events_day ON analytics_events(day);

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON analytics_events FROM anon, authenticated;

-- One row per (first-visit week, source). Sum the columns for any wider cut:
--   SELECT cohort_week, sum(visitors) visitors, sum(chart_created) charts,
--          sum(coach_message) coached, sum(returned_7d) returned
--   FROM analytics_funnel GROUP BY 1 ORDER BY 1 DESC;
-- A cohort younger than 7 days under-counts returned_7d; read it once the week is over.
-- security_invoker + the revoked grants above: only the service role / dashboard can read it.
CREATE OR REPLACE VIEW analytics_funnel WITH (security_invoker = true) AS
WITH first_visit AS (
  SELECT DISTINCT ON (visitor_id) visitor_id, day AS first_day, ref
  FROM analytics_events
  WHERE event = 'visit'
  ORDER BY visitor_id, day
)
SELECT
  date_trunc('week', fv.first_day)::date AS cohort_week,
  COALESCE(fv.ref, 'direct') AS source,
  COUNT(*) AS visitors,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM analytics_events e
    WHERE e.visitor_id = fv.visitor_id AND e.event = 'chart_created'
  )) AS chart_created,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM analytics_events e
    WHERE e.visitor_id = fv.visitor_id AND e.event = 'coach_message'
  )) AS coach_message,
  COUNT(*) FILTER (WHERE EXISTS (
    SELECT 1 FROM analytics_events e
    WHERE e.visitor_id = fv.visitor_id AND e.event = 'visit'
      AND e.day > fv.first_day AND e.day <= fv.first_day + 7
  )) AS returned_7d
FROM first_visit fv
GROUP BY 1, 2;

REVOKE ALL ON analytics_funnel FROM anon, authenticated;
