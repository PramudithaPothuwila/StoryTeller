grant usage on schema public to anon, authenticated, service_role;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update on public.user_settings to authenticated;
grant select, insert, update, delete on public.projects to authenticated;

grant all on public.profiles to service_role;
grant all on public.user_settings to service_role;
grant all on public.projects to service_role;
