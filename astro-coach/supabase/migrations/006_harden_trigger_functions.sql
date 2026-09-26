-- Supabase security advisor fixes (lints 0011 and 0028/0029).
-- Applied to production 2026-09-26.

-- Pin search_path so the functions can't be redirected to look-alike objects.
-- Both bodies only use schema-qualified tables and pg_catalog built-ins.
ALTER FUNCTION public.handle_new_user() SET search_path = '';
ALTER FUNCTION public.update_updated_at_column() SET search_path = '';

-- handle_new_user is a SECURITY DEFINER trigger function; it should only ever
-- run from the on_auth_user_created trigger, never via /rest/v1/rpc.
-- Trigger functions don't need EXECUTE for the trigger to fire.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
