-- FlowCare usage analytics: anonymous, aggregate-only counts.
-- Visitors may only INSERT events; nobody can read raw rows through the API.
-- Admins read totals through analytics_summary(), which checks admin membership on the server.

CREATE TABLE IF NOT EXISTS public.admins (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admins ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admins FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.usage_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  event text NOT NULL CHECK (event IN ('session_start', 'screen_view', 'route_started', 'voice_play')),
  screen text CHECK (screen IS NULL OR screen IN (
    'home', 'map', 'parking', 'visit', 'support', 'kids', 'doctor', 'scanner',
    'memory', 'colorStar', 'bubbles', 'catchStars', 'map-step'
  )),
  route_type text CHECK (route_type IS NULL OR route_type IN ('elderly', 'pregnant', 'urgent')),
  platform text NOT NULL CHECK (platform IN ('ios', 'android', 'desktop', 'other')),
  is_test boolean NOT NULL DEFAULT false,
  session_id text NOT NULL CHECK (char_length(session_id) BETWEEN 8 AND 64)
);
CREATE INDEX IF NOT EXISTS usage_events_created_idx ON public.usage_events (created_at DESC, is_test);

ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.usage_events FROM anon, authenticated;
GRANT INSERT (event, screen, route_type, platform, is_test, session_id) ON public.usage_events TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can log an anonymous event" ON public.usage_events;
CREATE POLICY "Anyone can log an anonymous event"
  ON public.usage_events FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);
-- No SELECT / UPDATE / DELETE policies: raw rows are never readable through the API.

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.admins a WHERE a.user_id = auth.uid());
$$;
REVOKE ALL ON FUNCTION public.is_admin() FROM public;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.analytics_summary(range text DEFAULT '7d', include_test boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  since timestamptz;
  result jsonb;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;

  since := CASE range
    WHEN 'today' THEN (date_trunc('day', now() AT TIME ZONE 'Asia/Riyadh')) AT TIME ZONE 'Asia/Riyadh'
    WHEN '7d' THEN now() - interval '7 days'
    WHEN '30d' THEN now() - interval '30 days'
    ELSE NULL
  END;
  IF since IS NULL THEN
    RAISE EXCEPTION 'invalid range' USING ERRCODE = '22023';
  END IF;

  WITH ev AS (
    SELECT * FROM public.usage_events
    WHERE created_at >= since AND is_test = include_test
  )
  SELECT jsonb_build_object(
    'range', range,
    'test', include_test,
    'since', since,
    'sessions', (SELECT count(*) FROM ev WHERE event = 'session_start'),
    'screen_views', (SELECT count(*) FROM ev WHERE event = 'screen_view'),
    'routes_started', (SELECT count(*) FROM ev WHERE event = 'route_started'),
    'voice_plays', (SELECT count(*) FROM ev WHERE event = 'voice_play'),
    'top_screens', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('screen', screen, 'count', c) ORDER BY c DESC, screen)
      FROM (SELECT screen, count(*) AS c FROM ev WHERE event = 'screen_view' AND screen IS NOT NULL GROUP BY screen ORDER BY c DESC LIMIT 8) s
    ), '[]'::jsonb),
    'routes_by_type', COALESCE((
      SELECT jsonb_object_agg(route_type, c)
      FROM (SELECT route_type, count(*) AS c FROM ev WHERE event = 'route_started' AND route_type IS NOT NULL GROUP BY route_type) r
    ), '{}'::jsonb),
    'platforms', COALESCE((
      SELECT jsonb_object_agg(platform, c)
      FROM (SELECT platform, count(*) AS c FROM ev WHERE event = 'session_start' GROUP BY platform) p
    ), '{}'::jsonb)
  ) INTO result;

  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.analytics_summary(text, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.analytics_summary(text, boolean) TO authenticated;
