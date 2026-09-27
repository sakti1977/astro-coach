-- Launch performance: evaluate auth.uid() once per statement, not once per row.
-- Supabase advisor lint 0003_auth_rls_initplan flagged all 13 policies. Same rule,
-- same roles; ALTER POLICY rewrites each in place so there is no window without RLS.
-- https://supabase.com/docs/guides/database/postgres/row-level-security#call-functions-with-select

ALTER POLICY "Users can view their own coach feedback" ON public.coach_feedback USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can view their own observations" ON public.coaching_observations USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can insert their own observations" ON public.coaching_observations WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can update their own observations" ON public.coaching_observations USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can delete their own observations" ON public.coaching_observations USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can view their own push subscriptions" ON public.push_subscriptions USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can insert their own push subscriptions" ON public.push_subscriptions WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can update their own push subscriptions" ON public.push_subscriptions USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can delete their own push subscriptions" ON public.push_subscriptions USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can view their own profile" ON public.user_profiles USING ((select auth.uid()) = user_id);
ALTER POLICY "Users can insert their own profile" ON public.user_profiles WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can update their own profile" ON public.user_profiles USING ((select auth.uid()) = user_id) WITH CHECK ((select auth.uid()) = user_id);
ALTER POLICY "Users can delete their own profile" ON public.user_profiles USING ((select auth.uid()) = user_id);
